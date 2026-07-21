import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { api, currentUser } from '../api'

export function AppHeader() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: currentUser })
  const logout = useMutation({
    mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      queryClient.setQueryData(['me'], null)
      await navigate({ to: '/' })
    },
  })

  return (
    <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
      <Link to="/" className="group flex items-center gap-3" aria-label="Mova — главная">
        <span className="logo-mark" aria-hidden="true"><i /><i /><i /></span>
        <span className="font-display text-2xl font-semibold tracking-[-0.04em]">Mova</span>
      </Link>
      {user ? (
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden text-sm text-ink-muted sm:block">{user.display_name}</span>
          <button className="icon-button" onClick={() => logout.mutate()} aria-label="Выйти" title="Выйти">
            <LogOut size={18} />
          </button>
        </div>
      ) : (
        <nav className="flex items-center gap-2" aria-label="Аккаунт">
          <Link to="/login" className="button-ghost">Войти</Link>
          <Link to="/register" className="button-primary compact">Начать</Link>
        </nav>
      )}
    </header>
  )
}

