import { Link } from 'react-router-dom'
import { useTheme } from '@/lib/theme'

export interface StoryPhoto {
  kind: 'before' | 'after'
  url: string
  /** YYYY-MM */
  takenOn: string
}

export interface Story {
  id: string
  displayName: string | null
  storyText: string
  photoUrl: string | null
  /** Before-and-after pair, before first. Empty or absent for a story without one. */
  photos?: StoryPhoto[]
  submittedAt: string
}

/** The two photos of a complete pair, or null: a story shows both or neither. */
function findPair(photos: StoryPhoto[] | undefined): [StoryPhoto, StoryPhoto] | null {
  const before = photos?.find((photo) => photo.kind === 'before')
  const after = photos?.find((photo) => photo.kind === 'after')
  return before && after ? [before, after] : null
}

function monthYear(takenOn: string, month: 'short' | 'long'): string {
  const [year, monthNumber] = takenOn.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-US', {
    month,
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * The before-and-after pair, one neutral block shared by every theme: two 3:4
 * photos side by side, before on the left, each captioned with its month. The
 * theme around it supplies the card chrome.
 */
export function PairBlock({ photos, className = '' }: { photos: StoryPhoto[] | undefined; className?: string }) {
  const pair = findPair(photos)
  if (!pair) return null
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {pair.map((photo) => {
        const label = photo.kind === 'before' ? 'Before' : 'After'
        return (
          <figure key={photo.kind} className="m-0 min-w-0">
            <img
              src={photo.url}
              alt={`${label} photo, taken ${monthYear(photo.takenOn, 'long')}`}
              loading="lazy"
              className="aspect-[3/4] w-full rounded-sm object-cover"
            />
            <figcaption className="mt-1 text-caption text-ink-muted">
              {label}, {monthYear(photo.takenOn, 'short')}
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}

interface StoryCardProps {
  story: Story
  index?: number
  /** Link the byline to the story's own page. The permalink page itself turns this off. */
  linked?: boolean
}

export default function StoryCard({ story, index = 0, linked = true }: StoryCardProps) {
  const theme = useTheme()
  const date = new Date(story.submittedAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const hasPair = findPair(story.photos) !== null
  const bylineText = `${story.displayName || 'Anonymous'}, ${date}`
  const byline = linked ? (
    <Link to={`/stories/${story.id}`} className="hover:underline">
      {bylineText}
    </Link>
  ) : (
    bylineText
  )

  if (theme === 'corkboard') {
    const tilt = index % 2 === 0 ? '-rotate-2' : 'rotate-2'
    return (
      <article className={`relative w-72 flex-shrink-0 bg-surface-raised p-4 pb-6 shadow-lg ${tilt}`}>
        <span className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-brand shadow" />
        {hasPair ? (
          <PairBlock photos={story.photos} />
        ) : (
          story.photoUrl && (
            <img src={story.photoUrl} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          )
        )}
        <p
          className={`whitespace-pre-line font-display text-lg leading-snug text-ink ${story.photoUrl || hasPair ? 'mt-4' : 'mt-2'}`}
        >
          "{story.storyText}"
        </p>
        <p className="mt-3 text-caption font-semibold text-ink-muted">{byline}</p>
      </article>
    )
  }

  if (theme === 'feed') {
    // A pair sits in the card body; the full-bleed background is for a single photo only.
    const background = hasPair ? null : story.photoUrl
    return (
      <article className="relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised">
        {background && (
          <img src={background} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {hasPair && <PairBlock photos={story.photos} className="p-5 pb-0" />}
        <div
          className={`relative mt-auto flex flex-col gap-2 p-5 ${
            background ? 'bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white' : 'text-ink'
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
      {hasPair ? (
        <PairBlock photos={story.photos} />
      ) : (
        <div className="overflow-hidden rounded-md shadow-sm">
          {story.photoUrl ? (
            <img src={story.photoUrl} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-brand-soft">
              <span className="font-display text-3xl italic text-brand">"</span>
            </div>
          )}
        </div>
      )}
      <p className="mt-4 font-display text-base italic leading-snug text-ink">"{story.storyText}"</p>
      <p className="mt-2 text-caption uppercase tracking-[0.08em] text-ink-muted">{byline}</p>
    </article>
  )
}
