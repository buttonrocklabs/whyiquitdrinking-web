import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'
import StoryCard, { type Story as StoryData } from '@/components/StoryCard'
import { useTheme } from '@/lib/theme'

type Action = 'photos' | 'story'
/** What the server says is now true, which can differ from the action asked for (a stale tab). */
type RemovalState = 'photos_removed' | 'story_removed'
type Status = 'pending' | 'approved' | 'rejected' | 'withdrawn'

interface Summary {
  status: Status
  hasPhotos: boolean
  photosRemovedOn: string | null
  storyRemovedOn: string | null
  /** Null once the whole story has been removed. */
  story: StoryData | null
}

// Keyed by the token the answer belongs to, so a stale response never renders under another link.
type Result =
  | { token: string; kind: 'ready'; summary: Summary }
  | { token: string; kind: 'missing' | 'error' }

const STATUS_LINES: Record<Status, string> = {
  pending: 'Waiting for review',
  approved: 'Your story is on the storyboard',
  rejected: 'This story was not published',
  withdrawn: 'This story has been removed',
}

const ACTIONS: Record<
  Action,
  { title: string; detail: string; button: string; question: string; done: string }
> = {
  photos: {
    title: 'Remove my photos',
    detail: 'Your photos come down from the site right away. Your story text stays as it is.',
    button: 'Remove my photos',
    question: 'Remove your photos from the site?',
    done: 'Your photos were removed.',
  },
  story: {
    title: 'Remove my whole story',
    detail: "Your story, your name and your photos are deleted. This can't be undone.",
    button: 'Remove my whole story',
    question: 'Remove your whole story from the site?',
    done: '',
  },
}

// True whether the request failed before or after anything was taken down; a retry is safe either way.
const SERVER_ERROR = "That didn't finish. Please try again."

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'long' })
}

/** The page as the server's reply to a removal says it now is, until the next read confirms it. */
function afterRemoval(summary: Summary, state: RemovalState, action: Action, at: string): Summary {
  if (state === 'story_removed') {
    // The date is only known to be today when this request is the one that removed it.
    return {
      ...summary,
      status: 'withdrawn',
      hasPhotos: false,
      storyRemovedOn: action === 'story' ? at : null,
      story: null,
    }
  }
  return {
    ...summary,
    hasPhotos: false,
    photosRemovedOn: at,
    story: summary.story && { ...summary.story, photoUrl: null, photos: [] },
  }
}

/** The link is the only credential: keep the page out of search results and out of Referer headers. */
function usePrivatePage() {
  useEffect(() => {
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    const referrer = document.createElement('meta')
    referrer.name = 'referrer'
    referrer.content = 'no-referrer'
    document.head.append(robots, referrer)
    return () => {
      robots.remove()
      referrer.remove()
    }
  }, [])
}

function RemoveAction({
  action,
  open,
  busy,
  onOpen,
  onCancel,
  onConfirm,
}: {
  action: Action
  open: boolean
  busy: boolean
  onOpen: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const copy = ACTIONS[action]
  const openerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Set only by Cancel, so a confirm that closes because the removal finished never grabs focus.
  const returnFocus = useRef(false)

  // The question opens in place of the button that was pressed, so focus follows it: onto the safe
  // choice when it opens, and back onto the opener when it is cancelled.
  useEffect(() => {
    if (open) {
      cancelRef.current?.focus()
    } else if (returnFocus.current) {
      returnFocus.current = false
      openerRef.current?.focus()
    }
  }, [open])

  return (
    <div className="rounded-md border border-line bg-surface-raised p-6">
      <h2 className="font-serif text-h2 text-ink">{copy.title}</h2>
      <p className="mt-2 text-body text-ink-muted">{copy.detail}</p>
      <div className="mt-4" aria-live="polite">
        {open ? (
          <div role="group" aria-label={copy.question}>
            <p className="text-body text-ink">{copy.question}</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="rounded-md bg-brand px-4 py-2 text-label text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-60"
              >
                {busy ? 'Removing' : 'Yes, remove'}
              </button>
              <button
                ref={cancelRef}
                type="button"
                onClick={() => {
                  returnFocus.current = true
                  onCancel()
                }}
                disabled={busy}
                className="rounded-md border border-line-strong px-4 py-2 text-label text-ink transition-colors hover:bg-surface disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            ref={openerRef}
            type="button"
            onClick={onOpen}
            disabled={busy}
            className="w-full rounded-md border border-line-strong px-4 py-2 text-label text-ink transition-colors hover:bg-surface disabled:opacity-60 sm:w-auto"
          >
            {copy.button}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Manage() {
  const { token = '' } = useParams()
  const theme = useTheme()
  usePrivatePage()

  const [result, setResult] = useState<Result | null>(null)
  // Bumped after a removal so the summary is read again from the server.
  const [version, setVersion] = useState(0)
  const [confirming, setConfirming] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    // After a removal the page already shows the server's answer; this read only confirms it.
    const quiet = version > 0

    fetch(`/api/manage/${encodeURIComponent(token)}`)
      .then(async (res): Promise<Result> => {
        if (res.status === 404) return { token, kind: 'missing' }
        if (!res.ok) throw new Error('failed to load')
        return { token, kind: 'ready', summary: (await res.json()) as Summary }
      })
      .catch((): Result => ({ token, kind: 'error' }))
      .then((next) => {
        if (cancelled) return
        // A quiet read that fails must not replace a removal that just succeeded with a load error.
        setResult((previous) =>
          quiet && next.kind !== 'ready' && previous?.token === token && previous.kind === 'ready' ? previous : next
        )
      })

    return () => {
      cancelled = true
    }
  }, [token, version])

  async function remove(action: Action) {
    setBusy(true)
    setErrorMessage('')
    try {
      const res = await fetch(`/api/manage/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('remove failed')
      const reply = (await res.json()) as { state?: unknown }
      if (reply.state !== 'photos_removed' && reply.state !== 'story_removed') throw new Error('unexpected reply')
      const state: RemovalState = reply.state
      const at = new Date().toISOString()
      // Show what the server says is now true right away, then read it again to confirm.
      setResult((previous) =>
        previous?.token === token && previous.kind === 'ready'
          ? { ...previous, summary: afterRemoval(previous.summary, state, action, at) }
          : previous
      )
      setMessage(state === 'photos_removed' ? ACTIONS.photos.done : '')
      setConfirming(null)
      setVersion((current) => current + 1)
    } catch {
      setErrorMessage(SERVER_ERROR)
    } finally {
      setBusy(false)
    }
  }

  const current = result?.token === token ? result : null
  const summary = current?.kind === 'ready' ? current.summary : null
  const removed = summary?.status === 'withdrawn'
  const canRemovePhotos = summary !== null && !removed && summary.hasPhotos
  const photosGoneOn =
    summary !== null && !removed && summary.status !== 'rejected' && !summary.hasPhotos
      ? summary.photosRemovedOn
      : null

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />

      <main className="flex-1">
        <section className="mx-auto max-w-xl px-6 py-12">
          <h1 className="font-serif text-h1 text-ink">Manage your story</h1>

          {current === null && <p className="mt-6 text-body text-ink-muted">Loading your story.</p>}

          {current?.kind === 'missing' && (
            <div className="mt-6">
              <p className="text-body-lg text-ink">We couldn't find that link.</p>
              <p className="mt-2 text-body text-ink-muted">
                Check that the whole link was copied, or look for the email or the link we showed you when you
                shared your story.
              </p>
              <Link to="/" className="mt-4 inline-block text-label text-brand underline">
                Back to the storyboard
              </Link>
            </div>
          )}

          {current?.kind === 'error' && (
            <p className="mt-6 text-body text-ink-muted">
              This page isn't loading right now. Try again in a bit.
            </p>
          )}

          {summary && (
            <>
              <p className="mt-3 text-body text-ink-muted">
                {removed
                  ? `${summary.storyRemovedOn ? `Removed on ${longDate(summary.storyRemovedOn)}. ` : ''}Nothing else is needed from you.`
                  : `This is your private link. From here you can remove ${canRemovePhotos ? 'your photos or your whole story' : 'your whole story'} at any time. Anyone who has this link can do the same, so keep it to yourself.`}
              </p>

              <p className="mt-6 rounded-md bg-trust-soft px-4 py-3 text-label text-ink">
                {STATUS_LINES[summary.status]}
              </p>

              {photosGoneOn ? (
                <p role="status" className="mt-4 text-body text-ink">
                  Your photos were removed on {longDate(photosGoneOn)}.
                </p>
              ) : (
                message &&
                !removed && (
                  <p role="status" className="mt-4 text-body text-ink">
                    {message}
                  </p>
                )
              )}

              {summary.story && (
                <div className="mt-8">
                  <h2 className="font-serif text-h2 text-ink">Your story</h2>
                  <div className={`mt-4 ${theme === 'corkboard' ? 'flex justify-center' : ''}`}>
                    <StoryCard story={summary.story} linked={false} />
                  </div>
                </div>
              )}

              {!removed && (
                <div className="mt-8 flex flex-col gap-4">
                  {canRemovePhotos && (
                    <RemoveAction
                      action="photos"
                      open={confirming === 'photos'}
                      busy={busy}
                      onOpen={() => setConfirming('photos')}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() => remove('photos')}
                    />
                  )}
                  <RemoveAction
                    action="story"
                    open={confirming === 'story'}
                    busy={busy}
                    onOpen={() => setConfirming('story')}
                    onCancel={() => setConfirming(null)}
                    onConfirm={() => remove('story')}
                  />
                  {errorMessage && (
                    <p role="alert" className="text-body text-ink">
                      {errorMessage}
                    </p>
                  )}
                </div>
              )}

              <p className="mt-8 text-caption text-ink-muted">
                Removal is immediate on the site. A copy that was already loaded somewhere can linger for a few
                minutes. If we posted a pin with your photos, we take it down too. Copies other people have already
                saved elsewhere are outside our control.
              </p>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
