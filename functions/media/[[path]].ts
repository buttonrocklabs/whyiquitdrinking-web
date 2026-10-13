import type { Env } from '../_lib'

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const segments = Array.isArray(params.path) ? params.path : [params.path]
  const key = segments.filter(Boolean).join('/')
  if (!key) {
    return new Response('Not found', { status: 404 })
  }

  const object = await env.MEDIA.get(key)
  if (!object) {
    return new Response('Not found', { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  // Five minutes, not immutable: a removed photo stops being served within that long.
  // There is no purge (no Cloudflare API token in Env), so the short life is the mechanism.
  headers.set('cache-control', 'public, max-age=300')
  // A contributor's upload is only ever an image. Whatever type R2 holds is passed through
  // when it is an image type and never as text/html; nosniff stops a browser guessing a
  // different one, and sandbox keeps any script in a file opened directly from running.
  const stored = headers.get('content-type') ?? ''
  if (!/^image\/[a-z0-9.+-]+$/i.test(stored)) headers.set('content-type', 'application/octet-stream')
  headers.set('x-content-type-options', 'nosniff')
  headers.set('content-security-policy', 'sandbox')

  return new Response(object.body, { headers })
}
