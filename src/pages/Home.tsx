import { useEffect, useState } from 'react'
import Footer from '@/components/Footer'
import Hero from '@/components/Hero'
import NavBar from '@/components/NavBar'
import StoryCard, { type Story } from '@/components/StoryCard'
import { useTheme } from '@/lib/theme'

export default function Home() {
  const theme = useTheme()
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
        <Hero storyCount={stories?.length ?? 0} />

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
              <div
                className={
                  theme === 'corkboard'
                    ? 'flex flex-wrap items-start justify-center gap-10'
                    : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'
                }
              >
                {stories.map((story, index) => (
                  <StoryCard key={story.id} story={story} index={index} />
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
