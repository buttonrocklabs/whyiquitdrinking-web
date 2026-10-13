import { useState } from 'react'
import type { FrameView } from '@/lib/photo'
import FrameEditor from './FrameEditor'
import { frameOf, modeOf, slotsOf, type FlowData, type PhotoKey } from './types'

const TAB_LABELS: Record<PhotoKey, string> = { before: 'Before', after: 'After', single: 'Your photo' }

/** Step 2: frame each photo the way the board will show it. A pair is two buttons, one editor visible at a time. */
export default function FrameStep({
  data,
  busy,
  onView,
}: {
  data: FlowData
  busy: boolean
  onView: (key: PhotoKey, view: FrameView) => void
}) {
  const keys = slotsOf(modeOf(data))
  const [picked, setPicked] = useState<PhotoKey>(keys[0])
  const active = keys.includes(picked) ? picked : keys[0]
  const entry = data.photos[active]

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-ink-muted">
        {keys.length > 1 ? 'Drag each photo to move it' : 'Drag the photo to move it'} and use the slider to zoom. The
        board shows exactly what is in the frame.
      </p>

      {keys.length > 1 && (
        <div role="group" aria-label="Photo to frame" className="flex gap-1 rounded-md bg-surface p-1">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={active === key}
              onClick={() => setPicked(key)}
              className={`min-h-11 flex-1 cursor-pointer rounded-sm px-3 text-label transition-colors ${
                active === key ? 'bg-surface-raised text-ink shadow' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>
      )}

      {entry && (
        <FrameEditor
          key={active}
          entry={entry}
          frame={frameOf(active)}
          label={TAB_LABELS[active]}
          disabled={busy}
          onView={(view) => onView(active, view)}
        />
      )}
    </div>
  )
}
