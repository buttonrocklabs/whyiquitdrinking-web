import { useState } from 'react'
import { PHOTO_HELP } from '@/lib/photo'
import { PHOTO_ERRORS } from '../../../shared/pair'
import PhotoSlot from './PhotoSlot'
import { PhotoRefused, loadPhoto } from './loadPhoto'
import { slotsOf, type FlowData, type PhotoEntry, type PhotoKey } from './types'

const OPTIONS = [
  { value: 'pair', label: 'Before and after' },
  { value: 'single', label: 'One photo' },
] as const

const SLOT_LABELS: Record<PhotoKey, string> = { before: 'Before', after: 'After', single: 'Your photo' }

/** Step 1: the mode control, the framed slots, and the way out for a story with no photos. */
export default function PhotosStep({
  data,
  onChoice,
  onBeginPick,
  onFinishPick,
  onRemove,
  onSkip,
}: {
  data: FlowData
  onChoice: (choice: 'pair' | 'single') => void
  /** Marks a slot as being cleaned and returns the ticket its result must present. */
  onBeginPick: (key: PhotoKey) => number
  /** Lands a result (null for a refusal). False means the ticket was stale and nothing changed. */
  onFinishPick: (key: PhotoKey, ticket: number, entry: PhotoEntry | null) => boolean
  onRemove: (key: PhotoKey) => void
  onSkip: () => void
}) {
  const [errors, setErrors] = useState<Record<PhotoKey, string>>({ before: '', after: '', single: '' })

  async function pick(key: PhotoKey, file: File) {
    setErrors((prev) => ({ ...prev, [key]: '' }))
    const ticket = onBeginPick(key)
    try {
      onFinishPick(key, ticket, await loadPhoto(file))
    } catch (error) {
      // A refusal keeps whatever the slot held before and says why in the slot.
      if (onFinishPick(key, ticket, null)) {
        setErrors((prev) => ({ ...prev, [key]: error instanceof PhotoRefused ? error.message : PHOTO_ERRORS.type }))
      }
    }
  }

  function remove(key: PhotoKey) {
    setErrors((prev) => ({ ...prev, [key]: '' }))
    onRemove(key)
  }

  const slots = slotsOf(data.choice)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body text-ink-muted">
        {data.choice === 'pair'
          ? 'Add a photo from before and one from now. Each one shows the way it will on the board.'
          : 'Add one photo. It shows the way it will on the board.'}
      </p>

      <div role="group" aria-label="Photo layout" className="flex gap-1 rounded-md bg-surface p-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={data.choice === option.value}
            onClick={() => onChoice(option.value)}
            className={`min-h-11 flex-1 cursor-pointer rounded-sm px-3 text-label transition-colors ${
              data.choice === option.value ? 'bg-surface-raised text-ink shadow' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={data.choice === 'pair' ? 'grid grid-cols-2 gap-3 sm:gap-4' : 'flex flex-col'}>
        {slots.map((key) => (
          <PhotoSlot
            key={key}
            label={SLOT_LABELS[key]}
            aspectClass={key === 'single' ? 'aspect-[4/3]' : 'aspect-[3/4]'}
            file={data.photos[key]?.clean ?? null}
            cleaning={data.cleaning[key]}
            error={errors[key]}
            onFile={(file) => pick(key, file)}
            onRemove={() => remove(key)}
          />
        ))}
      </div>

      <p className="text-caption text-ink-muted">{PHOTO_HELP}</p>

      <button
        type="button"
        onClick={onSkip}
        className="min-h-11 cursor-pointer self-start text-label text-brand underline underline-offset-4"
      >
        Just write my story
      </button>
    </div>
  )
}
