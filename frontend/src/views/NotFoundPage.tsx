import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <main className="page-shell grid min-h-[70dvh] place-items-center text-center">
      <div>
        <div className="font-mono text-sm text-accent">404</div>
        <h1 className="font-display mt-4 text-5xl font-semibold">Здесь тихо</h1>
        <p className="mt-3 text-ink-muted">Такой страницы или комнаты нет.</p>
        <Link to="/" className="button-primary mt-7">На главную</Link>
      </div>
    </main>
  )
}

