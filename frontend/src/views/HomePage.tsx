import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Check, Phone, PhoneOff, UserPlus, X } from 'lucide-react'
import { api, currentUser, type DirectCall, type FriendsPayload, type FriendUser, type RoomInfo } from '../api'
import { initials } from '../utils'

export function HomePage() {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: currentUser })
  if (isLoading) return <main className="app-page"><div className="skeleton h-80" /></main>
  if (!user) return <Navigate to="/login" />
  if (user.must_change_password) return <Navigate to="/first-password" />
  return <Dashboard name={user.display_name} />
}

function Dashboard({ name }: { name: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinValue, setJoinValue] = useState('')
  const friends = useQuery({ queryKey: ['friends'], queryFn: () => api<FriendsPayload>('/api/friends'), refetchInterval: 30_000 })
  const calls = useQuery({ queryKey: ['calls'], queryFn: () => api<DirectCall[]>('/api/calls') })
  const searchQuery = useQuery({
    queryKey: ['user-search', search],
    queryFn: () => api<FriendUser[]>(`/api/users/search?q=${encodeURIComponent(search.trim().replace(/^@/, ''))}`),
    enabled: search.trim().length >= 2,
  })
  const refreshFriends = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['friends'] }),
    queryClient.invalidateQueries({ queryKey: ['user-search'] }),
  ])
  const sendRequest = useMutation({ mutationFn: (target: FriendUser) => api('/api/friend-requests', { method: 'POST', body: JSON.stringify({ username: target.username }) }), onSuccess: refreshFriends })
  const acceptRequest = useMutation({ mutationFn: (id: string) => api(`/api/friend-requests/${id}/accept`, { method: 'POST' }), onSuccess: refreshFriends })
  const declineRequest = useMutation({ mutationFn: (id: string) => api(`/api/friend-requests/${id}`, { method: 'DELETE' }), onSuccess: refreshFriends })
  const startCall = useMutation({
    mutationFn: (friend: FriendUser) => api<DirectCall>('/api/calls', { method: 'POST', body: JSON.stringify({ user_id: friend.id }) }),
    onSuccess: async (call) => { await queryClient.invalidateQueries({ queryKey: ['calls'] }); await navigate({ to: '/r/$inviteCode', params: { inviteCode: call.invite_code } }) },
  })
  const createRoom = useMutation({
    mutationFn: () => api<RoomInfo>('/api/rooms', { method: 'POST', body: JSON.stringify({ name: `Комната ${name}` }) }),
    onSuccess: (room) => navigate({ to: '/r/$inviteCode', params: { inviteCode: room.invite_code } }),
  })
  const outgoing = calls.data?.find((call) => !call.incoming && call.status === 'ringing')
  const requests = friends.data?.incoming ?? []

  function joinRoom(event: FormEvent) {
    event.preventDefault()
    const raw = joinValue.trim().replace(/\/+$/, '')
    const code = raw.split('/').pop()?.trim()
    if (!code) return
    void navigate({ to: '/r/$inviteCode', params: { inviteCode: code } })
  }

  return (
    <main className="app-page friends-page">
      <header className="page-heading">
        <h1>Друзья</h1>
        <div className="heading-actions">
          <button className="button-secondary" onClick={() => setJoinOpen(true)}>Войти по коду</button>
          <button className="button-primary" onClick={() => createRoom.mutate()} disabled={createRoom.isPending}>Создать комнату <ArrowUpRight size={17} /></button>
        </div>
      </header>

      <div className="friend-search-form">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Добавить друга по нику, например @sonya" aria-label="Найти друга" />
        <span className="search-action-label">Выберите человека ниже</span>
      </div>
      {(createRoom.error || startCall.error || sendRequest.error) && <p className="error-note dashboard-error">{createRoom.error?.message || startCall.error?.message || sendRequest.error?.message}</p>}

      {search.trim().length >= 2 && (
        <section className="search-results" aria-label="Результаты поиска">
          {searchQuery.isLoading && <div className="skeleton h-16" />}
          {searchQuery.data?.map((person) => <SearchRow key={person.id} person={person} onAdd={() => sendRequest.mutate(person)} busy={sendRequest.isPending} />)}
          {searchQuery.data?.length === 0 && <EmptyList text="Никого не нашли." />}
        </section>
      )}

      {outgoing && <button className="outgoing-call" onClick={() => navigate({ to: '/r/$inviteCode', params: { inviteCode: outgoing.invite_code } })}><span className="live-dot" /><span>Звоним <strong>{outgoing.peer.display_name}</strong>…</span><ArrowUpRight size={18} /></button>}

      {requests.length > 0 && (
        <section className="friends-section requests-section">
          <h2>Заявки в друзья <span>{requests.length}</span></h2>
          <div className="request-list">
            {requests.map((request) => (
              <article className="request-card" key={request.id}>
                <Avatar name={request.user.display_name} />
                <UserLabel user={request.user} detail="хочет добавить вас" />
                <button className="button-primary compact" onClick={() => acceptRequest.mutate(request.id)}><Check size={16} /> Принять</button>
                <button className="button-secondary compact" onClick={() => declineRequest.mutate(request.id)}><X size={16} /> Отклонить</button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="friends-section">
        <h2>Все друзья <span>{friends.data?.friends.length ?? 0}</span></h2>
        <div className="friends-table">
          {friends.isLoading && <div className="skeleton h-40" />}
          {friends.data?.friends.map((friend) => <FriendRow key={friend.id} friend={friend} onCall={() => startCall.mutate(friend)} busy={startCall.isPending} />)}
          {friends.data?.friends.length === 0 && <EmptyList text="Здесь появятся люди, которых вы добавите." />}
          <footer>Звонить можно друзьям, которые сейчас в сети. Для группы создайте комнату и пришлите ссылку.</footer>
        </div>
      </section>

      {joinOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setJoinOpen(false) }}>
          <form className="simple-modal" onSubmit={joinRoom}>
            <h2>Войти в комнату</h2>
            <p>Вставьте код комнаты или ссылку-приглашение.</p>
            <input className="text-input" value={joinValue} onChange={(event) => setJoinValue(event.target.value)} placeholder="MOWA-XXXX или ссылка" autoFocus />
            <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setJoinOpen(false)}>Отмена</button><button className="button-primary">Войти</button></div>
          </form>
        </div>
      )}
    </main>
  )
}

function FriendRow({ friend, onCall, busy }: { friend: FriendUser; onCall: () => void; busy: boolean }) {
  return <article className={`friend-row ${friend.online ? '' : 'offline-row'}`}><Avatar name={friend.display_name} online={friend.online} /><UserLabel user={friend} detail={friend.online ? 'в сети' : 'не в сети'} /><button className="friend-call" onClick={onCall} disabled={busy || !friend.online} aria-label={friend.online ? `Позвонить ${friend.display_name}` : `${friend.display_name} не в сети`} title={friend.online ? 'Позвонить' : 'Пользователь не в сети'}>{friend.online ? <Phone size={16} /> : <PhoneOff size={16} />}<span>{friend.online ? 'Позвонить' : 'Не в сети'}</span></button></article>
}

function SearchRow({ person, onAdd, busy }: { person: FriendUser; onAdd: () => void; busy: boolean }) {
  const available = person.relationship === 'none'
  const label = person.relationship === 'friends' ? 'Уже в друзьях' : person.relationship === 'request_sent' ? 'Заявка отправлена' : person.relationship === 'request_received' ? 'Ответьте в заявках' : 'Добавить'
  return <article className="friend-row"><Avatar name={person.display_name} /><UserLabel user={person} />{available ? <button className="button-secondary compact" onClick={onAdd} disabled={busy}><UserPlus size={16} /> {label}</button> : <span className="request-state">{label}</span>}</article>
}

function Avatar({ name, online }: { name: string; online?: boolean }) { return <span className="participant-avatar">{initials(name)}{online !== undefined && <i className={online ? 'online' : ''} />}</span> }
function UserLabel({ user, detail }: { user: FriendUser; detail?: string }) { return <span className="user-label"><strong>{user.display_name}</strong><small>@{user.username}{detail ? ` · ${detail}` : ''}</small></span> }
function EmptyList({ text }: { text: string }) { return <p className="empty-list">{text}</p> }
