import { useEffect, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { api, currentUser } from '../api'
import { initials } from '../utils'

type Theme = 'light' | 'dark'

export function AppHeader() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const queryClient = useQueryClient()
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: currentUser })
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('mova-theme') === 'dark' ? 'dark' : 'light')
  const logout = useMutation({
    mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      queryClient.setQueryData(['me'], null)
      await navigate({ to: '/login' })
    },
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('mova-theme', theme)
  }, [theme])

  if (!user || user.must_change_password || pathname.startsWith('/r/') || pathname === '/login' || pathname === '/first-password') return null

  return (
    <aside className="app-sidebar">
      <Link to="/" className="brand" aria-label="Mowa — друзья">
        <span className="brand-dot" aria-hidden="true" />
        <span>mowa</span>
      </Link>

      <nav className="sidebar-nav" aria-label="Основная навигация">
        <Link to="/" className={`sidebar-link ${pathname === '/' ? 'active' : ''}`}>Друзья</Link>
        <Link to="/settings" className={`sidebar-link ${pathname === '/settings' ? 'active' : ''}`}>Настройки</Link>
      </nav>

      <div className="sidebar-spacer" />
      <div className="theme-switch" aria-label="Цветовая тема">
        <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Светлая</button>
        <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Тёмная</button>
      </div>

      <div className="sidebar-profile">
        <span className="sidebar-avatar">{initials(user.display_name)}<i /></span>
        <span className="sidebar-user"><strong>{user.display_name}</strong><small>@{user.username} · в сети</small></span>
        <button className="sidebar-logout" onClick={() => logout.mutate()} aria-label="Выйти" title="Выйти"><LogOut size={17} /></button>
      </div>
    </aside>
  )
}
