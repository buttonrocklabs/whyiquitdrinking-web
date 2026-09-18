import { THEMES, setTheme, useTheme } from '@/lib/theme'

export default function ThemeSwitcher() {
  const active = useTheme()

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Choose a homepage theme">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          onClick={() => setTheme(theme.id)}
          title={`${theme.name} — ${theme.blurb}`}
          aria-label={`${theme.name} theme`}
          aria-pressed={active === theme.id}
          className={`h-6 w-6 shrink-0 overflow-hidden rounded-full border-2 transition-transform ${
            active === theme.id ? 'scale-110 border-ink' : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <span className="flex h-full w-full">
            {theme.swatches.map((color) => (
              <span key={color} className="h-full flex-1" style={{ backgroundColor: color }} />
            ))}
          </span>
        </button>
      ))}
    </div>
  )
}
