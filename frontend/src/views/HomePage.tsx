import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Check, Headphones, MonitorUp, Phone, PhoneOff, Plus, Search, UserPlus, X } from 'lucide-react'
import { api, currentUser, type DirectCall, type FriendsPayload, type FriendUser, type RoomInfo } from '../api'
import { initials } from '../utils'

export function HomePage() {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: currentUser })
  if (isLoading) return <main className="page-shell py-24"><div className="skeleton h-80" /></main>
  return user ? <Dashboard name={user.display_name} username={user.username} /> : <Landing />
}

function Landing() {
  return (
    <main className="page-shell pb-16 pt-10 sm:pt-20">
      <section className="hero-grid">
        <div className="max-w-3xl">
          <div className="eyebrow">Голосом — ближе</div>
          <h1 className="font-display mt-7 text-[clamp(3.6rem,9vw,8rem)] font-semibold leading-[0.86] tracking-[-0.07em]">Просто<br /><span className="text-accent">говорите.</span></h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">Добавляйте друзей, звоните напрямую или собирайте группу по ссылке. Голос и экран — без лишнего шума.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link to="/register" className="button-primary">Создать аккаунт <ArrowUpRight size={19} /></Link><Link to="/login" className="button-secondary">Войти</Link></div>
        </div>
        <div className="sound-stage" aria-hidden="true"><div className="orb orb-one"><Headphones /></div><div className="orb orb-two"><MonitorUp /></div><div className="wave-field">{Array.from({ length: 17 }).map((_, index) => <i key={index} style={{ '--bar': index } as React.CSSProperties} />)}</div><div className="stage-caption"><span className="live-dot" /> друзья рядом</div></div>
      </section>
      <section className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-3">
        {[
          ['01', 'Постоянный аккаунт', 'Username, профиль и настройки остаются с вами между звонками.'],
          ['02', 'Друзья в один клик', 'Найдите человека по username и позвоните напрямую.'],
          ['03', 'Группы по ссылке', 'Создайте отдельную комнату для команды или встречи.'],
        ].map(([number, title, text]) => <article key={number} className="bg-paper p-7 sm:p-9"><span className="font-mono text-xs text-accent">{number}</span><h2 className="font-display mt-8 text-2xl font-semibold">{title}</h2><p className="mt-3 leading-relaxed text-ink-muted">{text}</p></article>)}
      </section>
    </main>
  )
}

function Dashboard({ name, username }: { name: string; username: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roomName, setRoomName] = useState('')
  const friends = useQuery({ queryKey: ['friends'], queryFn: () => api<FriendsPayload>('/api/friends'), refetchInterval: 15_000 })
  const calls = useQuery({ queryKey: ['calls'], queryFn: () => api<DirectCall[]>('/api/calls') })
  const searchQuery = useQuery({
    queryKey: ['user-search', search],
    queryFn: () => api<FriendUser[]>(`/api/users/search?q=${encodeURIComponent(search.trim())}`),
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
    mutationFn: () => api<RoomInfo>('/api/rooms', { method: 'POST', body: JSON.stringify({ name: roomName }) }),
    onSuccess: (room) => navigate({ to: '/r/$inviteCode', params: { inviteCode: room.invite_code } }),
  })
  const outgoing = calls.data?.find((call) => !call.incoming && call.status === 'ringing')

  function submitRoom(event: FormEvent) { event.preventDefault(); createRoom.mutate() }

  return (
    <main className="page-shell pb-20 pt-6 sm:pt-10">
      <section className="dashboard-heading"><div><div className="eyebrow">@{username}</div><h1 className="font-display mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">Привет, {name}.</h1><p className="mt-3 text-ink-muted">Кому позвоним сегодня?</p></div><Link to="/settings" className="button-secondary compact">Настроить звук</Link></section>

      {outgoing && <button className="outgoing-call" onClick={() => navigate({ to: '/r/$inviteCode', params: { inviteCode: outgoing.invite_code } })}><span className="live-dot" /><span>Звоним <strong>{outgoing.peer.display_name}</strong>…</span><ArrowUpRight size={18} /></button>}

      <div className="social-grid">
        <section className="social-card friends-card">
          <div className="section-heading"><div><span className="section-kicker">Контакты</span><h2 className="font-display text-3xl font-semibold">Друзья</h2></div><span className="participant-count">{friends.data?.friends.length ?? 0}</span></div>
          <div className="friend-list">
            {friends.isLoading && <div className="skeleton h-40" />}
            {friends.data?.friends.map((friend) => <FriendRow key={friend.id} friend={friend} onCall={() => startCall.mutate(friend)} busy={startCall.isPending} />)}
            {friends.data?.friends.length === 0 && <EmptyList text="Здесь появятся люди, которых вы добавите." />}
          </div>
          {startCall.error && <p className="error-note mt-4">{startCall.error.message}</p>}
        </section>

        <section className="social-card">
          <div className="section-heading"><div><span className="section-kicker">Новый контакт</span><h2 className="font-display text-3xl font-semibold">Найти человека</h2></div><Search size={21} /></div>
          <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="username или имя" /></label>
          <div className="friend-list compact-list">
            {search.trim().length < 2 && <EmptyList text="Введите хотя бы два символа." />}
            {searchQuery.data?.map((person) => <SearchRow key={person.id} person={person} onAdd={() => sendRequest.mutate(person)} busy={sendRequest.isPending} />)}
            {searchQuery.data?.length === 0 && <EmptyList text="Никого не нашли." />}
          </div>
          {sendRequest.error && <p className="error-note mt-4">{sendRequest.error.message}</p>}
        </section>

        <section className="social-card">
          <div className="section-heading"><div><span className="section-kicker">Запросы</span><h2 className="font-display text-3xl font-semibold">Заявки</h2></div><UserPlus size={21} /></div>
          <div className="friend-list compact-list">
            {friends.data?.incoming.map((request) => <div className="friend-row" key={request.id}><Avatar name={request.user.display_name} /><UserLabel user={request.user} /><button className="mini-action accept" onClick={() => acceptRequest.mutate(request.id)} aria-label="Принять"><Check size={17} /></button><button className="mini-action" onClick={() => declineRequest.mutate(request.id)} aria-label="Отклонить"><X size={17} /></button></div>)}
            {friends.data?.outgoing.map((request) => <div className="friend-row muted-row" key={request.id}><Avatar name={request.user.display_name} /><UserLabel user={request.user} /><span className="request-state">отправлено</span></div>)}
            {friends.data && friends.data.incoming.length + friends.data.outgoing.length === 0 && <EmptyList text="Новых заявок нет." />}
          </div>
        </section>

        <form className="social-card group-card" onSubmit={submitRoom}>
          <div className="section-heading"><div><span className="section-kicker">Больше людей</span><h2 className="font-display text-3xl font-semibold">Групповая комната</h2></div><Plus size={21} /></div>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">Создайте постоянную ссылку для команды или встречи.</p>
          <label className="field-label mt-6">Название<input className="text-input" value={roomName} onChange={(event) => setRoomName(event.target.value)} minLength={2} maxLength={80} required placeholder="Дизайн-синк" /></label>
          {createRoom.error && <p className="error-note mt-4">{createRoom.error.message}</p>}
          <button className="button-primary mt-5 w-full" disabled={createRoom.isPending}>Создать комнату <ArrowUpRight size={18} /></button>
        </form>
      </div>
    </main>
  )
}

function FriendRow({ friend, onCall, busy }: { friend: FriendUser; onCall: () => void; busy: boolean }) {
  return <div className={`friend-row ${friend.online ? '' : 'offline-row'}`}><Avatar name={friend.display_name} /><UserLabel user={friend} status={friend.online ? 'В сети' : 'Не в сети'} online={friend.online} /><button className="friend-call" onClick={onCall} disabled={busy || !friend.online} aria-label={friend.online ? `Позвонить ${friend.display_name}` : `${friend.display_name} не в сети`} title={friend.online ? 'Позвонить' : 'Пользователь не в сети'}>{friend.online ? <Phone size={18} /> : <PhoneOff size={18} />}<span>{friend.online ? 'Позвонить' : 'Не в сети'}</span></button></div>
}

function SearchRow({ person, onAdd, busy }: { person: FriendUser; onAdd: () => void; busy: boolean }) {
  const available = person.relationship === 'none'
  const label = person.relationship === 'friends' ? 'уже в друзьях' : person.relationship === 'request_sent' ? 'заявка отправлена' : person.relationship === 'request_received' ? 'ответьте в заявках' : 'Добавить'
  return <div className="friend-row"><Avatar name={person.display_name} /><UserLabel user={person} />{available ? <button className="mini-text-action" onClick={onAdd} disabled={busy}><UserPlus size={16} /> {label}</button> : <span className="request-state">{label}</span>}</div>
}

function Avatar({ name }: { name: string }) { return <div className="participant-avatar">{initials(name)}</div> }
function UserLabel({ user, status, online }: { user: FriendUser; status?: string; online?: boolean }) { return <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{user.display_name}</strong><span className="flex items-center gap-1.5 text-xs text-ink-muted">@{user.username}{status && <><i className={`presence-dot ${online ? 'online' : ''}`} />{status}</>}</span></div> }
function EmptyList({ text }: { text: string }) { return <p className="empty-list">{text}</p> }
