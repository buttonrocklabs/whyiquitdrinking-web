/** Pin id: lowercase letters, digits and hyphens, 3 to 64 characters. Anything else is never stored. */
export const PIN_ID_PATTERN = /^[a-z0-9-]{3,64}$/

export function isPinId(value: unknown): value is string {
  return typeof value === 'string' && PIN_ID_PATTERN.test(value)
}

/** Events a browser may post. 'submit' is written by the server when a story is stored, never by a client. */
export const CLIENT_PIN_EVENTS = ['visit', 'sm_click'] as const
export type ClientPinEvent = (typeof CLIENT_PIN_EVENTS)[number]

export function isClientPinEvent(value: unknown): value is ClientPinEvent {
  return typeof value === 'string' && (CLIENT_PIN_EVENTS as readonly string[]).includes(value)
}

/** Largest request body /api/pin-event reads, in bytes. A real body is under 100. */
export const MAX_PIN_EVENT_BODY = 512
