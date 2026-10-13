import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'
import StoryCard, { type Story as StoryData } from '@/components/StoryCard'
import NotFound from '@/pages/NotFound'

// Keyed by the id the answer belongs to, so a stale response never renders
// under a different /stories/:id and no reset-in-effect is needed.
type Result =
  | { id: string; kind: 'ready'; story: StoryData }
  | { id: string; kind: 'missing' | 'error' }

export default function Story() {
  const { id = '' } = useParams()
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/stories/${encodeURIComponent(id)}`)
      .then(async (res): Promise<Result> => {
        if (res.status === 404) return { id, kind: 'missing' }
        if (!res.ok) throw new Error('failed to load story')
        const data = (await res.json()) as { story: StoryData }
        return { id, kind: 'ready', story: data.story }
      })
      .catch((): Result => ({ id, kind: 'error' }))
      .then((next) => {
        if (!cancelled) setResult(next)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const current = result?.id === id ? result : null

  if (current?.kind === 'missing') return <NotFound />

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-12">
          <Link to="/" className="text-label text-brand underline">
            Back to the storyboard
          </Link>

          {current === null && <p className="mt-10 text-center text-body text-ink-muted">Loading the story.</p>}
          {current?.kind === 'error' && (
            <p className="mt-10 text-center text-body text-ink-muted">
              This story isn't loading right now. Try again in a bit.
            </p>
          )}
          {current?.kind === 'ready' && (
            <div className="mt-10 flex justify-center">
              <StoryCard story={current.story} linked={false} />
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
