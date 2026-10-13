import { checkPair, takenOnValue } from '../../../shared/pair'
import { modeOf, type FlowData } from './types'

export const SERVER_ERROR = 'Something went wrong. Try again.'
export const MISSING_PHOTO = 'One of the photos still needs framing. Go back one step to frame it.'

/**
 * Built from flow state, field for field as the old single-page form built it, so the
 * server API and what it stores are unchanged. Pair-only fields go out in pair mode only,
 * and pins and sm_board only when switched on.
 */
export function buildBody(data: FlowData): FormData {
  const mode = modeOf(data)
  const body = new FormData()
  body.set('website', data.website)
  body.set('display_name', data.shareName ? data.name.trim() : '')
  body.set('story_text', data.story)
  body.set('consent', data.site ? 'true' : 'false')
  if (mode === 'pair') {
    const { before, after } = data.photos
    if (before?.baked) body.set('before_photo', before.baked)
    if (after?.baked) body.set('after_photo', after.baked)
    body.set('before_taken_on', takenOnValue(data.dates.before.year, data.dates.before.month))
    body.set('after_taken_on', takenOnValue(data.dates.after.year, data.dates.after.month))
    body.set('email', data.email.trim())
    body.set('adult', data.adult ? 'true' : 'false')
    if (data.pins) body.set('pins', 'true')
    if (data.smBoard) body.set('sm_board', 'true')
  } else if (mode === 'single' && data.photos.single?.baked) {
    body.set('photo', data.photos.single.baked)
  }
  return body
}

/** A problem the visitor can fix before anything is sent, as a message, or null when the data is ready. */
export function submitProblem(data: FlowData): string | null {
  const mode = modeOf(data)
  const slots = mode === 'pair' ? (['before', 'after'] as const) : mode === 'single' ? (['single'] as const) : []
  if (slots.some((key) => !data.photos[key]?.baked)) return MISSING_PHOTO
  if (mode !== 'pair') return null
  return checkPair({
    hasBeforePhoto: true,
    hasAfterPhoto: true,
    beforeTakenOn: takenOnValue(data.dates.before.year, data.dates.before.month),
    afterTakenOn: takenOnValue(data.dates.after.year, data.dates.after.month),
    email: data.email,
    adult: data.adult,
    now: new Date(),
  })
}

/** Posts the story. Resolves to the private manage token, or throws an Error whose message is the visitor-facing text. */
export async function sendStory(body: FormData): Promise<string> {
  let res: Response
  let data: { ok: boolean; error?: string; manageToken?: string }
  try {
    res = await fetch('/api/stories', { method: 'POST', body })
    data = await res.json()
  } catch {
    throw new Error(SERVER_ERROR)
  }
  if (!res.ok || !data.ok) throw new Error(data.error || SERVER_ERROR)
  return data.manageToken ?? ''
}
