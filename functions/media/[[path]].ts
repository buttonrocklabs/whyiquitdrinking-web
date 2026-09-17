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
  headers.set('cache-control', 'public, max-age=31536000, immutable')

  return new Response(object.body, { headers })
}
