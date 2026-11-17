import { isPinId } from '../../shared/pinEvents'

// Per-pin tracking (WIQD-17). The pin id lives in sessionStorage only: no cookie, no IP,
// nothing that identifies a visitor. Everything fails quiet; tracking never breaks the page.
const PIN_KEY = 'wiqd_pin'
const VISIT_KEY_PREFIX = 'wiqd_pin_visit:'

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // Storage blocked: the pin just is not remembered.
  }
}

/** The pin id remembered for this browser session, or null. */
export function getPin(): string | null {
  const stored = read(PIN_KEY)
  return isPinId(stored) ? stored : null
}

/** Posts one event. sendBeacon first so it survives leaving the page; fetch keepalive as the fallback. */
export function postPinEvent(pin: string, event: 'visit' | 'sm_click') {
  const payload = JSON.stringify({ pin, event })
  try {
    if (navigator.sendBeacon?.('/api/pin-event', payload)) return
    void fetch('/api/pin-event', { method: 'POST', body: payload, keepalive: true }).catch(() => {})
  } catch {
    // Advisory counts: a lost event is fine.
  }
}

/**
 * Runs once on page load, on any route. A valid utm_content is remembered for the session
 * and logs one visit per pin id per session; a different one replaces it and logs its own.
 */
export function capturePin() {
  let pin: string | null
  try {
    pin = new URLSearchParams(window.location.search).get('utm_content')
  } catch {
    return
  }
  if (!isPinId(pin)) return
  write(PIN_KEY, pin)
  const visitKey = VISIT_KEY_PREFIX + pin
  if (read(visitKey)) return
  write(visitKey, '1')
  postPinEvent(pin, 'visit')
}

/** The Sober Motivation link, with utm_content added when the session has a pin id. */
export function withPin(url: string): string {
  const pin = getPin()
  return pin ? `${url}&utm_content=${encodeURIComponent(pin)}` : url
}

/** Logs a Sober Motivation click for the session's pin. No pin id in the session logs nothing. */
export function trackSmClick() {
  const pin = getPin()
  if (pin) postPinEvent(pin, 'sm_click')
}
