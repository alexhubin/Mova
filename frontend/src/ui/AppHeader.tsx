import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Settings } from 'lucide-react'
import { api, currentUser } from '../api'

export function AppHeader() {
  const navigate = useNavigate()
  const inRoom = useRouterState({ select: (state) => state.location.pathname.startsWith('/r/') })
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
          <span className="hidden text-right sm:block"><strong className="block text-sm">{user.display_name}</strong><small className="text-ink-muted">@{user.username}</small></span>
          {inRoom ? (
            <button className="icon-button" onClick={() => window.dispatchEvent(new Event('mova:open-call-settings'))} aria-label="Настройки звонка" title="Настройки звонка"><Settings size={18} /></button>
          ) : (
            <Link to="/settings" className="icon-button" aria-label="Настройки" title="Настройки"><Settings size={18} /></Link>
          )}
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
