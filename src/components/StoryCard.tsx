import { useTheme } from '@/lib/theme'

export interface Story {
  id: string
  displayName: string | null
  storyText: string
  photoUrl: string | null
  submittedAt: string
}

export default function StoryCard({ story, index = 0 }: { story: Story; index?: number }) {
  const theme = useTheme()
  const date = new Date(story.submittedAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const byline = `${story.displayName || 'Anonymous'} — ${date}`

  if (theme === 'corkboard') {
    const tilt = index % 2 === 0 ? '-rotate-2' : 'rotate-2'
    return (
      <article className={`relative w-72 flex-shrink-0 bg-surface-raised p-4 pb-6 shadow-lg ${tilt}`}>
        <span className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-brand shadow" />
        {story.photoUrl && (
          <img src={story.photoUrl} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        )}
        <p
          className={`whitespace-pre-line font-display text-lg leading-snug text-ink ${story.photoUrl ? 'mt-4' : 'mt-2'}`}
        >
          "{story.storyText}"
        </p>
        <p className="mt-3 text-caption font-semibold text-ink-muted">— {byline}</p>
      </article>
    )
  }

  if (theme === 'feed') {
    return (
      <article className="relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised">
        {story.photoUrl && (
          <img src={story.photoUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div
          className={`relative mt-auto flex flex-col gap-2 p-5 ${
            story.photoUrl ? 'bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white' : 'text-ink'
          }`}
        >
          <p className="whitespace-pre-line text-sm font-semibold leading-snug">{story.storyText}</p>
          <p className="text-caption uppercase tracking-[0.06em] opacity-80">{byline}</p>
        </div>
      </article>
    )
  }

  // archive
  return (
    <article className="flex flex-col">
      <div className="overflow-hidden rounded-md shadow-sm">
        {story.photoUrl ? (
          <img src={story.photoUrl} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-brand-soft">
            <span className="font-display text-3xl italic text-brand">"</span>
          </div>
        )}
      </div>
      <p className="mt-4 font-display text-base italic leading-snug text-ink">"{story.storyText}"</p>
      <p className="mt-2 text-caption uppercase tracking-[0.08em] text-ink-muted">{byline}</p>
    </article>
  )
}
