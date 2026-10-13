import { useEffect, useRef, useState } from 'react'
import {
  closePinPhotos,
  drawPin,
  loadPinFonts,
  loadPinPhotos,
  pinFontText,
  pinToPng,
  readPinColors,
  type PinPhotos,
} from '@/lib/pinCanvas'
import {
  TITLE_MAX_CHARS,
  defaultAltText,
  defaultTitle,
  hasDash,
  monthsBetween,
  newPinId,
  pinLink,
  titlePhraseWarning,
  type ApprovedStory,
} from '@/lib/pinText'
import type { StoryPhoto } from '@/components/StoryCard'

type CopyState = 'idle' | 'copied' | 'failed'

/**
 * Copies through a selected, off-screen textarea. The fallback for a browser or embedded
 * view that refuses navigator.clipboard (it denies the permission), where a click is still
 * allowed to copy. Returns whether the browser reported success.
 */
function copyBySelection(text: string): boolean {
  const previous = document.activeElement
  const field = document.createElement('textarea')
  field.value = text
  field.readOnly = true
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.append(field)
  field.select()
  try {
    return document.execCommand('copy')
  } finally {
    field.remove()
    if (previous instanceof HTMLElement) previous.focus()
  }
}

function CopyButton({ text, label, disabled = false }: { text: string; label: string; disabled?: boolean }) {
  const [state, setState] = useState<CopyState>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = window.setTimeout(() => setState('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [state])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState(copyBySelection(text) ? 'copied' : 'failed')
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || text === ''}
      aria-label={`Copy ${label}`}
      className="min-h-11 shrink-0 rounded-md border border-line-strong bg-surface-raised px-4 py-2 text-label text-ink hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
    </button>
  )
}

const FIELD_CLASS = 'w-full rounded-md border border-line bg-surface-raised px-4 py-2 text-body text-ink'

interface PinBuilderProps {
  story: ApprovedStory
  before: StoryPhoto
  after: StoryPhoto
  onBack: () => void
}

/**
 * Builds one pin from one approved story. The parent keys it by story id and unmounts it on
 * Back, so every pick starts a fresh instance with a fresh pin id. Nothing is saved.
 */
export default function PinBuilder({ story, before, after, onBack }: PinBuilderProps) {
  const [pinId] = useState(() => newPinId(story.id))
  const [title, setTitle] = useState(() => defaultTitle(monthsBetween(before.takenOn, after.takenOn)))
  const [altText, setAltText] = useState(() => defaultAltText(before.takenOn, after.takenOn))
  const [photos, setPhotos] = useState<PinPhotos | null>(null)
  const [photoError, setPhotoError] = useState(false)
  const [drawError, setDrawError] = useState('')
  // The title the canvas currently shows. Download waits until it matches the field.
  const [drawnTitle, setDrawnTitle] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let loaded: PinPhotos | null = null
    loadPinPhotos(before.url, after.url).then(
      (result) => {
        if (cancelled) {
          closePinPhotos(result)
          return
        }
        loaded = result
        setPhotos(result)
      },
      () => {
        if (!cancelled) setPhotoError(true)
      }
    )
    return () => {
      cancelled = true
      if (loaded) closePinPhotos(loaded)
    }
  }, [before.url, after.url])

  // Redraws on every title change. Fonts load first, for the characters about to be drawn,
  // and a pin is never drawn in a fallback face.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!photos || !canvas) return
    let cancelled = false
    ;(async () => {
      const fontsReady = await loadPinFonts(pinFontText(title, before.takenOn, after.takenOn))
      if (cancelled) return
      if (!fontsReady) {
        setDrawError('The pin fonts did not load. Reload the page and try again.')
        return
      }
      try {
        drawPin(canvas, {
          title,
          beforeTakenOn: before.takenOn,
          afterTakenOn: after.takenOn,
          photos,
          colors: readPinColors(),
        })
        setDrawError('')
        setDrawnTitle(title)
      } catch {
        setDrawError('The pin could not be drawn. Reload the page and try again.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [photos, title, before.takenOn, after.takenOn])

  const link = pinLink(story.id, pinId)
  const titleHasDash = hasDash(title)
  const altHasDash = hasDash(altText)
  const titleEmpty = title.trim() === ''
  const phraseWarning = titleEmpty ? null : titlePhraseWarning(title)
  const canDownload = drawnTitle === title && drawError === '' && !titleEmpty && !titleHasDash && !altHasDash

  async function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    setDownloadError('')
    try {
      const blob = await pinToPng(canvas)
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `wiqd-pin-${pinId}.png`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 30_000)
    } catch {
      setDownloadError('The PNG could not be made. Try again.')
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 text-label text-brand underline"
      >
        Back to stories
      </button>

      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={1000}
              height={1500}
              aria-label="Pin preview"
              className="aspect-[2/3] w-full rounded-md border border-line bg-surface-raised"
            />
            {!photos && !photoError && (
              <p className="absolute inset-0 flex items-center justify-center text-body text-ink-muted">
                Loading photos.
              </p>
            )}
          </div>
          {photoError && (
            <p className="mt-3 text-body text-alert" role="alert">
              The photos did not load. Go back and try again.
            </p>
          )}
          {drawError && (
            <p className="mt-3 text-body text-alert" role="alert">
              {drawError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <label htmlFor="pin-title" className="text-label text-ink">
              Title
            </label>
            <input
              id="pin-title"
              type="text"
              value={title}
              maxLength={TITLE_MAX_CHARS}
              onChange={(event) => setTitle(event.target.value)}
              className={`mt-1 ${FIELD_CLASS}`}
            />
            <p className="mt-1 text-caption text-ink-muted">
              {title.length} of {TITLE_MAX_CHARS} characters
            </p>
            {phraseWarning && <p className="mt-1 text-caption text-ink">{phraseWarning}</p>}
            {titleHasDash && (
              <p className="mt-1 text-caption text-alert" role="alert">
                The title has an em or en dash. Remove it to download. A comma, a colon or a hyphen works.
              </p>
            )}
            {titleEmpty && <p className="mt-1 text-caption text-alert">Add a title to download the pin.</p>}
          </div>

          <div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!canDownload}
              className="min-h-11 rounded-md bg-brand px-5 py-2 text-label text-on-brand hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download PNG
            </button>
            {downloadError && (
              <p className="mt-2 text-caption text-alert" role="alert">
                {downloadError}
              </p>
            )}
          </div>

          <div>
            <p className="text-label text-ink">Pin id</p>
            <div className="mt-1 flex items-center gap-3">
              <code className="min-w-0 flex-1 break-all rounded-md border border-line bg-surface-raised px-4 py-2 text-body text-ink">
                {pinId}
              </code>
              <CopyButton text={pinId} label="pin id" />
            </div>
          </div>

          <div>
            <p className="text-label text-ink">Tagged link</p>
            <div className="mt-1 flex items-start gap-3">
              <code className="min-w-0 flex-1 break-all rounded-md border border-line bg-surface-raised px-4 py-2 text-body text-ink">
                {link}
              </code>
              <CopyButton text={link} label="tagged link" />
            </div>
          </div>

          <div>
            <label htmlFor="pin-alt" className="text-label text-ink">
              Alt text
            </label>
            <div className="mt-1 flex items-start gap-3">
              <textarea
                id="pin-alt"
                rows={5}
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
                className={`min-w-0 flex-1 ${FIELD_CLASS}`}
              />
              <CopyButton text={altText} label="alt text" disabled={altHasDash} />
            </div>
            {altHasDash && (
              <p className="mt-1 text-caption text-alert" role="alert">
                The alt text has an em or en dash. Remove it to copy it or download.
              </p>
            )}
          </div>

          {!story.uses.includes('pins') && (
            <p className="text-caption text-ink-muted">
              This story allows one pin, on the Sober Motivation board only.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
