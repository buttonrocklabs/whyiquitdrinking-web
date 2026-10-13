import { useRef, useState } from 'react'
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

  // Counts picks per slot. A result only lands if its ticket is still the latest for the slot, so a
  // slow earlier pick cannot land after a newer pick, a Remove, or the visitor leaving the photos step.
  const picks = useRef<Record<PhotoKey, number>>({ before: 0, after: 0, single: 0 })

  /** A file was picked for a slot: marks it as being cleaned and returns the ticket for its result. */
  function beginPick(key: PhotoKey): number {
    const ticket = ++picks.current[key]
    setData((prev) => ({ ...prev, cleaning: { ...prev.cleaning, [key]: true } }))
    return ticket
  }

  /**
   * Lands a pick's result: the cleaned entry, or null when the file was refused (the slot keeps what it
   * held). A new entry starts over, with no baked file and default framing; its dates stay.
   * Returns false, and changes nothing, when the ticket is stale.
   */
  function finishPick(key: PhotoKey, ticket: number, entry: PhotoEntry | null): boolean {
    if (ticket !== picks.current[key]) return false
    setData((prev) => ({
      ...prev,
      photos: entry ? { ...prev.photos, [key]: entry } : prev.photos,
      cleaning: { ...prev.cleaning, [key]: false },
    }))
    return true
  }

  /** Empties a slot and drops any pick still in flight for it. */
  function removePhoto(key: PhotoKey) {
    picks.current[key]++
    setData((prev) => ({
      ...prev,
      photos: { ...prev.photos, [key]: null },
      cleaning: { ...prev.cleaning, [key]: false },
    }))
  }

  /** The visitor left the photos step: whatever is still being cleaned is dropped, not applied later. */
  function cancelPicks() {
    for (const key of Object.keys(picks.current) as PhotoKey[]) picks.current[key]++
    setData((prev) => ({ ...prev, cleaning: EMPTY_FLOW.cleaning }))
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
    if (step === 'photos' && target !== 'photos') cancelPicks()
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
    cancelPicks()
    patch({ skipped: true })
    setStep('story')
  }

  return { data, step, steps, position, mode, patch, beginPick, finishPick, removePhoto, setView, setDate, go, edit, advance, back, skipPhotos }
}
