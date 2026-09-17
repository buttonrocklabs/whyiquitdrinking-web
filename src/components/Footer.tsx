const SM_URL =
  'https://sobermotivation.net?utm_source=whyiquitdrinking&utm_medium=referral&utm_campaign=footer'

export default function Footer() {
  return (
    <footer className="border-t border-line bg-trust">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-caption text-on-trust">
        <p>© {new Date().getFullYear()} Why I Quit Drinking. A Button Rock Labs property.</p>
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
