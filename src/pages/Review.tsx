import { useEffect, useState, type FormEvent } from 'react'
import PinsView from '@/components/PinsView'
import ReviewTabs from '@/components/ReviewTabs'
import { PairBlock, type Story } from '@/components/StoryCard'

const STORAGE_KEY = 'wiqd_review_passphrase'

type TabId = 'pending' | 'pins'
const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'pins', label: 'Pins' },
] as const

/** A pending story, with the wording its contributor agreed to (the stored consent text, one line per box). */
type ReviewStory = Story & { agreedTo?: string[] }

async function fetchPending(passphrase: string): Promise<ReviewStory[]> {
  const res = await fetch('/api/review/pending', {
    headers: { Authorization: `Bearer ${passphrase}` },
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (res.status === 429) throw new Error('locked')
  if (!res.ok) throw new Error('failed to load')
  const data = (await res.json()) as { stories: ReviewStory[] }
  return data.stories
}

async function reviewStory(
  passphrase: string,
  id: string,
  action: 'approve' | 'reject',
  rejectReason?: string
) {
  const res = await fetch(`/api/review/${id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${passphrase}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action, rejectReason }),
  })
  if (!res.ok) throw new Error('review action failed')
}

interface PendingListProps {
  stories: ReviewStory[]
  loadError: string
  onAction: (id: string, action: 'approve' | 'reject') => void
}

function PendingList({ stories, loadError, onAction }: PendingListProps) {
  return (
    <>
      <h1 className="font-serif text-h1 text-ink">Pending stories ({stories.length})</h1>
      {loadError && <p className="mt-4 text-body text-alert">{loadError}</p>}

      {stories.length === 0 && (
        <p className="mt-8 text-body text-ink-muted">Nothing waiting for review.</p>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {stories.map((story) => (
          <article key={story.id} className="rounded-lg border border-line bg-surface-raised p-6">
            {story.photoUrl && (
              <img
                src={story.photoUrl}
                alt=""
                className="mb-4 max-h-64 rounded-md object-cover"
              />
            )}
            <PairBlock photos={story.photos} className="mb-4 max-w-md" />
            <p className="whitespace-pre-line text-body text-ink">{story.storyText}</p>
            <p className="mt-3 text-caption text-ink-muted">
              {story.displayName || 'Anonymous'} · submitted{' '}
              {new Date(story.submittedAt).toLocaleString()}
            </p>
            {story.agreedTo && story.agreedTo.length > 0 && (
              <div className="mt-3">
                <p className="text-caption font-semibold text-ink">Agreed to</p>
                <ul className="mt-1 list-disc pl-5 text-caption text-ink-muted">
                  {story.agreedTo.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => onAction(story.id, 'approve')}
                className="rounded-md bg-growth px-4 py-2 text-label text-on-trust hover:opacity-90"
              >
                Approve
              </button>
              <button
                onClick={() => onAction(story.id, 'reject')}
                className="rounded-md bg-alert px-4 py-2 text-label text-on-trust hover:opacity-90"
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

export default function Review() {
  const [passphrase, setPassphrase] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [authError, setAuthError] = useState('')
  const [stories, setStories] = useState<ReviewStory[]>([])
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<TabId>('pending')

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) {
      fetchPending(saved)
        .then((loaded) => {
          setPassphrase(saved)
          setAuthorized(true)
          setStories(loaded)
        })
        .catch(() => sessionStorage.removeItem(STORAGE_KEY))
    }
  }, [])

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    try {
      const loaded = await fetchPending(passphrase)
      sessionStorage.setItem(STORAGE_KEY, passphrase)
      setAuthorized(true)
      setStories(loaded)
    } catch (error) {
      setAuthError(
        error instanceof Error && error.message === 'locked'
          ? 'Too many tries. Please try again in 30 minutes.'
          : 'Wrong passphrase.'
      )
    }
  }

  async function handleAction(id: string, action: 'approve' | 'reject') {
    let rejectReason: string | undefined
    if (action === 'reject') {
      rejectReason = window.prompt('Reason for rejecting (optional):') ?? undefined
    }
    try {
      await reviewStory(passphrase, id, action, rejectReason)
      setStories((prev) => prev.filter((story) => story.id !== id))
    } catch {
      setLoadError('That action failed. Try again.')
    }
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6">
        <form onSubmit={handleUnlock} className="flex w-full max-w-sm flex-col gap-4">
          <h1 className="font-serif text-h2 text-ink">Moderator review</h1>
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Passphrase"
            required
            className="rounded-md border border-line bg-surface-raised px-4 py-2 text-body text-ink"
          />
          {authError && <p className="text-body text-alert">{authError}</p>}
          <button
            type="submit"
            className="rounded-md bg-brand px-4 py-2 text-label text-on-brand hover:bg-brand/90"
          >
            Unlock
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <ReviewTabs tabs={TABS} active={tab} onChange={setTab}>
          {tab === 'pins' ? (
            <PinsView passphrase={passphrase} />
          ) : (
            <PendingList stories={stories} loadError={loadError} onAction={handleAction} />
          )}
        </ReviewTabs>
      </div>
    </div>
  )
}
