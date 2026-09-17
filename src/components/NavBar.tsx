import { Link } from 'react-router-dom'

export default function NavBar() {
  return (
    <header className="border-b border-line bg-surface-raised">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-serif text-h2 text-ink">
          Why I Quit Drinking
        </Link>
        <Link
          to="/share"
          className="rounded-md bg-brand px-4 py-2 text-label text-on-brand transition-colors hover:bg-brand/90"
        >
          Share your story
        </Link>
      </div>
    </header>
  )
}
