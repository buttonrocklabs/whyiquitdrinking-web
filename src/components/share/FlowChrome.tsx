import { useId, type ReactNode } from 'react'

/** Back button (absent on the first step, its space kept) beside a segmented progress bar. */
export function FlowHeader({
  position,
  total,
  canGoBack,
  disabled,
  onBack,
}: {
  /** Zero-based position within the current mode's steps. */
  position: number
  total: number
  canGoBack: boolean
  disabled: boolean
  onBack: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 pb-2 pt-4 sm:px-5 sm:pt-5">
      {canGoBack ? (
        <button
          type="button"
          aria-label="Back"
          disabled={disabled}
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-surface disabled:opacity-40"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
      ) : (
        <span aria-hidden="true" className="h-11 w-11 shrink-0" />
      )}
      <div
        role="progressbar"
        aria-label={`Step ${position + 1} of ${total}`}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={position + 1}
        className="flex flex-1 gap-1.5 pr-3 sm:pr-0"
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`h-1.5 flex-1 rounded-full transition-colors ${index <= position ? 'bg-brand' : 'bg-line'}`}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The one primary button, pinned to the bottom of the viewport while the step scrolls (with
 * room for a phone's home bar), and the plain reason when it is off. Errors go in the alert region.
 */
export function FlowFooter({
  label,
  disabled,
  reason,
  error,
  errorAction,
  onContinue,
}: {
  label: string
  disabled: boolean
  reason: string | null
  error: string
  errorAction?: ReactNode
  onContinue: () => void
}) {
  const reasonId = useId()
  const why = reason && disabled ? reason : ''

  return (
    <div className="sticky bottom-0 z-10 rounded-b-md border-t border-line bg-surface-raised px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:pb-4">
      <div role="alert">
        {error && (
          <div className="mb-3 flex flex-col items-start gap-2">
            <p className="text-body text-alert">{error}</p>
            {errorAction}
          </div>
        )}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        {/* Always in the page, so a reason that appears or changes is read out; it takes no room while empty. */}
        <p
          id={reasonId}
          aria-live="polite"
          className={why ? 'mb-2 text-caption text-ink-muted sm:mb-0 sm:text-right' : undefined}
        >
          {why}
        </p>
        {/* aria-disabled, not disabled, so a keyboard visitor can still reach the button and hear the reason. */}
        <button
          type="button"
          aria-disabled={disabled}
          aria-describedby={why ? reasonId : undefined}
          onClick={() => {
            if (!disabled) onContinue()
          }}
          className="min-h-12 w-full cursor-pointer rounded-md bg-brand px-8 py-3 text-label text-on-brand transition-colors hover:bg-brand/90 aria-disabled:cursor-default aria-disabled:opacity-60 sm:w-auto sm:min-w-48"
        >
          {label}
        </button>
      </div>
    </div>
  )
}
