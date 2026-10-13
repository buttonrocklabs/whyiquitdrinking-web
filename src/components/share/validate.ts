import { PAIR_ERRORS, checkPair, takenOnValue } from '../../../shared/pair'
import { modeOf, slotsOf, STEPS, type FlowData, type StepId } from './types'

export const PREPARING_PHOTO = 'Hang on, still preparing your photo.'

/** The real pair check, with the visitor's own photos, dates, email and 18+ answer. */
function pairProblem(data: FlowData): string | null {
  return checkPair({
    hasBeforePhoto: data.photos.before !== null,
    hasAfterPhoto: data.photos.after !== null,
    beforeTakenOn: takenOnValue(data.dates.before.year, data.dates.before.month),
    afterTakenOn: takenOnValue(data.dates.after.year, data.dates.after.month),
    email: data.email,
    adult: data.adult,
    now: new Date(),
  })
}

/** The date rules only, so the dates step does not complain about an email the visitor has not reached yet. */
function datesProblem(data: FlowData): string | null {
  const before = takenOnValue(data.dates.before.year, data.dates.before.month)
  const after = takenOnValue(data.dates.after.year, data.dates.after.month)
  if (!before || !after) return 'Add the month for each photo.'
  // checkPair also wants photos, an email and the 18+ answer. Those are checked on their own
  // steps, so placeholders that satisfy them keep any message here about the dates.
  return checkPair({
    hasBeforePhoto: true,
    hasAfterPhoto: true,
    beforeTakenOn: before,
    afterTakenOn: after,
    email: 'a@b.co',
    adult: true,
    now: new Date(),
  })
}

/**
 * Why Continue is off on this step, in plain words, or null when the visitor can go on.
 * The frame step is never blocked: Continue is what bakes the framed photos.
 */
export function stepProblem(step: StepId, data: FlowData): string | null {
  const mode = modeOf(data)
  switch (step) {
    case 'photos': {
      const slots = slotsOf(mode)
      // A photo still being cleaned has no framed entry yet, or is about to replace the one shown.
      if (slots.some((key) => data.cleaning[key])) return PREPARING_PHOTO
      const missing = slots.some((key) => data.photos[key] === null)
      if (!missing) return null
      return mode === 'pair' ? 'Add both photos to continue.' : 'Add a photo to continue.'
    }
    case 'dates':
      return datesProblem(data)
    case 'story':
      if (data.story.trim() === '') return 'Write a few words to continue.'
      if (data.shareName && data.name.trim() === '') return 'Add your first name, or turn that switch off.'
      return null
    case 'privacy':
      if (mode === 'pair' && !data.adult) return PAIR_ERRORS.adult
      if (!data.site) return 'Turn on the site switch to continue.'
      return mode === 'pair' ? pairProblem(data) : null
    default:
      return null
  }
}

/** Whether a step has everything it needs. Unlike stepProblem, the frame step needs its baked photos. */
export function stepDone(step: StepId, data: FlowData): boolean {
  if (step === 'frame') return slotsOf(modeOf(data)).every((key) => data.photos[key]?.baked)
  return stepProblem(step, data) === null
}

/** Whether the visitor has entered anything yet, for the leave-the-page warning. */
export function hasEntries(data: FlowData): boolean {
  const { before, after } = data.dates
  return (
    Object.values(data.photos).some((entry) => entry !== null) ||
    [before.year, before.month, after.year, after.month, data.story, data.name, data.email].some(
      (text) => text.trim() !== ''
    ) ||
    data.site ||
    data.adult ||
    data.pins ||
    data.smBoard
  )
}

/** The first step in this mode, before review, that is not complete yet, or null when all are. */
export function firstIncomplete(data: FlowData): StepId | null {
  return STEPS[modeOf(data)].find((step) => step !== 'review' && !stepDone(step, data)) ?? null
}
