import { useEffect, useRef, useState } from 'react'

/** The thank-you and the private link card, as the single-page form showed them. */
export default function DoneScreen({ manageUrl }: { manageUrl: string }) {
  const [copied, setCopied] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }, [])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(manageUrl)
      setCopied(true)
    } catch {
      // The link is selectable on screen, so a blocked clipboard costs nothing.
    }
  }

  return (
    <section className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 ref={heading} tabIndex={-1} className="font-serif text-h1 text-ink outline-none">
        Thank you.
      </h1>
      <p className="mt-4 text-body text-ink-muted">
        Your story is in the queue for review. Once it's approved, it'll show up on the homepage.
      </p>

      {manageUrl && (
        <div className="mt-10 rounded-md border border-line bg-surface-raised p-6 text-left">
          <h2 className="font-serif text-h2 text-ink">Your private link</h2>
          <p className="mt-2 text-body text-ink-muted">
            Save this link. It lets you remove your photos or your whole story at any time. Anyone who has it can do
            the same, so keep it to yourself.
          </p>
          <p className="mt-4 select-all break-all rounded-sm bg-surface px-3 py-2 text-label text-ink">{manageUrl}</p>
          <button
            type="button"
            onClick={copyLink}
            className="mt-4 min-h-11 cursor-pointer rounded-md bg-brand px-4 py-2 text-label text-on-brand transition-colors hover:bg-brand/90"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}
    </section>
  )
}
