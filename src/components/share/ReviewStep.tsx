import { useState, type ReactNode } from 'react'
import StoryCard, { type Story } from '@/components/StoryCard'
import { takenOnValue } from '../../../shared/pair'
import { MONTHS, modeOf, type FlowData, type StepId } from './types'
import { useObjectUrl } from './useObjectUrl'

function monthYear(year: string, month: string): string {
  return `${MONTHS[Number(month) - 1]} ${year}`
}

function Row({ label, children, actions }: { label: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <dt className="text-label text-ink">{label}</dt>
        <dd className="mt-0.5 text-body text-ink-muted">{children}</dd>
      </div>
      <div className="flex shrink-0 items-center">{actions}</div>
    </div>
  )
}

function EditLink({
  label,
  onClick,
  disabled,
  children = 'Edit',
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="min-h-11 cursor-pointer px-2 text-label text-brand underline underline-offset-4 disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/**
 * Step 6: the visitor's own card as it will look on the board, then a short list with Edit links.
 * While the story is being sent the Edit links are off, so the screen cannot change under a request
 * that already captured the answers.
 */
export default function ReviewStep({
  data,
  disabled,
  onEdit,
}: {
  data: FlowData
  disabled: boolean
  onEdit: (step: StepId) => void
}) {
  const mode = modeOf(data)
  const beforeUrl = useObjectUrl(mode === 'pair' ? (data.photos.before?.baked ?? null) : null)
  const afterUrl = useObjectUrl(mode === 'pair' ? (data.photos.after?.baked ?? null) : null)
  const singleUrl = useObjectUrl(mode === 'single' ? (data.photos.single?.baked ?? null) : null)
  const [submittedAt] = useState(() => new Date().toISOString())

  const beforeOn = takenOnValue(data.dates.before.year, data.dates.before.month)
  const afterOn = takenOnValue(data.dates.after.year, data.dates.after.month)
  const name = data.shareName ? data.name.trim() : ''

  const story: Story = {
    id: 'preview',
    displayName: name || null,
    storyText: data.story.trim(),
    photoUrl: singleUrl,
    photos:
      beforeUrl && afterUrl
        ? [
            { kind: 'before', url: beforeUrl, takenOn: beforeOn },
            { kind: 'after', url: afterUrl, takenOn: afterOn },
          ]
        : [],
    submittedAt,
  }

  const visibility = ['Shown on whyiquitdrinking.com.']
  if (mode === 'pair' && data.pins) visibility.push('Used on WIQD pins and social posts.')
  if (mode === 'pair' && data.smBoard) visibility.push('Used on the Sober Motivation Pinterest board.')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="flex w-full justify-center overflow-x-clip px-3 py-4">
          <StoryCard story={story} linked={false} />
        </div>
        <p className="text-center text-caption text-ink-muted">This is how your card will look on the board.</p>
      </div>

      <dl className="divide-y divide-line border-y border-line">
        <Row
          label="Photos"
          actions={
            mode === 'none' ? (
              <EditLink label="Add photos" disabled={disabled} onClick={() => onEdit('photos')}>
                Add photos
              </EditLink>
            ) : (
              <>
                <EditLink label="Edit photos" disabled={disabled} onClick={() => onEdit('photos')} />
                <EditLink label="Reframe photos" disabled={disabled} onClick={() => onEdit('frame')}>
                  Reframe
                </EditLink>
              </>
            )
          }
        >
          {mode === 'pair' ? 'Before and after' : mode === 'single' ? 'One photo' : 'No photos'}
        </Row>

        {mode === 'pair' && (
          <Row label="Dates" actions={<EditLink label="Edit dates" disabled={disabled} onClick={() => onEdit('dates')} />}>
            Before: {monthYear(data.dates.before.year, data.dates.before.month)}. After:{' '}
            {monthYear(data.dates.after.year, data.dates.after.month)}.
          </Row>
        )}

        <Row label="Story" actions={<EditLink label="Edit story" disabled={disabled} onClick={() => onEdit('story')} />}>
          <span className="line-clamp-2">{data.story.trim()}</span>
          <span className="block">Shown as {name || 'Anonymous'}.</span>
        </Row>

        <Row label="Visibility" actions={<EditLink label="Edit visibility" disabled={disabled} onClick={() => onEdit('privacy')} />}>
          {visibility.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
          {mode === 'pair' && <span className="block break-all">Private link goes to {data.email.trim()}.</span>}
        </Row>
      </dl>

      <p className="text-body text-ink-muted">A real person reviews every story before it goes public.</p>
    </div>
  )
}
