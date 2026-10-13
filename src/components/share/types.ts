import { DEFAULT_VIEW, PAIR_FRAME, SINGLE_FRAME, type FrameSpec, type FrameView } from '@/lib/photo'

export type PhotoKey = 'before' | 'after' | 'single'
export type StepId = 'photos' | 'frame' | 'dates' | 'story' | 'privacy' | 'review'

/** pair: before and after. single: one photo. none: a story with no photos. */
export type Mode = 'pair' | 'single' | 'none'

/** A photo that passed the pick-time checks, plus where the visitor has framed it. */
export interface PhotoEntry {
  /** The cleaned JPEG (no location or camera data). Framing always starts from this. */
  clean: File
  width: number
  height: number
  view: FrameView
  /** The framed JPEG that gets uploaded. Null until the frame step bakes it, and again after any change. */
  baked: File | null
}

export interface MonthYear {
  year: string
  /** '01' to '12', as takenOnValue expects. */
  month: string
}

export interface FlowData {
  /** What the step-1 control shows. */
  choice: 'pair' | 'single'
  /** The "Just write my story" link was used, so the flow runs in none mode. */
  skipped: boolean
  /** Kept for all three slots at all times; only the active mode's slots are shown and sent. */
  photos: Record<PhotoKey, PhotoEntry | null>
  /** Slots whose picked file is still being cleaned. Continue on the photos step waits for these. */
  cleaning: Record<PhotoKey, boolean>
  dates: Record<'before' | 'after', MonthYear>
  story: string
  shareName: boolean
  name: string
  site: boolean
  adult: boolean
  pins: boolean
  smBoard: boolean
  email: string
  /** Honeypot: real visitors never fill it. */
  website: string
}

export const EMPTY_FLOW: FlowData = {
  choice: 'pair',
  skipped: false,
  photos: { before: null, after: null, single: null },
  cleaning: { before: false, after: false, single: false },
  dates: { before: { year: '', month: '' }, after: { year: '', month: '' } },
  story: '',
  shareName: false,
  name: '',
  site: false,
  adult: false,
  pins: false,
  smBoard: false,
  email: '',
  website: '',
}

export const STEPS: Record<Mode, StepId[]> = {
  pair: ['photos', 'frame', 'dates', 'story', 'privacy', 'review'],
  single: ['photos', 'frame', 'story', 'privacy', 'review'],
  none: ['story', 'privacy', 'review'],
}

export function modeOf(data: Pick<FlowData, 'choice' | 'skipped'>): Mode {
  return data.skipped ? 'none' : data.choice
}

/** The photo slots the mode uses, in display order. */
export function slotsOf(mode: Mode): PhotoKey[] {
  if (mode === 'pair') return ['before', 'after']
  return mode === 'single' ? ['single'] : []
}

export function frameOf(key: PhotoKey): FrameSpec {
  return key === 'single' ? SINGLE_FRAME : PAIR_FRAME
}

export function newEntry(clean: File, width: number, height: number): PhotoEntry {
  return { clean, width, height, view: DEFAULT_VIEW, baked: null }
}

export const STORY_MAX_CHARS = 4000

/**
 * The story's length as the server counts it. The upload is multipart, which sends every line break as
 * CRLF, so each "\n" in the field is two characters on the wire. The server rejects more than
 * STORY_MAX_CHARS of those, so the field is held to the same count.
 */
export function storyLength(text: string): number {
  let length = text.length
  for (let index = 0; index < text.length; index++) if (text[index] === '\n') length++
  return length
}

/**
 * Fits an edited story back under the limit the way a maxLength would: the surplus comes off the end of
 * what was just typed or pasted (the text before the caret), so text further on is never lost. Returns
 * the text and where the caret belongs in it.
 */
export function fitStory(raw: string, caret: number): { text: string; caret: number } {
  let excess = storyLength(raw) - STORY_MAX_CHARS
  if (excess <= 0) return { text: raw, caret }
  let cut = Math.min(caret, raw.length)
  while (cut > 0 && excess > 0) {
    cut--
    excess -= raw[cut] === '\n' ? 2 : 1
  }
  // Never leave the first half of an emoji behind.
  const before = cut > 0 ? raw.charCodeAt(cut - 1) : 0
  if (before >= 0xd800 && before <= 0xdbff) cut--
  return { text: raw.slice(0, cut) + raw.slice(Math.min(caret, raw.length)), caret: cut }
}
export const NAME_MAX_CHARS = 100

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
