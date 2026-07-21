import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Headphones, MonitorUp, Plus } from 'lucide-react'
import { api, currentUser, type RoomInfo } from '../api'

export function HomePage() {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: currentUser })
  if (isLoading) return <main className="page-shell py-24"><div className="skeleton h-80" /></main>
  return user ? <Dashboard name={user.display_name} /> : <Landing />
}

function Landing() {
  return (
    <main className="page-shell pb-16 pt-10 sm:pt-20">
      <section className="hero-grid">
        <div className="max-w-3xl">
          <div className="eyebrow">Голосом — ближе</div>
          <h1 className="font-display mt-7 text-[clamp(3.6rem,9vw,8rem)] font-semibold leading-[0.86] tracking-[-0.07em]">
            Просто<br /><span className="text-accent">говорите.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">
            Командные созвоны без перегруженных панелей. Голос, экран и люди, которые сейчас рядом.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/register" className="button-primary">Создать комнату <ArrowUpRight size={19} /></Link>
            <Link to="/login" className="button-secondary">У меня есть ссылка</Link>
          </div>
        </div>

        <div className="sound-stage" aria-hidden="true">
          <div className="orb orb-one"><Headphones /></div>
          <div className="orb orb-two"><MonitorUp /></div>
          <div className="wave-field">
            {Array.from({ length: 17 }).map((_, index) => <i key={index} style={{ '--bar': index } as React.CSSProperties} />)}
          </div>
          <div className="stage-caption"><span className="live-dot" /> 4 участника в эфире</div>
        </div>
      </section>

      <section className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-3">
        {[
          ['01', 'Одна ссылка', 'Отправьте приглашение — участнику останется войти и подключиться.'],
          ['02', 'Только важное', 'Микрофон, экран и список участников всегда под рукой.'],
          ['03', 'Ваш сервер', 'Медиапотоки идут напрямую через ваш LiveKit SFU.'],
        ].map(([number, title, text]) => (
          <article key={number} className="bg-paper p-7 sm:p-9">
            <span className="font-mono text-xs text-accent">{number}</span>
            <h2 className="font-display mt-8 text-2xl font-semibold">{title}</h2>
            <p className="mt-3 leading-relaxed text-ink-muted">{text}</p>
          </article>
        ))}
      </section>
    </main>
  )
}

function Dashboard({ name }: { name: string }) {
  const navigate = useNavigate()
  const [roomName, setRoomName] = useState('')
  const create = useMutation({
    mutationFn: () => api<RoomInfo>('/api/rooms', { method: 'POST', body: JSON.stringify({ name: roomName }) }),
    onSuccess: (room) => navigate({ to: '/r/$inviteCode', params: { inviteCode: room.invite_code } }),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <main className="page-shell pb-16 pt-10 sm:pt-20">
      <div className="dashboard-grid">
        <section>
          <div className="eyebrow">Ваша студия</div>
          <h1 className="font-display mt-5 text-5xl font-semibold leading-[0.95] tracking-[-0.055em] sm:text-7xl">
            Привет, {name}.<br />Кого позовём?
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            Назовите комнату, создайте её и поделитесь ссылкой. Она останется прежней для следующих встреч.
          </p>
        </section>
        <form className="create-card" onSubmit={submit}>
          <span className="number-chip"><Plus size={18} /></span>
          <label className="field-label mt-10">
            Название комнаты
            <input className="text-input big" value={roomName} onChange={(e) => setRoomName(e.target.value)} minLength={2} maxLength={80} required autoFocus placeholder="Еженедельный созвон" />
          </label>
          {create.error && <p className="error-note mt-4" role="alert">{create.error.message}</p>}
          <button className="button-primary mt-6 w-full" disabled={create.isPending}>
            {create.isPending ? 'Создаём…' : 'Создать и войти'} <ArrowUpRight size={19} />
          </button>
          <p className="mt-4 text-center text-xs leading-relaxed text-ink-muted">Микрофон включится только после вашего подтверждения.</p>
        </form>
      </div>
    </main>
  )
}

