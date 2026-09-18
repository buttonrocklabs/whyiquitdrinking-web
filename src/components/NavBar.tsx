import { Link } from 'react-router-dom'
import ThemeSwitcher from '@/components/ThemeSwitcher'

export default function NavBar() {
  return (
    <header className="border-b border-line bg-surface-raised">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-4">
        <Link to="/" className="font-display text-h2 text-ink">
          Why I Quit Drinking
        </Link>
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <Link
            to="/share"
            className="whitespace-nowrap rounded-md bg-brand px-4 py-2 text-label text-on-brand transition-colors hover:bg-brand/90"
          >
            Share your story
          </Link>
        </div>
      </div>
    </header>
  )
}
