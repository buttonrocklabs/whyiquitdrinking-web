const SM_URL =
  'https://sobermotivation.net?utm_source=whyiquitdrinking&utm_medium=referral&utm_campaign=footer'

export default function Footer() {
  return (
    <footer className="border-t border-line bg-trust">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-caption text-on-trust">
        <p>© {new Date().getFullYear()} Why I Quit Drinking</p>
        <p>
          <a
            href="https://buttonrocklabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 opacity-80 transition-opacity hover:opacity-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-3.5 w-3.5" aria-hidden="true">
              <rect width="48" height="48" rx="10" fill="#B87333" />
              <path
                fill="white"
                fillRule="evenodd"
                d="M16 6 L24 22 L34 12 L38 42 L4 42 Z M17 29 A2 2 0 1 0 21 29 A2 2 0 1 0 17 29 Z M23 35 A2 2 0 1 0 27 35 A2 2 0 1 0 23 35 Z"
              />
              <path
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                d="m16 6 8 16 10-10 4 30H4L16 6z"
              />
            </svg>
            Hand-built at Button Rock Labs
          </a>
        </p>
        <p>
          Want more support day to day?{' '}
          <a href={SM_URL} className="underline hover:no-underline">
            Try Sober Motivation
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
