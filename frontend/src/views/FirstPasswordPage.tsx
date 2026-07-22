import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, currentUser } from '../api'

export function FirstPasswordPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: currentUser })
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const mismatch = confirmation.length > 0 && password !== confirmation
  const mutation = useMutation({
    mutationFn: () => api<void>('/api/auth/first-password', { method: 'PUT', body: JSON.stringify({ new_password: password }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      await navigate({ to: '/' })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!mismatch) mutation.mutate()
  }

  if (isLoading) return <main className="auth-screen"><div className="skeleton h-80 w-full max-w-md" /></main>
  if (!user) return <Navigate to="/login" />
  if (!user.must_change_password) return <Navigate to="/" />

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand auth-brand"><span className="brand-dot" aria-hidden="true" /><span>mowa</span></div>
        <h1 className="first-password-title">Придумайте новый пароль</h1>
        <p className="auth-lead">Это ваш первый вход — задайте свой пароль вместо временного.</p>
        <form className="auth-form" onSubmit={submit}>
          <input className="text-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required placeholder="Новый пароль" aria-label="Новый пароль" />
          <input className="text-input" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required placeholder="Повторите пароль" aria-label="Повторите пароль" />
          {mismatch && <p className="inline-error">Пароли не совпадают</p>}
          {mutation.error && <p className="error-note" role="alert">{mutation.error.message}</p>}
          <button className="button-primary auth-submit" disabled={mutation.isPending || mismatch}>{mutation.isPending ? 'Сохраняем…' : 'Сохранить и продолжить'}</button>
        </form>
        <p className="auth-footnote">Минимум 8 символов</p>
      </section>
    </main>
  )
}
