import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'
import { isHeicFile, prepareImage } from '@/lib/photo'
import { CONSENT_LABELS, CONSENT_NOTE } from '../../shared/consent'
import {
  MAX_PHOTO_BYTES,
  MAX_SOURCE_BYTES,
  PAIR_MIN_YEAR,
  PHOTO_ERRORS,
  checkPair,
  takenOnValue,
} from '../../shared/pair'

type SubmitState = 'idle' | 'submitting' | 'done' | 'error'

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'
const PHOTO_HELP = 'JPEG, PNG or WebP. We remove location data and shrink large photos for you.'
const SERVER_ERROR = 'Something went wrong. Try again.'

type PhotoSlot = 'before' | 'after' | 'single'

const MONTHS = [
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

// Newest year first, up to the current year in UTC (the function judges "future" in UTC too).
const THIS_YEAR = new Date().getUTCFullYear()
const YEARS = Array.from({ length: THIS_YEAR - PAIR_MIN_YEAR + 1 }, (_, i) => THIS_YEAR - i)

interface PairState {
  before: File | null
  after: File | null
  beforeMonth: string
  beforeYear: string
  afterMonth: string
  afterYear: string
  email: string
  adult: boolean
  pins: boolean
  smBoard: boolean
}

const EMPTY_PAIR: PairState = {
  before: null,
  after: null,
  beforeMonth: '',
  beforeYear: '',
  afterMonth: '',
  afterYear: '',
  email: '',
  adult: false,
  pins: false,
  smBoard: false,
}

const FIELD_CLASS = 'rounded-md border border-line bg-surface-raised px-4 py-2 text-body text-ink'

function Check({
  id,
  checked,
  onChange,
  required,
  children,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="flex items-start gap-3 text-body text-ink-muted">
      <input
        id={id}
        name={id}
        type="checkbox"
        required={required}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      {children}
    </label>
  )
}

function PhotoField({
  kind,
  label,
  month,
  year,
  inputKey,
  onFile,
  onMonth,
  onYear,
}: {
  kind: 'before' | 'after'
  label: string
  month: string
  year: string
  inputKey: number
  onFile: (file: File | null) => void
  onMonth: (month: string) => void
  onYear: (year: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${kind}_photo`} className="text-label text-ink">
          {label}
        </label>
        <input
          // A new key mounts a fresh, empty picker, which is how a refused photo gets cleared.
          key={inputKey}
          id={`${kind}_photo`}
          name={`${kind}_photo`}
          type="file"
          accept={PHOTO_ACCEPT}
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          className="text-body text-ink-muted"
        />
      </div>
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-label text-ink">When was it taken?</legend>
        <div className="flex gap-2">
          <select
            aria-label={`${label}, month`}
            value={month}
            onChange={(event) => onMonth(event.target.value)}
            className={`${FIELD_CLASS} min-w-0 flex-1 px-2`}
          >
            <option value="">Month</option>
            {MONTHS.map((name, index) => (
              <option key={name} value={String(index + 1).padStart(2, '0')}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label={`${label}, year`}
            value={year}
            onChange={(event) => onYear(event.target.value)}
            className={`${FIELD_CLASS} w-[5.5rem] px-2`}
          >
            <option value="">Year</option>
            {YEARS.map((value) => (
              <option key={value} value={String(value)}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    </div>
  )
}

export default function Share() {
  const [searchParams] = useSearchParams()
  const wantsPair = searchParams.get('pair') === '1'
  const pairRef = useRef<HTMLDetailsElement>(null)

  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [manageUrl, setManageUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [storyText, setStoryText] = useState('')
  const [singlePhoto, setSinglePhoto] = useState<File | null>(null)
  const [siteConsent, setSiteConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [pairOpen, setPairOpen] = useState(wantsPair)
  const [pair, setPair] = useState<PairState>(EMPTY_PAIR)
  const [pickerKeys, setPickerKeys] = useState<Record<PhotoSlot, number>>({
    before: 0,
    after: 0,
    single: 0,
  })

  function patchPair(patch: Partial<PairState>) {
    setPair((prev) => ({ ...prev, ...patch }))
  }

  // With the pair section open the single photo input is gone, so drop whatever it held.
  function handlePairToggle(open: boolean) {
    setPairOpen(open)
    if (open) setSinglePhoto(null)
  }

  // /share?pair=1 (linked from the storyboard) opens the section and scrolls to it. The
  // first render is already open; setting the element's own flag covers arriving on
  // ?pair=1 from another /share URL, and its toggle event keeps the state in step.
  useEffect(() => {
    const details = pairRef.current
    if (!wantsPair || !details) return
    details.open = true
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    details.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }, [wantsPair])

  function fail(message: string) {
    setErrorMessage(message)
    setState('error')
  }

  // A refused photo leaves both the form state and its file picker, so the visitor picks another.
  function dropPhoto(slot: PhotoSlot) {
    if (slot === 'single') setSinglePhoto(null)
    else patchPair(slot === 'before' ? { before: null } : { after: null })
    setPickerKeys((prev) => ({ ...prev, [slot]: prev[slot] + 1 }))
  }

  // Redraws one photo as a clean JPEG (no location or camera data) and checks its new size.
  // On any refusal it shows the message, drops the photo and reports false; the original
  // file is never what gets sent.
  async function cleanPhoto(slot: PhotoSlot, file: File | null): Promise<File | null | false> {
    if (!file) return null
    let clean: File
    try {
      clean = await prepareImage(file)
    } catch {
      dropPhoto(slot)
      fail(isHeicFile(file) ? PHOTO_ERRORS.heic : PHOTO_ERRORS.type)
      return false
    }
    if (clean.size > MAX_PHOTO_BYTES) {
      dropPhoto(slot)
      fail(PHOTO_ERRORS.size)
      return false
    }
    return clean
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setErrorMessage('')

    // The pair goes out when the section is open and anything in it was filled in.
    const beforeTakenOn = takenOnValue(pair.beforeYear, pair.beforeMonth)
    const afterTakenOn = takenOnValue(pair.afterYear, pair.afterMonth)
    const sendPair =
      pairOpen &&
      (pair.before !== null ||
        pair.after !== null ||
        pair.beforeMonth !== '' ||
        pair.beforeYear !== '' ||
        pair.afterMonth !== '' ||
        pair.afterYear !== '')

    if (sendPair) {
      const problem = checkPair({
        hasBeforePhoto: pair.before !== null,
        hasAfterPhoto: pair.after !== null,
        beforeTakenOn,
        afterTakenOn,
        email: pair.email,
        adult: pair.adult,
        now: new Date(),
      })
      if (problem) return fail(problem)
    }

    // Source cap first, before anything is decoded. What goes out is the re-encoded copy,
    // which the function still holds to MAX_PHOTO_BYTES.
    const picked: [PhotoSlot, File | null][] = sendPair
      ? [
          ['before', pair.before],
          ['after', pair.after],
        ]
      : [['single', singlePhoto]]
    for (const [slot, file] of picked) {
      if (file && file.size > MAX_SOURCE_BYTES) {
        dropPhoto(slot)
        return fail(PHOTO_ERRORS.sourceSize)
      }
    }

    // One at a time keeps a pair of large photos from sitting decoded in memory together.
    const before = sendPair ? await cleanPhoto('before', pair.before) : null
    if (before === false) return
    const after = sendPair ? await cleanPhoto('after', pair.after) : null
    if (after === false) return
    const photo = sendPair ? null : await cleanPhoto('single', singlePhoto)
    if (photo === false) return

    // Built from state, not from the DOM form: a closed <details> still submits its fields.
    const body = new FormData()
    body.set('website', website)
    body.set('display_name', displayName)
    body.set('story_text', storyText)
    body.set('consent', siteConsent ? 'true' : 'false')
    if (sendPair) {
      if (before) body.set('before_photo', before)
      if (after) body.set('after_photo', after)
      body.set('before_taken_on', beforeTakenOn)
      body.set('after_taken_on', afterTakenOn)
      body.set('email', pair.email.trim())
      body.set('adult', pair.adult ? 'true' : 'false')
      if (pair.pins) body.set('pins', 'true')
      if (pair.smBoard) body.set('sm_board', 'true')
    } else if (photo) {
      body.set('photo', photo)
    }

    try {
      const res = await fetch('/api/stories', { method: 'POST', body })
      const data = (await res.json()) as { ok: boolean; error?: string; manageToken?: string }
      if (!res.ok || !data.ok) return fail(data.error || SERVER_ERROR)
      if (data.manageToken) setManageUrl(`${window.location.origin}/manage/${data.manageToken}`)
      setState('done')
    } catch {
      fail(SERVER_ERROR)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(manageUrl)
      setCopied(true)
    } catch {
      // The link is selectable on screen, so a blocked clipboard costs nothing.
    }
  }

  if (state === 'done') {
    return (
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1">
          <section className="mx-auto max-w-xl px-6 py-24 text-center">
            <h1 className="font-serif text-h1 text-ink">Thank you.</h1>
            <p className="mt-4 text-body text-ink-muted">
              Your story is in the queue for review. Once it's approved, it'll show up on the
              homepage.
            </p>

            {manageUrl && (
              <div className="mt-10 rounded-md border border-line bg-surface-raised p-6 text-left">
                <h2 className="font-serif text-h2 text-ink">Your private link</h2>
                <p className="mt-2 text-body text-ink-muted">
                  Save this link. It lets you remove your photos or your whole story at any time.
                  Anyone who has it can do the same, so keep it to yourself.
                </p>
                <p className="mt-4 select-all break-all rounded-sm bg-surface px-3 py-2 text-label text-ink">
                  {manageUrl}
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  className="mt-4 rounded-md bg-brand px-4 py-2 text-label text-on-brand transition-colors hover:bg-brand/90"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
            )}
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />

      <main className="flex-1">
        <section className="mx-auto max-w-xl px-6 py-16">
          <h1 className="font-serif text-h1 text-ink">Share your why</h1>
          <p className="mt-3 text-body text-ink-muted">
            Tell us why you quit or why you're questioning your drinking. A real person reviews
            every story before it goes public.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="display_name" className="text-label text-ink">
                Name (optional)
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                maxLength={100}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="First name or leave blank to stay anonymous"
                className={FIELD_CLASS}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="story_text" className="text-label text-ink">
                Your story
              </label>
              <textarea
                id="story_text"
                name="story_text"
                required
                rows={8}
                maxLength={4000}
                value={storyText}
                onChange={(event) => setStoryText(event.target.value)}
                placeholder="What was it that made you decide to quit?"
                className={FIELD_CLASS}
              />
            </div>

            {!pairOpen && (
              <div className="flex flex-col gap-2">
                <label htmlFor="photo" className="text-label text-ink">
                  Photo (optional)
                </label>
                <input
                  key={pickerKeys.single}
                  id="photo"
                  name="photo"
                  type="file"
                  accept={PHOTO_ACCEPT}
                  onChange={(event) => setSinglePhoto(event.target.files?.[0] ?? null)}
                  className="text-body text-ink-muted"
                />
                <p className="text-caption text-ink-muted">{PHOTO_HELP}</p>
              </div>
            )}

            <details
              ref={pairRef}
              id="pair"
              open={pairOpen}
              onToggle={(event) => handlePairToggle(event.currentTarget.open)}
              className="group scroll-mt-6 rounded-md border border-line bg-surface-raised"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-label text-ink [&::-webkit-details-marker]:hidden">
                <span>Add a before and after photo (optional)</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                >
                  <path d="M5 8l5 5 5-5" />
                </svg>
              </summary>

              <div className="flex flex-col gap-6 border-t border-line px-4 py-5">
                <p className="text-body text-ink-muted">
                  Two photos of you, one from before you quit and one from now, with the month each
                  was taken. We use your email to send your private link.
                </p>

                <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-4">
                  <PhotoField
                    kind="before"
                    label="Before photo"
                    month={pair.beforeMonth}
                    year={pair.beforeYear}
                    inputKey={pickerKeys.before}
                    onFile={(file) => patchPair({ before: file })}
                    onMonth={(month) => patchPair({ beforeMonth: month })}
                    onYear={(year) => patchPair({ beforeYear: year })}
                  />
                  <PhotoField
                    kind="after"
                    label="After photo"
                    month={pair.afterMonth}
                    year={pair.afterYear}
                    inputKey={pickerKeys.after}
                    onFile={(file) => patchPair({ after: file })}
                    onMonth={(month) => patchPair({ afterMonth: month })}
                    onYear={(year) => patchPair({ afterYear: year })}
                  />
                </div>
                <p className="-mt-3 text-caption text-ink-muted">{PHOTO_HELP}</p>

                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="text-label text-ink">
                    Email (private)
                  </label>
                  <input
                    id="email"
                    name="email"
                    // A closed <details> hides this input, and the browser refuses to submit over an
                    // invalid control it cannot focus, with no message. Type validation applies only
                    // while the section is open. Closed, the pair is not sent, so nothing to check.
                    type={pairOpen ? 'email' : 'text'}
                    maxLength={254}
                    autoComplete="email"
                    value={pair.email}
                    onChange={(event) => patchPair({ email: event.target.value })}
                    placeholder="For your private link"
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
            </details>

            {/* Honeypot: hidden from real visitors, most bots fill every field they see in the DOM. */}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>

            <div role="group" aria-label="What I agree to" className="flex flex-col gap-3">
              {pairOpen && (
                <Check id="adult" checked={pair.adult} onChange={(adult) => patchPair({ adult })}>
                  {CONSENT_LABELS.adult}
                </Check>
              )}
              <Check id="consent" required checked={siteConsent} onChange={setSiteConsent}>
                {CONSENT_LABELS.site}
              </Check>
              {pairOpen && (
                <>
                  <Check id="pins" checked={pair.pins} onChange={(pins) => patchPair({ pins })}>
                    {CONSENT_LABELS.pins}
                  </Check>
                  <Check
                    id="sm_board"
                    checked={pair.smBoard}
                    onChange={(smBoard) => patchPair({ smBoard })}
                  >
                    {CONSENT_LABELS.sm_board}
                  </Check>
                </>
              )}
            </div>

            <p className="text-caption text-ink-muted">{CONSENT_NOTE}</p>

            {state === 'error' && <p className="text-body text-alert">{errorMessage}</p>}

            <button
              type="submit"
              disabled={state === 'submitting'}
              className="rounded-md bg-brand px-8 py-3 text-label text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {state === 'submitting' ? 'Submitting…' : 'Submit your story'}
            </button>
          </form>
        </section>
      </main>

      <Footer />
    </div>
  )
}
