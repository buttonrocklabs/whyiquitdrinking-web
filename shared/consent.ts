// Consent wording, shared by the Share form (what the visitor reads) and the
// POST /api/stories function (what gets stored). The server writes its own copy
// of these labels into story_consents.consent_text and never trusts text sent by
// the client, so change the wording here and bump CONSENT_VERSION together.

export const CONSENT_VERSION = '2026-10-13'

export type UseKey = 'site' | 'pins' | 'sm_board'
export type ConsentKey = UseKey | 'adult'

/** The uses a story can be shown under. 'site' is required for every story. */
export const USE_KEYS: readonly UseKey[] = ['site', 'pins', 'sm_board']

/** Display order on the form, and line order in consent_text. */
export const CONSENT_KEYS: readonly ConsentKey[] = ['adult', 'site', 'pins', 'sm_board']

export const CONSENT_LABELS: Record<ConsentKey, string> = {
  adult: "I'm 18 or older, and the photos are of me.",
  site: 'WIQD can show my story and photos on whyiquitdrinking.com.',
  pins: 'WIQD can use my photos on its own Pinterest pins and other social posts that link back to my story.',
  sm_board: 'WIQD can post one pin with my photos on the Sober Motivation Pinterest board.',
}

/** Shown under the boxes on every submission. */
export const CONSENT_NOTE =
  "I can remove my photos or my whole story at any time from the private link I get after I submit. WIQD deletes them from the site and takes down its own pins. Copies other people have already saved on Pinterest are outside WIQD's control. Photos are not retouched beyond crop and exposure."

export function isUseKey(value: unknown): value is UseKey {
  return USE_KEYS.includes(value as UseKey)
}
