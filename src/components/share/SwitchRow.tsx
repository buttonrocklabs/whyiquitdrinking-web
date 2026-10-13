import type { ReactNode } from 'react'

/**
 * A whole-row on/off switch. The row is the tap target (at least 44px tall) and the label
 * text is whatever the caller passes, so consent wording renders exactly as written.
 */
export default function SwitchRow({
  checked,
  onChange,
  hint,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Short extra line under the label, such as "Required". */
  hint?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full cursor-pointer items-start gap-4 rounded-md border border-line bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface"
    >
      <span className="flex-1">
        <span className="block text-body text-ink">{children}</span>
        {hint && <span className="mt-1 block text-caption text-ink-muted">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? 'bg-brand' : 'bg-line-strong'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-surface-raised shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
