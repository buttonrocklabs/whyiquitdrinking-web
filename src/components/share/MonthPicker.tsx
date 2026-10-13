import { useState } from 'react'
import { PAIR_MIN_YEAR } from '../../../shared/pair'
import { MONTHS, type MonthYear } from './types'

const STEP_BUTTON =
  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-surface disabled:cursor-default disabled:opacity-40'

/**
 * A year stepper over a 4 by 3 grid of months. Months after the current one (in UTC, the way
 * the server judges it) are off. Choosing a month hands back the year and month and the
 * caller closes the picker. The year shown is only a view until a month is chosen.
 */
export default function MonthPicker({
  label,
  value,
  onPick,
}: {
  label: string
  value: MonthYear
  onPick: (value: MonthYear) => void
}) {
  const now = new Date()
  const thisYear = now.getUTCFullYear()
  const thisMonth = now.getUTCMonth() + 1
  const [year, setYear] = useState(value.year ? Number(value.year) : thisYear)

  return (
    <div role="group" aria-label={`${label}, month and year`} className="mt-2 rounded-md border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Earlier year"
          disabled={year <= PAIR_MIN_YEAR}
          onClick={() => setYear(year - 1)}
          className={STEP_BUTTON}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <span aria-live="polite" className="text-body font-semibold text-ink">
          {year}
        </span>
        <button
          type="button"
          aria-label="Later year"
          disabled={year >= thisYear}
          onClick={() => setYear(year + 1)}
          className={STEP_BUTTON}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {MONTHS.map((name, index) => {
          const number = index + 1
          const future = year > thisYear || (year === thisYear && number > thisMonth)
          const selected = value.year === String(year) && value.month === String(number).padStart(2, '0')
          return (
            <button
              key={name}
              type="button"
              aria-label={`${name} ${year}`}
              aria-pressed={selected}
              disabled={future}
              onClick={() => onPick({ year: String(year), month: String(number).padStart(2, '0') })}
              className={`min-h-11 cursor-pointer rounded-md border text-label transition-colors disabled:cursor-default disabled:opacity-40 ${
                selected
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line bg-surface-raised text-ink hover:bg-brand-soft'
              }`}
            >
              {name.slice(0, 3)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
