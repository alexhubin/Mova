import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Check,
  Copy,
  LogOut,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  Users,
} from 'lucide-react'
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type TrackPublication,
} from 'livekit-client'
import { api, currentUser, type RoomInfo, type RoomToken } from '../api'
import { initials, inviteURL } from '../utils'

export function RoomPage() {
  const { inviteCode } = useParams({ from: '/r/$inviteCode' })
  const navigate = useNavigate()
  const audioHost = useRef<HTMLDivElement>(null)
  const activeCall = useRef<Room | null>(null)
  const [call, setCall] = useState<Room | null>(null)
  const [, render] = useState(0)
  const [copied, setCopied] = useState(false)
  const [controlError, setControlError] = useState('')
  const [controlBusy, setControlBusy] = useState(false)

  const { data: user, isLoading: userLoading } = useQuery({ queryKey: ['me'], queryFn: currentUser })
  const roomQuery = useQuery({
    queryKey: ['room', inviteCode],
    queryFn: () => api<RoomInfo>(`/api/rooms/${inviteCode}`),
    enabled: Boolean(user),
  })

  useEffect(() => {
    const closeActiveCall = () => {
      const room = activeCall.current
      activeCall.current = null
      if (!room) return

      stopLocalMedia(room)
      void room.disconnect()
    }

    window.addEventListener('pagehide', closeActiveCall)
    window.addEventListener('beforeunload', closeActiveCall)
    window.addEventListener('freeze', closeActiveCall)

    return () => {
      window.removeEventListener('pagehide', closeActiveCall)
      window.removeEventListener('beforeunload', closeActiveCall)
      window.removeEventListener('freeze', closeActiveCall)
      closeActiveCall()
    }
  }, [])

  const join = useMutation({
    mutationFn: async () => {
      const credentials = await api<RoomToken>(`/api/rooms/${inviteCode}/token`, { method: 'POST' })
      const nextCall = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true })
      activeCall.current = nextCall

      const refresh = () => render((value) => value + 1)
      const events = [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.TrackPublished,
        RoomEvent.TrackUnpublished,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.ConnectionStateChanged,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
      ] as const
      events.forEach((event) => nextCall.on(event, refresh))

      nextCall.on(RoomEvent.TrackSubscribed, (track) => {
        refresh()
        if (track.kind === Track.Kind.Audio && audioHost.current) {
          const element = track.attach()
          element.dataset.movaAudio = track.sid ?? ''
          audioHost.current.appendChild(element)
        }
      })
      nextCall.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove())
        refresh()
      })

      try {
        await nextCall.connect(credentials.server_url, credentials.token)
      } catch (error) {
        if (activeCall.current === nextCall) activeCall.current = null
        stopLocalMedia(nextCall)
        void nextCall.disconnect()
        throw error
      }

      if (activeCall.current !== nextCall) return nextCall
      setCall(nextCall)
      await nextCall.startAudio()
      if (activeCall.current !== nextCall) return nextCall

      try {
        await nextCall.localParticipant.setMicrophoneEnabled(true)
      } catch {
        setControlError('Микрофон не включён. Разрешите доступ в настройках браузера и попробуйте ещё раз.')
      }
      return nextCall
    },
    onError: (error) => setControlError(error instanceof Error ? error.message : 'Не удалось подключиться'),
  })

  const participants = useMemo(() => {
    if (!call) return []
    return [call.localParticipant, ...Array.from(call.remoteParticipants.values())]
  }, [call, call?.remoteParticipants.size, call?.state]) // eslint-disable-line react-hooks/exhaustive-deps

  const screenPublication = participants
    .map((participant) => participant.getTrackPublication(Track.Source.ScreenShare))
    .find((publication) => publication !== undefined)

  async function toggleMic() {
    if (!call) return
    setControlBusy(true)
    setControlError('')
    try {
      await call.localParticipant.setMicrophoneEnabled(!call.localParticipant.isMicrophoneEnabled)
      render((value) => value + 1)
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'Нет доступа к микрофону')
    } finally {
      setControlBusy(false)
    }
  }

  async function toggleScreen() {
    if (!call) return
    setControlBusy(true)
    setControlError('')
    try {
      await call.localParticipant.setScreenShareEnabled(!call.localParticipant.isScreenShareEnabled)
      render((value) => value + 1)
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'Демонстрация экрана недоступна в этом браузере')
    } finally {
      setControlBusy(false)
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteURL(inviteCode))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setControlError('Не удалось скопировать ссылку')
    }
  }

  async function leave() {
    const room = activeCall.current
    activeCall.current = null
    if (room) {
      stopLocalMedia(room)
      await room.disconnect()
    }
    setCall(null)
    await navigate({ to: '/' })
  }

  if (userLoading) return <main className="page-shell py-20"><div className="skeleton h-[65dvh]" /></main>
  if (!user) {
    const next = encodeURIComponent(`/r/${inviteCode}`)
    return (
      <main className="page-shell grid min-h-[72dvh] place-items-center text-center">
        <section className="max-w-xl">
          <div className="eyebrow">Вас пригласили</div>
          <h1 className="font-display mt-5 text-5xl font-semibold tracking-[-0.05em]">Сначала представьтесь</h1>
          <p className="mt-4 text-lg text-ink-muted">Участники комнаты должны видеть, кто присоединился к разговору.</p>
          <div className="mt-8 flex justify-center gap-3">
            <a href={`/login?next=${next}`} className="button-primary">Войти</a>
            <a href={`/register?next=${next}`} className="button-secondary">Создать аккаунт</a>
          </div>
        </section>
      </main>
    )
  }
  if (roomQuery.isLoading) return <main className="page-shell py-20"><div className="skeleton h-[65dvh]" /></main>
  if (roomQuery.error || !roomQuery.data) {
    return (
      <main className="page-shell grid min-h-[72dvh] place-items-center text-center">
        <div><div className="font-mono text-sm text-accent">ROOM NOT FOUND</div><h1 className="font-display mt-4 text-5xl font-semibold">Комната не отвечает</h1><p className="mt-3 text-ink-muted">Проверьте ссылку или попросите новое приглашение.</p><Link to="/" className="button-primary mt-7">На главную</Link></div>
      </main>
    )
  }

  const connected = call?.state === ConnectionState.Connected
  const micEnabled = call?.localParticipant.isMicrophoneEnabled ?? false
  const screenEnabled = call?.localParticipant.isScreenShareEnabled ?? false

  return (
    <main className="room-page">
      <div ref={audioHost} className="hidden" aria-hidden="true" />
      <div className="room-topbar">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            <span className={connected ? 'live-dot' : 'idle-dot'} /> {connected ? 'В эфире' : 'Комната готова'}
          </div>
          <h1 className="font-display mt-1 truncate text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{roomQuery.data.name}</h1>
        </div>
        <button className="button-secondary compact shrink-0" onClick={copyInvite}>
          {copied ? <Check size={17} /> : <Copy size={17} />} <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Пригласить'}</span>
        </button>
      </div>

      {!connected ? (
        <section className="join-stage">
          <div className="join-visual" aria-hidden="true">
            <div className="avatar-preview">{initials(user.display_name)}</div>
            <div className="ring ring-one" /><div className="ring ring-two" />
          </div>
          <div className="max-w-lg text-center">
            <h2 className="font-display text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Готовы подключиться?</h2>
            <p className="mt-4 leading-relaxed text-ink-muted">Браузер попросит доступ к микрофону. Камера не включается.</p>
            {controlError && <p className="error-note mt-5" role="alert">{controlError}</p>}
            <button className="button-primary mt-7" onClick={() => join.mutate()} disabled={join.isPending}>
              <Radio size={19} /> {join.isPending ? 'Подключаем…' : 'Войти в разговор'}
            </button>
          </div>
        </section>
      ) : (
        <div className="call-grid">
          <section className="stage-panel">
            {screenPublication ? (
              <ScreenTrack publication={screenPublication} />
            ) : (
              <div className="empty-stage">
                <div className="empty-wave" aria-hidden="true">{Array.from({ length: 11 }).map((_, index) => <i key={index} />)}</div>
                <h2 className="font-display mt-8 text-3xl font-semibold">Сейчас только голос</h2>
                <p className="mt-2 text-ink-muted">Любой участник может показать свой экран.</p>
              </div>
            )}
          </section>

          <aside className="participants-panel">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Участники</h2>
              <span className="participant-count"><Users size={14} /> {participants.length}</span>
            </div>
            <div className="mt-5 space-y-2">
              {participants.map((participant) => <ParticipantRow key={participant.identity} participant={participant} local={participant.identity === call.localParticipant.identity} />)}
            </div>
          </aside>
        </div>
      )}

      {connected && (
        <div className="control-dock" aria-label="Управление звонком">
          <button className={`call-control ${!micEnabled ? 'danger' : ''}`} onClick={toggleMic} disabled={controlBusy} aria-label={micEnabled ? 'Выключить микрофон' : 'Включить микрофон'} title={micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}>
            {micEnabled ? <Mic size={21} /> : <MicOff size={21} />}
          </button>
          <button className={`call-control wide ${screenEnabled ? 'active' : ''}`} onClick={toggleScreen} disabled={controlBusy} aria-label={screenEnabled ? 'Остановить показ экрана' : 'Показать экран'}>
            <MonitorUp size={21} /><span>{screenEnabled ? 'Остановить' : 'Экран'}</span>
          </button>
          <button className="call-control danger" onClick={leave} aria-label="Выйти из комнаты" title="Выйти">
            <LogOut size={21} />
          </button>
        </div>
      )}
      {connected && controlError && <div className="room-error" role="alert">{controlError}</div>}
    </main>
  )
}

function stopLocalMedia(room: Room) {
  room.localParticipant.getTrackPublications().forEach((publication) => publication.track?.stop())
}

function ParticipantRow({ participant, local }: { participant: Participant; local: boolean }) {
  const mic = participant.getTrackPublication(Track.Source.Microphone)
  const muted = !mic || mic.isMuted
  return (
    <div className={`participant-row ${participant.isSpeaking ? 'speaking' : ''}`}>
      <div className="participant-avatar">{initials(participant.name || participant.identity)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{participant.name || 'Участник'} {local && <span className="font-normal text-ink-muted">(вы)</span>}</div>
        <div className="mt-0.5 text-xs text-ink-muted">{participant.isSpeaking ? 'говорит' : muted ? 'микрофон выключен' : 'слушает'}</div>
      </div>
      <span className={muted ? 'mic-state muted' : 'mic-state'}>{muted ? <MicOff size={14} /> : <Mic size={14} />}</span>
    </div>
  )
}

function ScreenTrack({ publication }: { publication: TrackPublication }) {
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const element = video.current
    const track = publication.track
    if (!element || !track) return
    track.attach(element)
    return () => { track.detach(element) }
  }, [publication, publication.track])

  return <video ref={video} className="screen-video" autoPlay playsInline />
}
