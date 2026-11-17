import { CLIENT_PIN_EVENTS, MAX_PIN_EVENT_BODY, isClientPinEvent, isPinId } from '../../shared/pinEvents'
import { json, type Env } from '../_lib'

/**
 * WIQD-17: one pin event from a browser. Body is JSON {"pin": "<pin id>", "event": "visit" | "sm_click"},
 * sent as text/plain by navigator.sendBeacon (so it needs no preflight). Stores the pin id,
 * the event name and the time, nothing about the sender: no IP, no user agent, no cookie.
 * 'submit' is written server-side by POST /api/stories, so a client-sent 'submit' is a 400.
 * No rate limit or origin check (nothing identifying is kept to key one on); counts are advisory.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_PIN_EVENT_BODY) return json({ ok: false, error: 'too large' }, { status: 413 })

  const text = await request.text()
  if (text.length > MAX_PIN_EVENT_BODY) return json({ ok: false, error: 'too large' }, { status: 413 })

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  const { pin, event } = (body && typeof body === 'object' ? body : {}) as { pin?: unknown; event?: unknown }

  if (!isPinId(pin)) return json({ ok: false, error: 'invalid pin' }, { status: 400 })
  if (!isClientPinEvent(event)) {
    return json({ ok: false, error: `event must be one of: ${CLIENT_PIN_EVENTS.join(', ')}` }, { status: 400 })
  }

  try {
    await env.DB.prepare('INSERT INTO pin_events (id, pin_id, event, story_id, created_at) VALUES (?, ?, ?, NULL, ?)')
      .bind(crypto.randomUUID(), pin, event, new Date().toISOString())
      .run()
  } catch (error) {
    console.error('pin event insert failed', error)
    return json({ ok: false, error: 'Something went wrong.' }, { status: 500 })
  }
  return new Response(null, { status: 204 })
}
