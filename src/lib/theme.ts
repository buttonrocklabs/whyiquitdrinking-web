import { useEffect, useState } from 'react'

export type ThemeId = 'corkboard' | 'feed' | 'archive'

export interface ThemeDef {
  id: ThemeId
  name: string
  blurb: string
  swatches: [string, string, string]
}

export const THEMES: ThemeDef[] = [
  { id: 'corkboard', name: 'Corkboard', blurb: 'Warm & hand-pinned', swatches: ['#f2e6d3', '#a34a26', '#3c6249'] },
  { id: 'feed', name: 'Feed', blurb: 'Bold & cinematic', swatches: ['#0b0b0d', '#ff7a45', '#f5f1e8'] },
  { id: 'archive', name: 'Archive', blurb: 'Calm & curated', swatches: ['#faf7f0', '#2f4a3c', '#1d1a15'] },
]

const STORAGE_KEY = 'wiqd-theme'
const DEFAULT_THEME: ThemeId = 'corkboard'
const THEME_EVENT = 'wiqd-theme-change'

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isThemeId(stored) ? stored : DEFAULT_THEME
}

/** Call once, before the app renders, so there's no flash of the default theme. */
export function applySavedTheme(): void {
  document.documentElement.dataset.theme = getTheme()
}

export function setTheme(id: ThemeId): void {
  window.localStorage.setItem(STORAGE_KEY, id)
  document.documentElement.dataset.theme = id
  window.dispatchEvent(new CustomEvent<ThemeId>(THEME_EVENT, { detail: id }))
}

export function useTheme(): ThemeId {
  const [theme, setThemeState] = useState<ThemeId>(getTheme)

  useEffect(() => {
    const handler = (event: Event) => {
      setThemeState((event as CustomEvent<ThemeId>).detail)
    }
    window.addEventListener(THEME_EVENT, handler)
    return () => window.removeEventListener(THEME_EVENT, handler)
  }, [])

  return theme
}
