import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { PHOTO_ACCEPT } from '@/lib/photo'
import PhotoThumb from './PhotoThumb'

// min-w-0 and the tighter padding below sm keep two buttons inside a half-width slot on a 375px phone.
const SMALL_BUTTON =
  'min-h-11 min-w-0 cursor-pointer rounded-md border border-line bg-surface-raised px-2 text-label text-ink transition-colors hover:bg-surface sm:px-3'

/**
 * One photo slot, shaped like the frame it will fill on the board. Empty it is a big tap
 * target (and a drop target on desktop) that opens the file picker. Filled it shows the
 * cleaned photo with Replace and Remove. A refusal shows its message inside the slot.
 */
export default function PhotoSlot({
  label,
  aspectClass,
  file,
  cleaning,
  error,
  onFile,
  onRemove,
}: {
  label: string
  /** Tailwind aspect class for the slot, matching the board's frame. */
  aspectClass: string
  /** The cleaned photo in this slot, or null when empty. */
  file: File | null
  cleaning: boolean
  error: string
  onFile: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const replaceRef = useRef<HTMLButtonElement>(null)
  const errorId = useId()
  const [dragging, setDragging] = useState(false)
  // Set when the visitor adds, replaces or removes a photo here. The button they used unmounts or goes
  // off while the photo is prepared, so once the slot settles focus moves to the button that fits.
  const refocus = useRef(false)

  // "Before" reads as "before photo"; a label that already says photo ("Your photo") is used as is.
  const subject = /photo$/i.test(label) ? label.toLowerCase() : `${label.toLowerCase()} photo`

  useEffect(() => {
    if (cleaning || !refocus.current) return
    refocus.current = false
    ;(file ? replaceRef.current : addRef.current)?.focus()
  }, [cleaning, file])

  function choose() {
    inputRef.current?.click()
  }

  function pickFile(picked: File) {
    refocus.current = true
    onFile(picked)
  }

  function remove() {
    refocus.current = true
    onRemove()
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files[0]
    if (dropped && !cleaning) pickFile(dropped)
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-label text-ink">{label}</p>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative w-full overflow-hidden rounded-md border-2 ${aspectClass} ${
          file ? 'border-line' : dragging ? 'border-brand bg-brand-soft' : 'border-dashed border-line-strong bg-surface'
        }`}
      >
        {file ? (
          <PhotoThumb file={file} className="h-full w-full" />
        ) : (
          <button
            ref={addRef}
            type="button"
            onClick={choose}
            disabled={cleaning}
            // Starts with the words on the button, so the name still matches what a sighted visitor reads.
            aria-label={`${error ? 'Choose another' : 'Add photo'}, ${label.toLowerCase()}`}
            aria-describedby={error ? errorId : undefined}
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 p-3 text-center"
          >
            {error && (
              <span aria-hidden="true" className="text-caption text-alert">
                {error}
              </span>
            )}
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-on-brand">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-6 w-6"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="text-label text-ink">{error ? 'Choose another' : 'Add photo'}</span>
            {!error && <span className="hidden text-caption text-ink-muted sm:block">or drop one here</span>}
          </button>
        )}

        {cleaning && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-raised/85 p-3 text-center">
            <span className="text-label text-ink motion-safe:animate-pulse" role="status">
              Preparing photo...
            </span>
          </div>
        )}

        {/* An empty slot shows the message inside its button; this region is what a screen reader hears. */}
        {error && (
          <p
            id={errorId}
            role="alert"
            className={file ? 'absolute inset-x-0 bottom-0 bg-surface-raised/95 p-2 text-caption text-alert' : 'sr-only'}
          >
            {error}
          </p>
        )}
      </div>

      {file && (
        <div className="flex gap-2">
          <button
            ref={replaceRef}
            type="button"
            onClick={choose}
            disabled={cleaning}
            aria-label={`Replace ${subject}`}
            className={`${SMALL_BUTTON} flex-1`}
          >
            Replace
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={cleaning}
            aria-label={`Remove ${subject}`}
            className={`${SMALL_BUTTON} flex-1`}
          >
            Remove
          </button>
        </div>
      )}

      {/* Hidden picker. No capture attribute, so a phone offers its library or its camera. */}
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0]
          // Cleared so choosing the same file again still counts as a change.
          event.target.value = ''
          if (picked) pickFile(picked)
        }}
      />
    </div>
  )
}
