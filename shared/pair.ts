// Before-and-after pair rules, shared by the Share form (checks before it
// uploads) and the POST /api/stories function (the check that counts). Messages
// are shown to visitors as written.

export const PAIR_MIN_YEAR = 2000
export const EMAIL_MAX_CHARS = 254
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024

export const PAIR_ERRORS = {
  both: 'Add both photos and when each was taken.',
  future: 'Please choose a month and year that are not in the future.',
  order: 'The after photo needs to be from the same month as the before photo or later.',
  emailMissing: 'Please add an email so we can send your private link.',
  emailInvalid: 'That email address does not look right.',
  adult: 'Please confirm you are 18 or older.',
  mixed: 'Please send either one photo or a before and after pair.',
} as const

export const PHOTO_ERRORS = {
  type: 'Please upload a JPEG, PNG or WebP photo.',
  heic: 'That photo is in HEIC format. Please export it as a JPEG and try again.',
  size: 'Photos can be up to 8MB.',
} as const

const TAKEN_ON = /^(\d{4})-(0[1-9]|1[0-2])$/

/** 'YYYY-MM' to a comparable month count, or null when it is not a valid month. */
function monthIndex(takenOn: string): number | null {
  const match = TAKEN_ON.exec(takenOn)
  if (!match) return null
  return Number(match[1]) * 12 + (Number(match[2]) - 1)
}

export function takenOnValue(year: string, month: string): string {
  return year && month ? `${year}-${month.padStart(2, '0')}` : ''
}

export function isPlausibleEmail(email: string): boolean {
  return email.length <= EMAIL_MAX_CHARS && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export interface PairInput {
  hasBeforePhoto: boolean
  hasAfterPhoto: boolean
  beforeTakenOn: string
  afterTakenOn: string
  email: string
  adult: boolean
  now: Date
}

/** True when anything pair-shaped was sent; the full set is then required. */
export function hasPairInput(
  input: Pick<PairInput, 'hasBeforePhoto' | 'hasAfterPhoto' | 'beforeTakenOn' | 'afterTakenOn'>
): boolean {
  return (
    input.hasBeforePhoto || input.hasAfterPhoto || input.beforeTakenOn !== '' || input.afterTakenOn !== ''
  )
}

/** First problem with a pair submission, as a visitor-facing message, or null when it is complete. */
export function checkPair(input: PairInput): string | null {
  if (
    !input.hasBeforePhoto ||
    !input.hasAfterPhoto ||
    input.beforeTakenOn === '' ||
    input.afterTakenOn === ''
  ) {
    return PAIR_ERRORS.both
  }

  const before = monthIndex(input.beforeTakenOn)
  const after = monthIndex(input.afterTakenOn)
  // The current month is read in UTC on both sides so the form never offers
  // a month the function would then call future.
  const current = input.now.getUTCFullYear() * 12 + input.now.getUTCMonth()
  const earliest = PAIR_MIN_YEAR * 12
  if (before === null || after === null) return PAIR_ERRORS.future
  if (before < earliest || after < earliest || before > current || after > current) {
    return PAIR_ERRORS.future
  }
  if (after < before) return PAIR_ERRORS.order

  const email = input.email.trim()
  if (email === '') return PAIR_ERRORS.emailMissing
  if (!isPlausibleEmail(email)) return PAIR_ERRORS.emailInvalid

  if (!input.adult) return PAIR_ERRORS.adult
  return null
}
