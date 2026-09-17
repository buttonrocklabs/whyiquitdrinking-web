import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'
import StoryCard, { type Story } from '@/components/StoryCard'

export default function Home() {
  const [stories, setStories] = useState<Story[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch('/api/stories')
      .then((res) => {
        if (!res.ok) throw new Error('failed to load stories')
        return res.json() as Promise<{ stories: Story[] }>
      })
      .then((data) => {
        if (!cancelled) setStories(data.stories)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-label uppercase tracking-[0.1em] text-brand">Real stories, not a treatment brochure</p>
          <h1 className="mt-4 font-serif text-display text-ink">Why I quit drinking.</h1>
          <p className="mx-auto mt-6 max-w-xl text-body-lg text-ink-muted">
            You don't have to hit rock bottom to decide this isn't working for you anymore.
            Here's why other people decided the same thing, in their own words.
          </p>
          <Link
            to="/share"
            className="mt-10 inline-block rounded-md bg-brand px-8 py-3 text-label text-on-brand transition-colors hover:bg-brand/90"
          >
            Share your why
          </Link>
        </section>

        <section className="border-t border-line bg-surface-raised">
          <div className="mx-auto max-w-5xl px-6 py-16">
            {error && (
              <p className="text-center text-body text-ink-muted">
                Stories aren't loading right now. Try again in a bit.
              </p>
            )}
            {!error && stories && stories.length === 0 && (
              <p className="text-center text-body text-ink-muted">
                The first stories are coming soon. Want to be one of them?
              </p>
            )}
            {stories && stories.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {stories.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
