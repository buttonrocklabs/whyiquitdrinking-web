import { Link } from 'react-router-dom'

const EYEBROW = 'Real stories, not a treatment brochure'
const SUBHEAD =
  "You don't have to hit rock bottom to decide this isn't working for you. Here's why other people decided the same thing, in their own words."

export default function Hero({ storyCount }: { storyCount: number }) {
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
