// Text rules for the moderator's pin builder (WIQD-14): the default title, the alt text,
// the pin id and the tagged link. Pure functions, no DOM, so each rule reads on its own.
// Dates arrive as the stored 'YYYY-MM' taken-on strings.

import type { UseKey } from '../../shared/consent'
import type { StoryPhoto } from '@/components/StoryCard'

/** An approved story as GET /api/review/approved returns it. */
export interface ApprovedStory {
  id: string
  displayName: string | null
  approvedAt: string
  /** The use keys the contributor ticked. */
  uses: UseKey[]
  /** Before first. Withdrawn photos are never in the list. */
  photos: StoryPhoto[]
}

export const PIN_PHRASE = 'Before and After Quitting Drinking'
/** Pinterest's hard cap on a pin title. */
export const TITLE_MAX_CHARS = 100
/** The phrase has to start inside this many leading characters of the title. */
export const TITLE_PHRASE_WINDOW = 40
export const SITE_HOST = 'whyiquitdrinking.com'
/** Fixed, never window.location, so a pin made on a preview deploy still links to the live site. */
export const SITE_ORIGIN = `https://${SITE_HOST}`

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
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
const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
]

const TAKEN_ON = /^(\d{4})-(0[1-9]|1[0-2])$/

function parseTakenOn(takenOn: string): { year: number; month: number } | null {
  const match = TAKEN_ON.exec(takenOn)
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1 } : null
}

/** 'Mar 2026' for the date under each photo. */
export function shortMonthYear(takenOn: string): string {
  const parsed = parseTakenOn(takenOn)
  return parsed ? `${MONTHS_SHORT[parsed.month]} ${parsed.year}` : takenOn
}

/** 'March 2026' for the alt text. */
export function longMonthYear(takenOn: string): string {
  const parsed = parseTakenOn(takenOn)
  return parsed ? `${MONTHS_LONG[parsed.month]} ${parsed.year}` : takenOn
}

/** Whole calendar months from the before month to the after month. The day never matters, so nothing rounds. */
export function monthsBetween(beforeTakenOn: string, afterTakenOn: string): number {
  const before = parseTakenOn(beforeTakenOn)
  const after = parseTakenOn(afterTakenOn)
  if (!before || !after) return 0
  return Math.max(0, after.year * 12 + after.month - (before.year * 12 + before.month))
}

/** Under 24 months the gap is counted in months, from 24 up in whole years. */
const YEARS_FROM_MONTHS = 24

/** 'Before and After Quitting Drinking: 5 Months', with no duration when both photos share a month. */
export function defaultTitle(months: number): string {
  if (months <= 0) return PIN_PHRASE
  if (months < YEARS_FROM_MONTHS) return `${PIN_PHRASE}: ${months} ${months === 1 ? 'Month' : 'Months'}`
  const years = Math.floor(months / 12)
  return `${PIN_PHRASE}: ${years} ${years === 1 ? 'Year' : 'Years'}`
}

/** One to twelve spelled out, anything above in digits. */
function countWord(count: number): string {
  return count <= 12 ? NUMBER_WORDS[count] : String(count)
}

/** 'six months', '14 months', 'two years'. */
function gapWords(months: number): string {
  if (months < YEARS_FROM_MONTHS) return `${countWord(months)} ${months === 1 ? 'month' : 'months'}`
  const years = Math.floor(months / 12)
  return `${countWord(years)} ${years === 1 ? 'year' : 'years'}`
}

/**
 * Suggested alt text, built from the two dates and nothing else: never the display name,
 * the story text, or anything about appearance or health.
 */
export function defaultAltText(beforeTakenOn: string, afterTakenOn: string): string {
  const months = monthsBetween(beforeTakenOn, afterTakenOn)
  if (months === 0) {
    return `Two photos of the same person who quit drinking, both taken in ${longMonthYear(beforeTakenOn)}. Left: before. Right: after.`
  }
  return `Two photos of the same person who quit drinking, taken ${longMonthYear(beforeTakenOn)} and ${longMonthYear(afterTakenOn)}, ${gapWords(months)} apart. Left: before. Right: after.`
}

/** True when the text carries an em dash or an en dash. Hyphens are fine. */
export function hasDash(text: string): boolean {
  return /[–—]/.test(text)
}

/**
 * The warning for the 40-character rule, or null when the phrase starts inside the first
 * 40 characters. Warn only: the moderator can still download.
 */
export function titlePhraseWarning(title: string): string | null {
  const start = title.toLowerCase().indexOf(PIN_PHRASE.toLowerCase())
  if (start >= 0 && start < TITLE_PHRASE_WINDOW) return null
  return `The phrase "${PIN_PHRASE}" should start within the first ${TITLE_PHRASE_WINDOW} characters of the title.`
}

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz'

function randomBase36(length: number): string {
  let out = ''
  const bytes = new Uint8Array(1)
  while (out.length < length) {
    crypto.getRandomValues(bytes)
    // 252 is the largest multiple of 36 under 256, so every character is equally likely.
    if (bytes[0] < 252) out += BASE36[bytes[0] % 36]
  }
  return out
}

/**
 * '<first 8 of the story id>-<YYYYMMDD in UTC>-<3 random lowercase base36>'. Made when the
 * moderator picks a story and saved nowhere; building the same story twice gives two ids.
 */
export function newPinId(storyId: string, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10).replaceAll('-', '')
  return `${storyId.slice(0, 8)}-${day}-${randomBase36(3)}`
}

/** The absolute tagged link: utm_source and utm_content only. */
export function pinLink(storyId: string, pinId: string): string {
  return `${SITE_ORIGIN}/stories/${encodeURIComponent(storyId)}?utm_source=pinterest&utm_content=${encodeURIComponent(pinId)}`
}

/** A story can be pinned when the contributor ticked pins or the Sober Motivation board. */
export function canBuildPin(uses: readonly string[]): boolean {
  return uses.includes('pins') || uses.includes('sm_board')
}

export const USE_LABELS: Record<UseKey, string> = {
  site: 'Site',
  pins: 'Pins',
  sm_board: 'SM board',
}

/** The pair, before first, or null when either photo is missing. */
export function pairOf(photos: readonly StoryPhoto[]): { before: StoryPhoto; after: StoryPhoto } | null {
  const before = photos.find((photo) => photo.kind === 'before')
  const after = photos.find((photo) => photo.kind === 'after')
  return before && after ? { before, after } : null
}
