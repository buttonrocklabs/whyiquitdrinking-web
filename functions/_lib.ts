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
