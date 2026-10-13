import type { Env } from '../_lib'

// The only types a contributor's upload is ever stored as (see IMAGE_TYPES in _lib.ts), plus gif.
const SERVED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** Every response from here, errors included, carries the same two safeguards against a file being run as a page. */
function guard(headers: Headers): Headers {
  headers.set('x-content-type-options', 'nosniff')
  headers.set('content-security-policy', 'sandbox')
  return headers
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: guard(new Headers()) })
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const segments = Array.isArray(params.path) ? params.path : [params.path]
  const key = segments.filter(Boolean).join('/')
  if (!key) {
    return notFound()
  }

  const object = await env.MEDIA.get(key)
  if (!object) {
    return notFound()
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  // Five minutes, not immutable: a removed photo stops being served within that long.
  // There is no purge (no Cloudflare API token in Env), so the short life is the mechanism.
  headers.set('cache-control', 'public, max-age=300')
  // Whatever type R2 holds is passed through only when it is exactly one of the four image
  // types above, never as text/html or svg; anything else is served as opaque bytes. nosniff
  // stops a browser guessing a different type, and sandbox keeps any script in a file opened
  // directly from running.
  if (!SERVED_TYPES.has(headers.get('content-type') ?? '')) headers.set('content-type', 'application/octet-stream')

  return new Response(object.body, { headers: guard(headers) })
}
