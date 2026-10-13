import { useId, useLayoutEffect, useRef } from 'react'
import PhotoThumb from './PhotoThumb'
import SwitchRow from './SwitchRow'
import { NAME_MAX_CHARS, STORY_MAX_CHARS, modeOf, type FlowData } from './types'

const FIELD_CLASS = 'min-h-11 w-full rounded-md border border-line bg-surface-raised px-4 py-2 text-body text-ink'

/** The photos as small thumbnails: one, or two overlapped. Nothing for a story with no photos. */
function Thumbs({ data }: { data: FlowData }) {
  const mode = modeOf(data)
  const file = (key: 'before' | 'after' | 'single') => data.photos[key]?.baked ?? data.photos[key]?.clean ?? null
  if (mode === 'pair') {
    return (
      <div className="relative h-24 w-16 shrink-0 sm:h-28 sm:w-20" aria-hidden="true">
        <PhotoThumb file={file('before')} className="absolute left-0 top-0 h-[4.5rem] w-12 -rotate-3 rounded-sm shadow ring-2 ring-surface-raised sm:h-[5.25rem] sm:w-14" />
        <PhotoThumb file={file('after')} className="absolute bottom-0 right-0 h-[4.5rem] w-12 rotate-3 rounded-sm shadow ring-2 ring-surface-raised sm:h-[5.25rem] sm:w-14" />
      </div>
    )
  }
  if (mode === 'single') {
    return <PhotoThumb file={file('single')} className="h-12 w-16 shrink-0 rounded-sm shadow sm:h-[3.75rem] sm:w-20" />
  }
  return null
}

/** Step 4: the story in an auto-growing field, with the first-name switch below it. */
export default function StoryStep({
  data,
  onChange,
}: {
  data: FlowData
  onChange: (change: Partial<FlowData>) => void
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const countId = useId()

  // Grow with the text: reset to auto first so the box can shrink as well as grow.
  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return
    area.style.height = 'auto'
    area.style.height = `${area.scrollHeight}px`
  }, [data.story])

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-ink-muted">Say it in your own words. A few lines is plenty.</p>

      <div className="flex items-start gap-3">
        <Thumbs data={data} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="story_text" className="sr-only">
            My story
          </label>
          <textarea
            ref={areaRef}
            id="story_text"
            rows={5}
            maxLength={STORY_MAX_CHARS}
            value={data.story}
            onChange={(event) => onChange({ story: event.target.value })}
            placeholder="What made you decide to quit?"
            aria-describedby={countId}
            className={`${FIELD_CLASS} resize-none overflow-hidden`}
          />
          <p id={countId} className="text-right text-caption text-ink-muted">
            {data.story.length} of {STORY_MAX_CHARS}
          </p>
        </div>
      </div>

      <SwitchRow checked={data.shareName} onChange={(shareName) => onChange({ shareName })}>
        Share my first name
      </SwitchRow>

      {data.shareName ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="display_name" className="text-label text-ink">
            First name
          </label>
          <input
            id="display_name"
            type="text"
            maxLength={NAME_MAX_CHARS}
            autoComplete="given-name"
            value={data.name}
            onChange={(event) => onChange({ name: event.target.value })}
            className={FIELD_CLASS}
          />
        </div>
      ) : (
        <p className="text-caption text-ink-muted">Without a name, my story shows as Anonymous.</p>
      )}
    </div>
  )
}
