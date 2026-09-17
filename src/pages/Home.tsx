import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'

// TODO(WIQD): swap for the AppsFlyer OneLink smart-link once attribution
// is configured, so an install here can be traced back to this site
// instead of showing up as an unattributed organic install.
const APP_STORE_URL = 'https://apps.apple.com/app/id6759266291'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="text-label uppercase tracking-[0.1em] text-brand">Your why, not your bottom</p>
          <h1 className="mt-4 font-serif text-display text-ink">Here's why I finally quit.</h1>
          <p className="mx-auto mt-6 max-w-xl text-body-lg text-ink-muted">
            You don't have to hit rock bottom to decide this isn't working for you anymore.
          </p>
          <a
            id="app"
            href={APP_STORE_URL}
            className="mt-10 inline-block rounded-md bg-brand px-8 py-3 text-label text-on-brand transition-colors hover:bg-brand/90"
          >
            Get the app
          </a>
        </section>

        <section className="border-t border-line bg-surface-raised">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
            <div className="rounded-lg bg-growth-soft p-6">
              <h2 className="font-serif text-h2 text-ink">Track your streak</h2>
              <p className="mt-2 text-body text-ink-muted">
                A reason to open the app tomorrow, not just today.
              </p>
            </div>
            <div className="rounded-lg bg-brand-soft p-6">
              <h2 className="font-serif text-h2 text-ink">Read someone else's why</h2>
              <p className="mt-2 text-body text-ink-muted">
                Real, specific stories — not a treatment brochure.
              </p>
            </div>
            <div className="rounded-lg bg-trust-soft p-6">
              <h2 className="font-serif text-h2 text-ink">Log a craving at 2am</h2>
              <p className="mt-2 text-body text-ink-muted">
                Somewhere to go before the wine after the kids' bedtime.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
