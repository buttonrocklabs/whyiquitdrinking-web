import { useEffect, useState, type FormEvent } from 'react'
import type { Story } from '@/components/StoryCard'

const STORAGE_KEY = 'wiqd_review_passphrase'

async function fetchPending(passphrase: string): Promise<Story[]> {
  const res = await fetch('/api/review/pending', {
    headers: { Authorization: `Bearer ${passphrase}` },
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error('failed to load')
  const data = (await res.json()) as { stories: Story[] }
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

export default function Review() {
  const [passphrase, setPassphrase] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [authError, setAuthError] = useState('')
  const [stories, setStories] = useState<Story[]>([])
  const [loadError, setLoadError] = useState('')

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
    } catch {
      setAuthError('Wrong passphrase.')
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
              <p className="whitespace-pre-line text-body text-ink">{story.storyText}</p>
              <p className="mt-3 text-caption text-ink-muted">
                {story.displayName || 'Anonymous'} · submitted{' '}
                {new Date(story.submittedAt).toLocaleString()}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleAction(story.id, 'approve')}
                  className="rounded-md bg-growth px-4 py-2 text-label text-on-trust hover:opacity-90"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(story.id, 'reject')}
                  className="rounded-md bg-alert px-4 py-2 text-label text-on-trust hover:opacity-90"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
