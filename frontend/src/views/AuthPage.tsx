import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { api, type User } from '../api'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const isRegister = mode === 'register'

  const mutation = useMutation({
    mutationFn: () => api<User>(`/api/auth/${mode}`, {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(isRegister ? { display_name: displayName, username } : {}) }),
    }),
    onSuccess: async (user) => {
      queryClient.setQueryData(['me'], user)
      const next = new URLSearchParams(window.location.search).get('next')
      if (next?.startsWith('/') && !next.startsWith('//')) window.location.assign(next)
      else await navigate({ to: '/' })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <main className="page-shell grid min-h-[calc(100dvh-5rem)] place-items-center py-10">
      <section className="auth-card">
        <div className="eyebrow">{isRegister ? 'Новый аккаунт' : 'С возвращением'}</div>
        <h1 className="font-display mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
          {isRegister ? 'Давайте знакомиться' : 'Продолжим разговор'}
        </h1>
        <p className="mt-3 text-ink-muted">
          {isRegister ? 'Создайте аккаунт — это займёт меньше минуты.' : 'Войдите, чтобы вернуться в свои комнаты.'}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          {isRegister && (
            <>
              <label className="field-label">
                Как вас называть
                <input className="text-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} maxLength={40} autoComplete="name" required placeholder="Анна" />
              </label>
              <label className="field-label">
                Username
                <input className="text-input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} minLength={3} maxLength={32} pattern="[a-z0-9_]+" autoComplete="username" required placeholder="anna_voice" />
              </label>
            </>
          )}
          <label className="field-label">
            Email
            <input className="text-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" />
          </label>
          <label className="field-label">
            Пароль
            <input className="text-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} maxLength={128} autoComplete={isRegister ? 'new-password' : 'current-password'} required placeholder="Не менее 8 символов" />
          </label>
          {mutation.error && <p className="error-note" role="alert">{mutation.error.message}</p>}
          <button className="button-primary w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Минутку…' : isRegister ? 'Создать аккаунт' : 'Войти'}
            {!mutation.isPending && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {isRegister ? 'Уже есть аккаунт?' : 'Впервые в Mova?'}{' '}
          <Link to={isRegister ? '/login' : '/register'} className="font-semibold text-ink underline decoration-accent underline-offset-4">
            {isRegister ? 'Войти' : 'Зарегистрироваться'}
          </Link>
        </p>
      </section>
    </main>
  )
}
