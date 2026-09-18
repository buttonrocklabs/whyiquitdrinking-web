import { Link } from 'react-router-dom'
import { useTheme } from '@/lib/theme'

const EYEBROW = 'Real stories, not a treatment brochure'
const SUBHEAD =
  "You don't have to hit rock bottom to decide this isn't working for you. Here's why other people decided the same thing, in their own words."

export default function Hero({ storyCount }: { storyCount: number }) {
  const theme = useTheme()

  if (theme === 'feed') {
    return (
      <section className="border-b border-line px-6 pb-16 pt-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-label uppercase tracking-[0.1em] text-brand">{EYEBROW}</p>
          <h1 className="mt-4 font-display text-6xl font-bold leading-[1.02] tracking-tight text-ink sm:text-7xl">
            their reasons.
            <br />
            on camera.
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-ink-muted">{SUBHEAD}</p>
          <Link
            to="/share"
            className="mt-10 inline-block rounded-full bg-brand px-8 py-3 text-label font-semibold text-on-brand transition-opacity hover:opacity-90"
          >
            Share your why →
          </Link>
          {storyCount > 0 && (
            <p className="mt-10 text-body text-ink-muted">
              <span className="font-display text-4xl font-bold text-brand">{storyCount}</span>{' '}
              {storyCount === 1 ? 'story' : 'stories'} shared so far
            </p>
          )}
        </div>
      </section>
    )
  }

  if (theme === 'archive') {
    return (
      <section className="px-6 pb-16 pt-20 text-center">
        <p className="text-label uppercase tracking-[0.14em] text-ink-muted">a growing archive, kept in the open</p>
        <h1 className="mx-auto mt-5 max-w-2xl font-display text-6xl italic text-ink sm:text-7xl">
          Why I quit, in my own words.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-body-lg text-ink-muted">{SUBHEAD}</p>
        <Link
          to="/share"
          className="mt-10 inline-block border border-brand px-8 py-3 text-label text-brand transition-colors hover:bg-brand hover:text-on-brand"
        >
          Add your story →
        </Link>
        {storyCount > 0 && (
          <div className="mx-auto mt-12 max-w-xs">
            <div className="mx-auto h-px w-16 bg-line-strong" />
            <p className="mt-4 font-display text-4xl text-ink">{storyCount}</p>
            <p className="mt-1 text-caption uppercase tracking-[0.1em] text-ink-muted">
              {storyCount === 1 ? 'story' : 'stories'} documented
            </p>
          </div>
        )}
      </section>
    )
  }

  // corkboard (default)
  return (
    <section className="px-6 pb-16 pt-20 text-center">
      <p className="text-label uppercase tracking-[0.1em] text-brand">{EYEBROW}</p>
      <h1 className="mt-4 -rotate-1 font-display text-6xl text-ink sm:text-7xl">
        why i quit
        <br />
        drinking.
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-body-lg text-ink-muted">{SUBHEAD}</p>
      <Link
        to="/share"
        className="mt-10 inline-block -rotate-1 rounded-sm bg-surface-raised px-8 py-3 text-label text-ink shadow-lg transition-transform hover:rotate-0"
      >
        Share your why →
      </Link>
      {storyCount > 0 && (
        <div className="mx-auto mt-12 max-w-xs rotate-1 rounded-sm bg-surface-raised px-6 py-4 shadow-lg">
          <p className="font-display text-3xl text-brand">{storyCount}</p>
          <p className="text-caption text-ink-muted">
            {storyCount === 1 ? 'story' : 'stories'} pinned to the board so far
          </p>
        </div>
      )}
    </section>
  )
}
