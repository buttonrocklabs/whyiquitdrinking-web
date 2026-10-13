import type { KeyboardEvent, ReactNode } from 'react'

export interface ReviewTab<Id extends string> {
  id: Id
  label: string
}

interface ReviewTabsProps<Id extends string> {
  tabs: readonly ReviewTab<Id>[]
  active: Id
  onChange: (id: Id) => void
  /** The active tab's content, rendered as the tab panel. */
  children: ReactNode
}

const tabDomId = (id: string) => `review-tab-${id}`
const panelDomId = (id: string) => `review-panel-${id}`

/**
 * The tab strip across the top of /review, with the active tab's content as its panel.
 * Left and right arrows move between tabs. It scrolls sideways instead of wrapping, so a
 * later tab (a Counts tab, for one) fits at phone width.
 */
export default function ReviewTabs<Id extends string>({ tabs, active, onChange, children }: ReviewTabsProps<Id>) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = tabs[(index + step + tabs.length) % tabs.length]
    onChange(next.id)
    document.getElementById(tabDomId(next.id))?.focus()
  }

  return (
    <div>
      <div role="tablist" aria-label="Moderator review" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab, index) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              id={tabDomId(tab.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelDomId(tab.id)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`min-h-11 shrink-0 border-b-2 px-5 py-2 text-label ${
                isActive ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={panelDomId(active)} aria-labelledby={tabDomId(active)} className="pt-8">
        {children}
      </div>
    </div>
  )
}
