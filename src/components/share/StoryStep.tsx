import { useEffect, useId, useLayoutEffect, useRef, type ChangeEvent } from 'react'
import PhotoThumb from './PhotoThumb'
import SwitchRow from './SwitchRow'
import { NAME_MAX_CHARS, STORY_MAX_CHARS, fitStory, modeOf, storyLength, type FlowData } from './types'

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

/** Resizes the field to its text: reset to auto first so the box can shrink as well as grow. */
function grow(area: HTMLTextAreaElement) {
  area.style.height = 'auto'
  area.style.height = `${area.scrollHeight}px`
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
  // Where the caret goes after a change was cut down to fit; null when the text went in as typed.
  const caret = useRef<number | null>(null)

  // Grow with the text, and put the caret back after a change was cut down to fit the limit.
  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return
    grow(area)
    if (caret.current !== null) {
      area.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  }, [data.story])

  // The field hides overflow, so a change of width (rotating a phone, resizing a window) re-wraps the
  // text and has to resize it too, or the last lines are cut off.
  useEffect(() => {
    const area = areaRef.current
    if (!area || typeof ResizeObserver === 'undefined') return
    let width = area.clientWidth
    const watcher = new ResizeObserver(() => {
      // Growing changes the height only, so waiting for a new width keeps this from feeding itself.
      if (area.clientWidth === width) return
      width = area.clientWidth
      grow(area)
    })
    watcher.observe(area)
    return () => watcher.disconnect()
  }, [])

  function handleStory(event: ChangeEvent<HTMLTextAreaElement>) {
    const area = event.target
    const { text, caret: at } = fitStory(area.value, area.selectionStart)
    caret.current = null
    if (text !== area.value) {
      if (text !== data.story) caret.current = at
      // Nothing changed in state (the keystroke was cut off whole), so React puts the old text back
      // and the caret at its end; move it back once that has happened.
      else queueMicrotask(() => area.setSelectionRange(at, at))
    }
    onChange({ story: text })
  }

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
            value={data.story}
            onChange={handleStory}
            placeholder="What made you decide to quit?"
            aria-describedby={countId}
            className={`${FIELD_CLASS} resize-none overflow-hidden`}
          />
          <p id={countId} className="text-right text-caption text-ink-muted">
            {storyLength(data.story)} of {STORY_MAX_CHARS}
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
