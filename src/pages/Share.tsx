import { useState, type FormEvent } from 'react'
import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'

type SubmitState = 'idle' | 'submitting' | 'done' | 'error'

export default function Share() {
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setErrorMessage('')

    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set('consent', formData.get('consent') === 'on' ? 'true' : 'false')

    try {
      const res = await fetch('/api/stories', { method: 'POST', body: formData })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error || 'Something went wrong. Try again.')
        setState('error')
        return
      }
      setState('done')
      form.reset()
    } catch {
      setErrorMessage('Something went wrong. Try again.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1">
          <section className="mx-auto max-w-xl px-6 py-24 text-center">
            <h1 className="font-serif text-h1 text-ink">Thank you.</h1>
            <p className="mt-4 text-body text-ink-muted">
              Your story is in the queue for review. Once it's approved, it'll show up on the
              homepage.
            </p>
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />

      <main className="flex-1">
        <section className="mx-auto max-w-xl px-6 py-16">
          <h1 className="font-serif text-h1 text-ink">Share your why</h1>
          <p className="mt-3 text-body text-ink-muted">
            Tell us why you quit or why you're questioning your drinking. A real person reviews
            every story before it goes public.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="display_name" className="text-label text-ink">
                Name (optional)
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                maxLength={100}
                placeholder="First name or leave blank to stay anonymous"
                className="rounded-md border border-line bg-surface-raised px-4 py-2 text-body text-ink"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="story_text" className="text-label text-ink">
                Your story
              </label>
              <textarea
                id="story_text"
                name="story_text"
                required
                rows={8}
                maxLength={4000}
                placeholder="What was it that made you decide to quit?"
                className="rounded-md border border-line bg-surface-raised px-4 py-2 text-body text-ink"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="photo" className="text-label text-ink">
                Photo (optional)
              </label>
              <input
                id="photo"
                name="photo"
                type="file"
                accept="image/*"
                className="text-body text-ink-muted"
              />
            </div>

            {/* Honeypot: hidden from real visitors, most bots fill every field they see in the DOM. */}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <label className="flex items-start gap-3 text-body text-ink-muted">
              <input id="consent" name="consent" type="checkbox" required className="mt-1" />
              I'm okay with this story (and photo, if I added one) being published on this site.
            </label>

            {state === 'error' && <p className="text-body text-alert">{errorMessage}</p>}

            <button
              type="submit"
              disabled={state === 'submitting'}
              className="rounded-md bg-brand px-8 py-3 text-label text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {state === 'submitting' ? 'Submitting…' : 'Submit your story'}
            </button>
          </form>
        </section>
      </main>

      <Footer />
    </div>
  )
}
