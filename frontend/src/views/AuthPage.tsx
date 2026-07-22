import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type User } from '../api'

export function AuthPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => api<User>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    onSuccess: async (user) => {
      queryClient.setQueryData(['me'], user)
      const next = new URLSearchParams(window.location.search).get('next')
      if (user.must_change_password) await navigate({ to: '/first-password' })
      else if (next?.startsWith('/') && !next.startsWith('//')) window.location.assign(next)
      else await navigate({ to: '/' })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand auth-brand"><span className="brand-dot" aria-hidden="true" /><span>mowa</span></div>
        <p className="auth-lead">Голос и экран — для своих.<br />Без серверов, каналов и лишнего.</p>
        <form onSubmit={submit} className="auth-form">
          <input className="text-input" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="Email" aria-label="Email" />
          <input className="text-input" value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} maxLength={128} autoComplete="current-password" required placeholder="Пароль" aria-label="Пароль" />
          {mutation.error && <p className="error-note" role="alert">{mutation.error.message}</p>}
          <button className="button-primary auth-submit" disabled={mutation.isPending}>{mutation.isPending ? 'Минутку…' : 'Войти'}</button>
        </form>
        <p className="auth-footnote">Аккаунты создаёт администратор Mowa</p>
      </section>
    </main>
  )
}
