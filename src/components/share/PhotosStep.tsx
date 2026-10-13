import { useRef, useState } from 'react'
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
  onPhoto,
  onSkip,
}: {
  data: FlowData
  onChoice: (choice: 'pair' | 'single') => void
  onPhoto: (key: PhotoKey, entry: PhotoEntry | null) => void
  onSkip: () => void
}) {
  const [cleaning, setCleaning] = useState<Record<PhotoKey, boolean>>({ before: false, after: false, single: false })
  const [errors, setErrors] = useState<Record<PhotoKey, string>>({ before: '', after: '', single: '' })
  // Counts picks per slot, so a slow earlier pick cannot land after a newer one.
  const picks = useRef<Record<PhotoKey, number>>({ before: 0, after: 0, single: 0 })

  async function pick(key: PhotoKey, file: File) {
    const mine = ++picks.current[key]
    setErrors((prev) => ({ ...prev, [key]: '' }))
    setCleaning((prev) => ({ ...prev, [key]: true }))
    try {
      const entry = await loadPhoto(file)
      if (mine === picks.current[key]) onPhoto(key, entry)
    } catch (error) {
      // A refusal keeps whatever the slot held before and says why in the slot.
      if (mine === picks.current[key]) {
        setErrors((prev) => ({ ...prev, [key]: error instanceof PhotoRefused ? error.message : PHOTO_ERRORS.type }))
      }
    } finally {
      if (mine === picks.current[key]) setCleaning((prev) => ({ ...prev, [key]: false }))
    }
  }

  function remove(key: PhotoKey) {
    picks.current[key]++
    setErrors((prev) => ({ ...prev, [key]: '' }))
    setCleaning((prev) => ({ ...prev, [key]: false }))
    onPhoto(key, null)
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
            cleaning={cleaning[key]}
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
