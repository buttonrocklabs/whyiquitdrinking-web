// Fixed-window counters in the D1 rate_limits table (LAB-629). The decisions are pure
// functions so they can be checked without D1; hitLimit and readLimit are the only D1
// calls. Nothing here imports another module, so node can load this file on its own.

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface Limit {
  /** Prefix of the counter key, so different limits never share a row. */
  bucket: string
  max: number
  windowMs: number
}

/** Stories stored per IP per hour. Counted after validation, so a visitor fixing a form error never uses one up. */
export const SUBMIT_PER_IP: Limit = { bucket: 'submit-ip', max: 5, windowMs: HOUR }

/** Private-link emails per normalised address per 24 hours (the submission being made counts). */
export const LINK_EMAILS_PER_ADDRESS: Limit = { bucket: 'link-email', max: 3, windowMs: DAY }

/** Wrong moderator passphrases per IP per 15 minutes before that IP is locked out. */
export const REVIEW_FAILURES_PER_IP: Limit = { bucket: 'review-fail-ip', max: 5, windowMs: 15 * MINUTE }

/** Start of the fixed window that holds nowMs. */
export function windowStart(nowMs: number, windowMs: number): number {
  return nowMs - (nowMs % windowMs)
}

export function limitKey(bucket: string, idHash: string, start: number): string {
  return `${bucket}:${idHash}:${start}`
}

/** True once a count that already includes this request goes past the limit. */
export function isOverLimit(count: number, max: number): boolean {
  return count > max
}

/**
 * Lockout check, run before the passphrase is compared. Locked while the current window
 * has max failures, and for the whole window after one that did, so a lockout always
 * lasts at least one full window (15 to 30 minutes for the moderator limit).
 */
export function isLockedOut(current: number, previous: number, max: number): boolean {
  return current >= max || previous >= max
}

/**
 * The address as the cap counts it: trimmed, lowercased, anything from the first + in
 * the local part dropped, and for Gmail the dots dropped and googlemail.com folded in.
 * Mail still goes to the address exactly as typed.
 */
export function normaliseEmail(email: string): string {
  const lower = email.trim().toLowerCase()
  const at = lower.lastIndexOf('@')
  if (at <= 0) return lower
  let local = lower.slice(0, at)
  let domain = lower.slice(at + 1)
  const plus = local.indexOf('+')
  if (plus > 0) local = local.slice(0, plus)
  if (domain === 'googlemail.com') domain = 'gmail.com'
  if (domain === 'gmail.com') local = local.replace(/\./g, '')
  return `${local}@${domain}`
}

/** The visitor's IP as Cloudflare reports it. Every request through Cloudflare has it. */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown'
}

/** SHA-256 hex, so no raw IP or email address is written to the counter table. */
async function hashId(id: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Adds one to the current window for this id and returns the new count. Rows are kept
 * for two windows (isLockedOut reads the previous one) and expired rows are swept here.
 */
export async function hitLimit(db: D1Database, limit: Limit, id: string, nowMs = Date.now()): Promise<number> {
  const start = windowStart(nowMs, limit.windowMs)
  const key = limitKey(limit.bucket, await hashId(id), start)
  const expiresAt = new Date(start + 2 * limit.windowMs).toISOString()
  const [, upsert] = await db.batch<{ count: number }>([
    db.prepare(`DELETE FROM rate_limits WHERE expires_at < ?`).bind(new Date(nowMs).toISOString()),
    db
      .prepare(
        `INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = count + 1
         RETURNING count`
      )
      .bind(key, expiresAt),
  ])
  return upsert?.results[0]?.count ?? 1
}

/** Counts in the current and the previous window for this id, without adding to either. */
export async function readLimit(
  db: D1Database,
  limit: Limit,
  id: string,
  nowMs = Date.now()
): Promise<{ current: number; previous: number }> {
  const start = windowStart(nowMs, limit.windowMs)
  const idHash = await hashId(id)
  const currentKey = limitKey(limit.bucket, idHash, start)
  const previousKey = limitKey(limit.bucket, idHash, start - limit.windowMs)
  const { results } = await db
    .prepare(`SELECT key, count FROM rate_limits WHERE key IN (?, ?)`)
    .bind(currentKey, previousKey)
    .all<{ key: string; count: number }>()
  const countOf = (key: string) => results.find((row) => row.key === key)?.count ?? 0
  return { current: countOf(currentKey), previous: countOf(previousKey) }
}
