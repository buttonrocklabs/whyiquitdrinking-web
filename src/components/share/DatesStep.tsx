import { useRef, useState } from 'react'
import MonthPicker from './MonthPicker'
import PhotoThumb from './PhotoThumb'
import { MONTHS, type FlowData, type MonthYear } from './types'

type Which = 'before' | 'after'

const ROWS: { key: Which; label: string }[] = [
  { key: 'before', label: 'Before' },
  { key: 'after', label: 'After' },
]

function describe(value: MonthYear): string {
  return value.year && value.month ? `${MONTHS[Number(value.month) - 1]} ${value.year}` : ''
}

/** Step 3 (pair only): one row per photo; tapping a row opens its month picker inline. */
export default function DatesStep({
  data,
  onDate,
}: {
  data: FlowData
  onDate: (key: Which, value: MonthYear) => void
}) {
  const [open, setOpen] = useState<Which | null>(null)
  const triggers = useRef<Record<Which, HTMLButtonElement | null>>({ before: null, after: null })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-muted">Choose the month each photo was taken.</p>

      <ul className="flex flex-col gap-3">
        {ROWS.map(({ key, label }) => {
          const chosen = describe(data.dates[key])
          return (
            <li key={key}>
              <button
                type="button"
                ref={(element) => {
                  triggers.current[key] = element
                }}
                aria-expanded={open === key}
                onClick={() => setOpen(open === key ? null : key)}
                className="flex min-h-20 w-full cursor-pointer items-center gap-4 rounded-md border border-line bg-surface-raised p-3 text-left transition-colors hover:bg-surface"
              >
                <PhotoThumb file={data.photos[key]?.baked ?? data.photos[key]?.clean ?? null} className="h-16 w-12 rounded-sm" />
                <span className="flex-1">
                  <span className="block text-label text-ink">{label}</span>
                  <span className={`block text-body ${chosen ? 'text-ink' : 'text-brand'}`}>{chosen || 'Add the month'}</span>
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-5 w-5 shrink-0 text-ink-muted transition-transform ${open === key ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {open === key && (
                <MonthPicker
                  label={label}
                  value={data.dates[key]}
                  onPick={(value) => {
                    onDate(key, value)
                    setOpen(null)
                    triggers.current[key]?.focus()
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
