import { useState } from 'react'
import type { FrameView } from '@/lib/photo'
import {
  EMPTY_FLOW,
  STEPS,
  modeOf,
  type FlowData,
  type MonthYear,
  type PhotoEntry,
  type PhotoKey,
  type StepId,
} from './types'
import { firstIncomplete } from './validate'

/**
 * Flow state and movement between steps. Everything the visitor entered stays in `data`
 * whatever the mode, so flipping the step-1 control or backing up never loses a photo,
 * a date or a word; only the active mode's data is shown and sent.
 */
export function useShareFlow() {
  const [data, setData] = useState<FlowData>(EMPTY_FLOW)
  const [step, setStep] = useState<StepId>('photos')
  // Set by an Edit link on the review step; Continue then returns toward review.
  const [fromReview, setFromReview] = useState(false)

  const mode = modeOf(data)
  const steps = STEPS[mode]
  const position = Math.max(0, steps.indexOf(step))

  function patch(change: Partial<FlowData>) {
    setData((prev) => ({ ...prev, ...change }))
  }

  /** A new or removed photo starts over: no baked file, default framing. Its dates stay. */
  function setPhoto(key: PhotoKey, entry: PhotoEntry | null) {
    setData((prev) => ({ ...prev, photos: { ...prev.photos, [key]: entry } }))
  }

  /** Any change of framing invalidates the baked file. */
  function setView(key: PhotoKey, view: FrameView) {
    setData((prev) => {
      const entry = prev.photos[key]
      if (!entry) return prev
      return { ...prev, photos: { ...prev.photos, [key]: { ...entry, view, baked: null } } }
    })
  }

  function setDate(key: 'before' | 'after', value: MonthYear) {
    setData((prev) => ({ ...prev, dates: { ...prev.dates, [key]: value } }))
  }

  function go(target: StepId) {
    // Arriving at step 1 again takes the mode from the control, not from an earlier skip.
    if (target === 'photos') setData((prev) => ({ ...prev, skipped: false }))
    if (target === 'review') setFromReview(false)
    setStep(target)
  }

  /** Jumps to a step from the review list; Continue there heads back toward review. */
  function edit(target: StepId) {
    setFromReview(true)
    go(target)
  }

  /** Continue. After an Edit jump it goes to the first step still missing something, else review. */
  function advance(current: FlowData) {
    if (fromReview) return go(firstIncomplete(current) ?? 'review')
    const list = STEPS[modeOf(current)]
    go(list[list.indexOf(step) + 1])
  }

  function back() {
    // In none mode the story step is first in its list, but step 1 is still where Back leads.
    if (step === 'story' && mode === 'none') return go('photos')
    go(steps[position - 1])
  }

  /** "Just write my story": no photos, straight to the story step. */
  function skipPhotos() {
    patch({ skipped: true })
    setStep('story')
  }

  return { data, step, steps, position, mode, patch, setPhoto, setView, setDate, go, edit, advance, back, skipPhotos }
}
