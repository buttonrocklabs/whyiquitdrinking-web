import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { MAX_ZOOM, MIN_ZOOM, clampView, visibleShare, type FrameSpec, type FrameView } from '@/lib/photo'
import { useObjectUrl } from './useObjectUrl'
import type { PhotoEntry } from './types'

const ZOOM_STEP = 0.25
const KEY_MOVE = 0.06 // of the visible area per arrow press
const WHEEL_SPEED = 0.002
// A trackpad pinch arrives as wheel events with ctrlKey set and small deltas, so it needs a larger step.
const PINCH_SPEED = 0.01

type Gesture =
  | { kind: 'pan'; x: number; y: number; view: FrameView }
  | { kind: 'pinch'; distance: number; view: FrameView }

const ROUND_BUTTON =
  'flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-raised text-ink transition-colors hover:bg-surface disabled:cursor-default disabled:opacity-40'

/**
 * Drag-to-frame editor for one photo. The viewport has the board's aspect and the photo
 * always covers it. Drag (or one finger) moves, the slider, the buttons, a trackpad pinch, Ctrl or
 * Command with the wheel, or a two-finger touch pinch zoom, and with the viewport focused the
 * arrow keys move and plus and minus zoom. A plain scroll over the frame still scrolls the page. The view is kept as fractions of the photo, so it bakes the same at any size.
 */
export default function FrameEditor({
  entry,
  frame,
  label,
  disabled,
  onView,
}: {
  entry: PhotoEntry
  frame: FrameSpec
  label: string
  disabled: boolean
  onView: (view: FrameView) => void
}) {
  const url = useObjectUrl(entry.clean)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)

  const aspect = frame.aspectW / frame.aspectH
  const { width, height, view } = entry
  const { fx, fy } = visibleShare(width, height, aspect, view.zoom)

  // The wheel listener subscribes once and reads the latest view and callback from here.
  const latest = useRef({ view, onView, disabled })
  useEffect(() => {
    latest.current = { view, onView, disabled }
  })

  function apply(next: FrameView) {
    onView(clampView(next, width, height, aspect))
  }

  function zoomTo(zoom: number) {
    apply({ ...view, zoom })
  }

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    // Not a React prop: React registers wheel listeners as passive, which cannot stop the page scrolling.
    function onWheel(event: WheelEvent) {
      // Only a deliberate zoom is taken: a trackpad pinch (ctrlKey) or Ctrl or Command with the wheel.
      // Anything else is the visitor scrolling past the frame, so the page gets it.
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const { view: now, onView: emit, disabled: off } = latest.current
      if (off) return
      // Some mice report lines or pages instead of pixels.
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1)
      const speed = event.ctrlKey ? PINCH_SPEED : WHEEL_SPEED
      emit(clampView({ ...now, zoom: now.zoom * Math.exp(-pixels * speed) }, width, height, aspect))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [width, height, aspect])

  function distance() {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function handleDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    gesture.current =
      pointers.current.size === 1
        ? { kind: 'pan', x: event.clientX, y: event.clientY, view }
        : { kind: 'pinch', distance: distance() || 1, view }
  }

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current
    if (!current || !pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const rect = event.currentTarget.getBoundingClientRect()

    if (current.kind === 'pinch' && pointers.current.size >= 2) {
      apply({ ...current.view, zoom: current.view.zoom * (distance() / current.distance) })
    } else if (current.kind === 'pan') {
      // Moving the pointer by dx moves the photo by dx, which is dx / rect.width of the frame.
      const share = visibleShare(width, height, aspect, current.view.zoom)
      apply({
        ...current.view,
        x: current.view.x - ((event.clientX - current.x) * share.fx) / rect.width,
        y: current.view.y - ((event.clientY - current.y) * share.fy) / rect.height,
      })
    }
  }

  function handleUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 0) gesture.current = null
    else if (pointers.current.size === 1) {
      // One finger of a pinch lifted: carry on panning from where the other one is.
      const [rest] = [...pointers.current.values()]
      gesture.current = { kind: 'pan', x: rest.x, y: rest.y, view: latest.current.view }
    }
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    const move = (dx: number, dy: number) => {
      event.preventDefault()
      // The photo moves the way the arrow points, so the middle of the view moves the other way.
      apply({ ...view, x: view.x - dx * KEY_MOVE * fx, y: view.y - dy * KEY_MOVE * fy })
    }
    if (event.key === 'ArrowLeft') move(-1, 0)
    else if (event.key === 'ArrowRight') move(1, 0)
    else if (event.key === 'ArrowUp') move(0, -1)
    else if (event.key === 'ArrowDown') move(0, 1)
    else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomTo(view.zoom + ZOOM_STEP)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      zoomTo(view.zoom - ZOOM_STEP)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={viewportRef}
        tabIndex={0}
        role="group"
        aria-label={`${label} frame. Arrow keys move the photo. Plus and minus zoom.`}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onKeyDown={handleKey}
        // The width is capped by height too, so the frame stays on screen with its controls on a short phone.
        style={{ aspectRatio: `${frame.aspectW} / ${frame.aspectH}`, width: `min(100%, ${48 * aspect}vh)` }}
        className={`relative touch-none select-none overflow-hidden rounded-md border border-line bg-surface ${
          disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              width: `${100 / fx}%`,
              height: `${100 / fy}%`,
              left: `${50 - (view.x * 100) / fx}%`,
              top: `${50 - (view.y * 100) / fy}%`,
            }}
          />
        )}
      </div>

      <div className="flex w-full max-w-sm items-center gap-2">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={disabled || view.zoom <= MIN_ZOOM}
          onClick={() => zoomTo(view.zoom - ZOOM_STEP)}
          className={ROUND_BUTTON}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
            <path d="M5 12h14" />
          </svg>
        </button>
        <input
          type="range"
          aria-label={`${label} zoom`}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={view.zoom}
          disabled={disabled}
          onChange={(event) => zoomTo(Number(event.target.value))}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-brand"
        />
        <button
          type="button"
          aria-label="Zoom in"
          disabled={disabled || view.zoom >= MAX_ZOOM}
          onClick={() => zoomTo(view.zoom + ZOOM_STEP)}
          className={ROUND_BUTTON}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  )
}
