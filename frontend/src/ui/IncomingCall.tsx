import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Phone, PhoneOff } from 'lucide-react'
import { api, currentUser, type DirectCall } from '../api'
import { initials } from '../utils'

export function IncomingCall() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: currentUser })
  const calls = useQuery({
    queryKey: ['calls'],
    queryFn: () => api<DirectCall[]>('/api/calls'),
    enabled: Boolean(user),
    refetchInterval: user ? 2_000 : false,
  })
  const incoming = calls.data?.find((call) => call.incoming && call.status === 'ringing')
  const accept = useMutation({
    mutationFn: () => api<DirectCall>(`/api/calls/${incoming!.id}/accept`, { method: 'POST' }),
    onSuccess: async (call) => {
      await queryClient.invalidateQueries({ queryKey: ['calls'] })
      await navigate({ to: '/r/$inviteCode', params: { inviteCode: call.invite_code } })
    },
  })
  const decline = useMutation({
    mutationFn: () => api<void>(`/api/calls/${incoming!.id}/decline`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calls'] }),
  })

  if (!incoming || pathname.startsWith('/r/')) return null
  return (
    <aside className="incoming-call" role="dialog" aria-label={`Входящий звонок от ${incoming.peer.display_name}`}>
      <div className="participant-avatar">{initials(incoming.peer.display_name)}</div>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.12em] text-ink-muted">Входящий звонок</p><strong className="mt-1 block truncate">{incoming.peer.display_name}</strong><span className="text-xs text-ink-muted">@{incoming.peer.username}</span></div>
      <button className="call-answer" onClick={() => accept.mutate()} disabled={accept.isPending} aria-label="Принять"><Phone size={19} /></button>
      <button className="call-decline" onClick={() => decline.mutate()} disabled={decline.isPending} aria-label="Отклонить"><PhoneOff size={19} /></button>
    </aside>
  )
}
