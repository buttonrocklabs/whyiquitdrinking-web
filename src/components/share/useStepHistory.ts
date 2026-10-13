import { useEffect, useRef } from 'react'
import { STEPS, type Mode, type StepId } from './types'

/**
 * Makes the browser's Back button (and a phone's back gesture) step through the share flow
 * instead of leaving it. The router here is a plain BrowserRouter, so there is no blocker to
 * lean on; this keeps a stack of marker entries in the history instead.
 *
 * The rule that keeps it honest: the number of marker entries above the page's own entry always
 * equals how deep the current step sits (step 1 is 0). So:
 *  - moving forward pushes markers up to the new depth (same URL, state { wiqdStep: n });
 *  - moving back, by the in-page Back button or an Edit jump, travels the history down to the
 *    new depth, and that travel is recognised and not treated as the visitor pressing Back;
 *  - the visitor pressing Back lands on a marker one lower, which sets the flow to that step.
 *    At step 1 there is no marker, so Back leaves the page like any other page;
 *  - once the story is sent the markers are travelled back over, so the Done screen is not trapped.
 */
const KEY = 'wiqdStep'

/** How many marker entries deep a step sits. In none mode the story step is first in its list but Back still leads to step 1. */
export function depthOf(step: StepId, mode: Mode): number {
  if (step === 'photos') return 0
  const index = Math.max(0, STEPS[mode].indexOf(step))
  return mode === 'none' ? index + 1 : index
}

/** The step at a depth: the inverse of depthOf, kept inside the mode's last step. */
export function stepAtDepth(depth: number, mode: Mode): StepId {
  if (depth <= 0) return 'photos'
  const list = STEPS[mode]
  if (mode === 'none') return list[Math.min(depth, list.length) - 1]
  return list[Math.min(depth, list.length - 1)]
}

function stateDepth(): number {
  const value = Number((window.history.state as Record<string, unknown> | null)?.[KEY] ?? 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function useStepHistory({
  step,
  mode,
  locked,
  done,
  onDepth,
}: {
  step: StepId
  mode: Mode
  /** A photo is being framed or the story is being sent: the screen must not move under it. */
  locked: boolean
  /** The story went through; nothing is intercepted from here on. */
  done: boolean
  /** The visitor pressed Back (or Forward over a gap) to the entry at this depth. */
  onDepth: (depth: number) => void
}) {
  const target = done ? 0 : depthOf(step, mode)
  // Marker entries we believe sit above the page's own entry, counting the one we are on.
  const depth = useRef(0)
  // The depth a history travel of our own will land on, so its popstate is not read as the visitor.
  const travelling = useRef<number | null>(null)
  const cleaned = useRef(false)

  const latest = useRef({ locked, done, onDepth })
  useEffect(() => {
    latest.current = { locked, done, onDepth }
  })

  /** Moves the browser from the entry it is on to the one at another depth, and notes that the popstate is ours. */
  function travel(from: number, to: number) {
    travelling.current = to
    window.history.go(to - from)
  }

  // The flow moved: bring the history to the new step's depth.
  useEffect(() => {
    if (target === depth.current) return
    if (target > depth.current) {
      for (let next = depth.current + 1; next <= target; next++) {
        window.history.pushState({ ...(window.history.state as object | null), [KEY]: next }, '')
      }
      depth.current = target
    } else {
      travel(depth.current, target)
      depth.current = target
    }
    // travel only touches refs and the history, so the target is the one real dependency
  }, [target])

  useEffect(() => {
    // A reload leaves the page standing on a marker entry with an empty flow. Step back over the
    // markers so the Back button is not a run of presses that appear to do nothing.
    const stale = stateDepth()
    if (stale > 0 && !cleaned.current) {
      cleaned.current = true
      travelling.current = 0
      window.history.go(-stale)
    }

    function onPop() {
      const now = stateDepth()
      if (travelling.current !== null) {
        const expected = travelling.current
        travelling.current = null
        if (now === expected) return
      }
      const { locked: held, done: finished, onDepth: move } = latest.current
      if (finished) return
      const here = depth.current
      if (now === here) return
      if (held || now > here) {
        // Back while a photo or the send is in progress, or Forward over a step the visitor left:
        // go back to the entry the flow is on and change nothing.
        travel(now, here)
        return
      }
      depth.current = now
      move(now)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
