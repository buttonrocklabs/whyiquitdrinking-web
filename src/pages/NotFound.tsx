import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <h1 className="font-serif text-h1 text-ink">Page not found</h1>
      <Link to="/" className="text-body text-brand underline">
        Back home
      </Link>
    </div>
  )
}
