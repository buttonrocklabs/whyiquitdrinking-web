import { useEffect, useRef, useState } from 'react'
import { PHOTO_ERRORS } from '../../../shared/pair'
import './share.css'
import DatesStep from './DatesStep'
import DoneScreen from './DoneScreen'
import { FlowFooter, FlowHeader } from './FlowChrome'
import FrameStep from './FrameStep'
import PhotosStep from './PhotosStep'
import PrivacyStep from './PrivacyStep'
import ReviewStep from './ReviewStep'
import StoryStep from './StoryStep'
import { bakePhotos } from './loadPhoto'
import { buildBody, sendStory, submitProblem } from './submit'
import { slotsOf, type Mode, type StepId } from './types'
import { useShareFlow } from './useShareFlow'
import { stepAtDepth, useStepHistory } from './useStepHistory'
import { hasEntries, stepProblem } from './validate'

const BAKE_ERROR = 'Something went wrong preparing a photo. Go back and choose it again.'

function titleFor(step: StepId, mode: Mode): string {
  switch (step) {
    case 'photos':
      return 'Add your photos'
    case 'frame':
      return mode === 'single' ? 'Frame your photo' : 'Frame your photos'
    case 'dates':
      return 'When were they taken?'
    case 'story':
      return 'Tell your story'
    case 'privacy':
      return 'Where can it show up?'
    case 'review':
      return 'Ready to share?'
  }
}

/**
 * The share flow: a card that walks the visitor through photos, framing, dates, story,
 * visibility and review, one job per step. /share and /share?pair=1 both open on the
 * before and after choice, which is the default, so the query needs no handling here.
 */
export default function ShareFlow() {
  const flow = useShareFlow()
  const { data, step, steps, position, mode } = flow
  const [busy, setBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [manageUrl, setManageUrl] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const lastStep = useRef(step)

  // Every step change lands on the new step's heading, from the top of the page. Comparing with
  // the last step keeps the first render (and React's dev double-run) from stealing focus.
  useEffect(() => {
    if (lastStep.current === step) return
    lastStep.current = step
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }, [step])

  // The browser's Back button and a phone's back gesture step back through the flow. While a photo
  // is being framed or the story is being sent they change nothing, like the in-page Back button.
  useStepHistory({
    step,
    mode,
    locked: busy || submitting,
    done,
    onDepth: (depth) => {
      setError('')
      flow.go(stepAtDepth(depth, mode))
    },
  })

  const dirty = hasEntries(data)
  useEffect(() => {
    if (!dirty || done) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, done])

  async function submit() {
    const problem = submitProblem(data)
    if (problem) return setError(problem)
    setSubmitting(true)
    try {
      const token = await sendStory(buildBody(data))
      if (token) setManageUrl(`${window.location.origin}/manage/${token}`)
      setDone(true)
    } catch (failure) {
      // Stay on review with every photo and field kept; the visitor decides what to change.
      setError(failure instanceof Error ? failure.message : '')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleContinue() {
    setError('')
    if (step === 'review') return submit()
    let current = data
    if (step === 'frame') {
      // Continue is what bakes each photo's framing into the file that gets uploaded.
      setBusy(true)
      const baked = await bakePhotos(data, slotsOf(mode))
      setBusy(false)
      if (!baked) return setError(BAKE_ERROR)
      current = baked
      flow.patch({ photos: baked.photos })
    }
    flow.advance(current)
  }

  function handleBack() {
    setError('')
    flow.back()
  }

  function handleEdit(target: StepId) {
    if (submitting) return
    setError('')
    flow.edit(target)
  }

  if (done) return <DoneScreen manageUrl={manageUrl} />

  const problem = stepProblem(step, data)
  const isServerPhotoError = (Object.values(PHOTO_ERRORS) as string[]).includes(error)

  return (
    <div className="mx-auto w-full max-w-xl px-3 py-6 sm:px-6 sm:py-10">
      <div className="relative rounded-md bg-surface-raised shadow-lg">
        <span aria-hidden="true" className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-brand shadow" />

        <FlowHeader
          position={position}
          total={steps.length}
          canGoBack={step !== 'photos'}
          disabled={busy || submitting}
          onBack={handleBack}
        />

        <div key={step} className="share-step-in px-4 pb-8 pt-2 sm:px-8">
          <h1 ref={heading} tabIndex={-1} className="mb-3 font-serif text-h2 text-ink outline-none sm:text-h1">
            {titleFor(step, mode)}
          </h1>
          {step === 'photos' && (
            <PhotosStep data={data} onChoice={(choice) => flow.patch({ choice })} onPhoto={flow.setPhoto} onSkip={flow.skipPhotos} />
          )}
          {step === 'frame' && <FrameStep data={data} busy={busy} onView={flow.setView} />}
          {step === 'dates' && <DatesStep data={data} onDate={flow.setDate} />}
          {step === 'story' && <StoryStep data={data} onChange={flow.patch} />}
          {step === 'privacy' && <PrivacyStep data={data} onChange={flow.patch} />}
          {step === 'review' && <ReviewStep data={data} disabled={submitting} onEdit={handleEdit} />}
        </div>

        <FlowFooter
          label={step === 'review' ? (submitting ? 'Sharing...' : 'Share my story') : busy ? 'Preparing...' : 'Continue'}
          disabled={busy || submitting || problem !== null}
          reason={busy || submitting ? null : problem}
          error={error}
          errorAction={
            isServerPhotoError && (
              <button
                type="button"
                onClick={() => handleEdit('photos')}
                className="min-h-11 cursor-pointer rounded-md border border-line bg-surface-raised px-4 text-label text-ink transition-colors hover:bg-surface"
              >
                Change photos
              </button>
            )
          }
          onContinue={handleContinue}
        />

        {/* Honeypot: hidden from real visitors, most bots fill every field they see in the DOM. */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={data.website}
            onChange={(event) => flow.patch({ website: event.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
