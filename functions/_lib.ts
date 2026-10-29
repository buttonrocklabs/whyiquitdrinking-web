import { MAX_PHOTO_BYTES, PHOTO_ERRORS } from '../shared/pair'
import { REVIEW_FAILURES_PER_IP, clientIp, hitLimit, isLockedOut, readLimit } from './_ratelimit'

export interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  REVIEW_PASSPHRASE: string
  // Brevo transactional email (WIQD-16). All optional: with no key or no FROM
  // address, sendEmail skips the send. Pages secrets, production only.
  BREVO_API_KEY?: string
  BREVO_FROM_EMAIL?: string
  BREVO_FROM_NAME?: string
  BREVO_REPLY_TO?: string
  /** Where a removal notice goes, so someone can take down any pin made from the story. */
  WITHDRAW_NOTIFY_EMAIL?: string
}

/** Fixed base for links in email, so a link made on a preview deploy still points at the live site. */
export const SITE_URL = 'https://whyiquitdrinking.com'

export interface StoryRow {
  id: string
  display_name: string | null
  story_text: string
  photo_key: string | null
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  consent_given: number
  submitted_at: string
  reviewed_at: string | null
  reviewer: string | null
  reject_reason: string | null
}

export function photoUrl(photoKey: string | null): string | null {
  return photoKey ? `/media/${photoKey}` : null
}

export interface PhotoRow {
  story_id: string
  kind: 'before' | 'after'
  r2_key: string
  taken_on: string
}

export interface PairPhoto {
  kind: 'before' | 'after'
  url: string
  takenOn: string
}

/** Groups pair photo rows by story, before first. Stories without a pair have no entry. */
export function photosByStory(rows: PhotoRow[]): Map<string, PairPhoto[]> {
  const byStory = new Map<string, PairPhoto[]>()
  for (const row of rows) {
    const list = byStory.get(row.story_id) ?? []
    list.push({ kind: row.kind, url: `/media/${row.r2_key}`, takenOn: row.taken_on })
    byStory.set(row.story_id, list)
  }
  for (const list of byStory.values()) {
    list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'before' ? -1 : 1))
  }
  return byStory
}

/**
 * Manage token: 32 random bytes as base64url. The raw token is shown to the
 * contributor once and never stored; story_consents.manage_token_hash holds
 * hashToken(token).
 */
export function newManageToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** SHA-256 of the token string, lowercase hex. Look a manage link up by this, never by the raw token. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const IMAGE_TYPES = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
} as const

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end))
}

/** Identifies an image by its leading bytes. The browser's declared MIME type and file name are never consulted. */
export function sniffImage(bytes: Uint8Array): keyof typeof IMAGE_TYPES | 'heic' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png'
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp'
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp' && HEIC_BRANDS.includes(ascii(bytes, 8, 12))) {
    return 'heic'
  }
  return null
}

export type PhotoCheck =
  | { ok: true; bytes: ArrayBuffer; mime: string; ext: string }
  | { ok: false; error: string }

/** Size limit first, then the magic-byte check. Returns the bytes to store and the type taken from them. */
export async function readPhoto(file: File): Promise<PhotoCheck> {
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: PHOTO_ERRORS.size }
  const bytes = await file.arrayBuffer()
  const kind = sniffImage(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 12)))
  if (kind === 'heic') return { ok: false, error: PHOTO_ERRORS.heic }
  if (kind === null) return { ok: false, error: PHOTO_ERRORS.type }
  return { ok: true, bytes, ...IMAGE_TYPES[kind] }
}

/**
 * Constant-time passphrase check. Both sides are hashed first so timingSafeEqual always
 * compares 32 bytes and the length of the secret never shows in the timing.
 */
async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? ''
  const passphrase = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  if (passphrase.length === 0 || !env.REVIEW_PASSPHRASE) return false
  const encoder = new TextEncoder()
  const [given, expected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(passphrase)),
    crypto.subtle.digest('SHA-256', encoder.encode(env.REVIEW_PASSPHRASE)),
  ])
  return crypto.subtle.timingSafeEqual(given, expected)
}

/**
 * Gate for every moderator route. Returns null when the request may go on, otherwise the
 * response to send: 429 while the IP is locked out (checked before the passphrase is
 * compared, so a locked IP learns nothing even with the right one), 401 for a wrong
 * passphrase, which also counts toward the lockout. If the counter table cannot be read
 * the check fails open and logs, so a D1 hiccup never locks moderators out.
 */
export async function reviewGate(request: Request, env: Env): Promise<Response | null> {
  const ip = clientIp(request)
  try {
    const { current, previous } = await readLimit(env.DB, REVIEW_FAILURES_PER_IP, ip)
    if (isLockedOut(current, previous, REVIEW_FAILURES_PER_IP.max)) {
      return json({ ok: false, error: 'locked' }, { status: 429, headers: { 'retry-after': '1800' } })
    }
  } catch (error) {
    console.error('review gate: lockout check failed', error)
  }

  if (await isAuthorized(request, env)) return null

  try {
    await hitLimit(env.DB, REVIEW_FAILURES_PER_IP, ip)
  } catch (error) {
    console.error('review gate: failure count failed', error)
  }
  return json({ ok: false, error: 'unauthorized' }, { status: 401 })
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
}

export interface EmailMessage {
  to: string
  subject: string
  /** Plain-text body. Always sent. */
  text: string
  /** HTML body, when the message needs a real link or paragraphs. */
  html?: string
}

/**
 * Sends one email through Brevo. The only place mail leaves the app, so Cloudflare
 * Email Service can replace it later without touching a caller.
 *
 * With no BREVO_API_KEY or no BREVO_FROM_EMAIL it logs one warning and returns, so a
 * preview deploy or a local run just sends nothing. A failed send throws; callers hand
 * it to waitUntil with a .catch so mail never blocks or fails a request.
 */
export async function sendEmail(env: Env, message: EmailMessage): Promise<void> {
  if (!env.BREVO_API_KEY || !env.BREVO_FROM_EMAIL) {
    console.warn('sendEmail skipped: BREVO_API_KEY or BREVO_FROM_EMAIL is not set')
    return
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_FROM_NAME || 'Why I Quit Drinking', email: env.BREVO_FROM_EMAIL },
      to: [{ email: message.to }],
      ...(env.BREVO_REPLY_TO ? { replyTo: { email: env.BREVO_REPLY_TO } } : {}),
      subject: message.subject,
      textContent: message.text,
      ...(message.html ? { htmlContent: message.html } : {}),
    }),
  })

  if (!response.ok) {
    // The status and Brevo's own reason are enough to debug; the recipient stays out of the log.
    const body = await response.text()
    throw new Error(`Brevo send failed: ${response.status} ${body.slice(0, 200)}`)
  }
}

/** Escapes text for an HTML email body. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
