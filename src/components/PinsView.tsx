import { useEffect, useState } from 'react'
import PinBuilder from '@/components/PinBuilder'
import { canBuildPin, pairOf, shortMonthYear, USE_LABELS, type ApprovedStory } from '@/lib/pinText'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; stories: ApprovedStory[] }

async function fetchApproved(passphrase: string): Promise<ApprovedStory[]> {
  const res = await fetch('/api/review/approved?pair=1', {
    headers: { Authorization: `Bearer ${passphrase}` },
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error('failed to load')
  const data = (await res.json()) as { stories: ApprovedStory[] }
  return data.stories
}

/**
 * The Pins tab: approved stories that have both photos and a pins or sm_board tick, newest
 * first. The server already drops withdrawn stories, consents and photos.
 */
export default function PinsView({ passphrase }: { passphrase: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchApproved(passphrase).then(
      (stories) => {
        if (!cancelled) setState({ kind: 'ready', stories })
      },
      (error: Error) => {
        if (cancelled) return
        setState({
          kind: 'error',
          message:
            error.message === 'unauthorized'
              ? 'The passphrase was not accepted. Reload the page and unlock again.'
              : 'The approved stories did not load. Try again in a bit.',
        })
      }
    )
    return () => {
      cancelled = true
    }
  }, [passphrase])

  if (state.kind === 'loading') return <p className="text-body text-ink-muted">Loading approved stories.</p>
  if (state.kind === 'error') {
    return (
      <p className="text-body text-alert" role="alert">
        {state.message}
      </p>
    )
  }

  const buildable = state.stories.filter((story) => pairOf(story.photos) !== null && canBuildPin(story.uses))
  const selected = buildable.find((story) => story.id === selectedId)
  const selectedPair = selected ? pairOf(selected.photos) : null

  if (selected && selectedPair) {
    return (
      <PinBuilder
        key={selected.id}
        story={selected}
        before={selectedPair.before}
        after={selectedPair.after}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return (
    <div>
      <h1 className="font-serif text-h1 text-ink">Pins ({buildable.length})</h1>
      <p className="mt-2 text-body text-ink-muted">
        Approved stories with a before and after pair and a pins or SM board tick.
      </p>

      {buildable.length === 0 && (
        <p className="mt-8 text-body text-ink-muted">No approved story is ready for a pin yet.</p>
      )}

      <ul className="mt-8 flex flex-col gap-4">
        {buildable.map((story) => {
          const pair = pairOf(story.photos)
          if (!pair) return null
          return (
            <li
              key={story.id}
              className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-4 sm:flex-row sm:items-center"
            >
              <div className="flex shrink-0 gap-2">
                <img
                  src={pair.before.url}
                  alt=""
                  loading="lazy"
                  className="aspect-[2/3] w-16 rounded-sm object-cover"
                />
                <img
                  src={pair.after.url}
                  alt=""
                  loading="lazy"
                  className="aspect-[2/3] w-16 rounded-sm object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body text-ink">{story.displayName || 'Anonymous'}</p>
                <p className="mt-1 text-caption text-ink-muted">
                  {shortMonthYear(pair.before.takenOn)} to {shortMonthYear(pair.after.takenOn)}, approved{' '}
                  {new Date(story.approvedAt).toLocaleDateString()}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Ticked uses">
                  {story.uses.map((use) => (
                    <li key={use} className="rounded-sm bg-growth-soft px-2 py-0.5 text-caption text-ink">
                      {USE_LABELS[use]}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(story.id)}
                className="min-h-11 shrink-0 rounded-md bg-brand px-5 py-2 text-label text-on-brand hover:bg-brand/90"
              >
                Build pin
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
