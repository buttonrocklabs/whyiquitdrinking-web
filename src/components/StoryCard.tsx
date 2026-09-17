export interface Story {
  id: string
  displayName: string | null
  storyText: string
  photoUrl: string | null
  submittedAt: string
}

export default function StoryCard({ story }: { story: Story }) {
  const date = new Date(story.submittedAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface-raised">
      {story.photoUrl && (
        <img
          src={story.photoUrl}
          alt=""
          className="aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
      )}
      <div className="flex flex-1 flex-col gap-3 p-6">
        <p className="whitespace-pre-line text-body text-ink">{story.storyText}</p>
        <p className="mt-auto text-caption text-ink-muted">
          {story.displayName || 'Anonymous'}, {date}
        </p>
      </div>
    </article>
  )
}
