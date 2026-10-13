import { MAX_PHOTO_BYTES, PHOTO_ERRORS } from '../shared/pair'

export interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  REVIEW_PASSPHRASE: string
}

export interface StoryRow {
  id: string
  display_name: string | null
  story_text: string
  photo_key: string | null
  status: 'pending' | 'approved' | 'rejected'
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

export function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get('Authorization') ?? ''
  const passphrase = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  return passphrase.length > 0 && passphrase === env.REVIEW_PASSPHRASE
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
}
