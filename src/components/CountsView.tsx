import { useEffect, useState } from 'react'

interface PinCount {
  pin: string
  firstAt: string
  visits: number
  submitted: number
  approved: number
  smClicks: number
}

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; pins: PinCount[] }

async function fetchCounts(passphrase: string): Promise<PinCount[]> {
  const res = await fetch('/api/review/pin-stats', { headers: { Authorization: `Bearer ${passphrase}` } })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error('failed to load')
  const data = (await res.json()) as { pins: PinCount[] }
  return data.pins
}

/** The Counts tab: what each Pinterest pin brought, newest pin first. Counts are advisory. */
export default function CountsView({ passphrase }: { passphrase: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchCounts(passphrase).then(
      (pins) => {
        if (!cancelled) setState({ kind: 'ready', pins })
      },
      (error: Error) => {
        if (cancelled) return
        setState({
          kind: 'error',
          message:
            error.message === 'unauthorized'
              ? 'The passphrase was not accepted. Reload the page and unlock again.'
              : 'Could not load the counts. Try again.',
        })
      }
    )
    return () => {
      cancelled = true
    }
  }, [passphrase])

  return (
    <>
      <h1 className="font-serif text-h1 text-ink">Pin counts</h1>
      <p className="mt-2 text-caption text-ink-muted">
        Per pin, newest first. Counts are a guide: they come from browsers that run the page, with no names or
        addresses kept.
      </p>
      {state.kind === 'loading' && <p className="mt-8 text-body text-ink-muted">Loading.</p>}
      {state.kind === 'error' && <p className="mt-8 text-body text-alert">{state.message}</p>}
      {state.kind === 'ready' && state.pins.length === 0 && (
        <p className="mt-8 text-body text-ink-muted">No pin visits yet.</p>
      )}
      {state.kind === 'ready' && state.pins.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full min-w-[34rem] text-left text-body text-ink">
            <thead className="border-b border-line text-caption text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Pin</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Visits</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Stories submitted</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Approved</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Sober Motivation clicks</th>
              </tr>
            </thead>
            <tbody>
              {state.pins.map((row) => (
                <tr key={row.pin} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-normal break-all">{row.pin}</th>
                  <td className="px-4 py-3 text-right tabular-nums">{row.visits}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.submitted}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.approved}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.smClicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
