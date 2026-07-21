import { useEffect, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Headphones, KeyRound, Mic, SlidersHorizontal, UserRound } from 'lucide-react'
import { api, currentUser, type AccountSettings, type User } from '../api'
import { loadDeviceSettings, requestAndListAudioDevices, saveDeviceSettings, type LocalDeviceSettings } from '../deviceSettings'

type Devices = { inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: user, isLoading: userLoading } = useQuery({ queryKey: ['me'], queryFn: currentUser })
  const settings = useQuery({
    queryKey: ['account-settings'],
    queryFn: () => api<AccountSettings>('/api/account/settings'),
    enabled: Boolean(user),
  })
  const [devices, setDevices] = useState<Devices>({ inputs: [], outputs: [] })
  const [deviceValues, setDeviceValues] = useState<LocalDeviceSettings>(loadDeviceSettings)
  const [deviceError, setDeviceError] = useState('')

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    void navigator.mediaDevices.enumerateDevices().then((items) => setDevices({
      inputs: items.filter((item) => item.kind === 'audioinput'),
      outputs: items.filter((item) => item.kind === 'audiooutput'),
    }))
  }, [])

  if (userLoading) return <main className="page-shell py-16"><div className="skeleton h-[32rem]" /></main>
  if (!user) return <main className="page-shell py-20 text-center"><h1 className="font-display text-5xl font-semibold">Нужен аккаунт</h1><Link to="/login" className="button-primary mt-7">Войти</Link></main>

  async function allowDevices() {
    setDeviceError('')
    try {
      setDevices(await requestAndListAudioDevices())
    } catch {
      setDeviceError('Браузер не дал доступ к аудиоустройствам. Проверьте разрешение микрофона.')
    }
  }

  function updateDevice(key: keyof LocalDeviceSettings, value: string) {
    const next = { ...deviceValues, [key]: value }
    setDeviceValues(next)
    saveDeviceSettings(next)
  }

  return (
    <main className="page-shell pb-20 pt-8 sm:pt-14">
      <div className="mb-10 max-w-2xl">
        <div className="eyebrow">Аккаунт и устройства</div>
        <h1 className="font-display mt-4 text-5xl font-semibold tracking-[-0.05em] sm:text-6xl">Настройки</h1>
        <p className="mt-4 text-ink-muted">Профиль синхронизируется с аккаунтом. Выбор устройств сохраняется только в этом браузере.</p>
      </div>

      <div className="settings-grid">
        <SettingsCard icon={<UserRound size={20} />} title="Профиль" description="Так вас находят и видят друзья.">
          <ProfileForm user={user} onSaved={(next) => queryClient.setQueryData(['me'], next)} />
        </SettingsCard>

        <SettingsCard icon={<Mic size={20} />} title="Звук" description="Разрешите доступ, чтобы увидеть названия устройств.">
          <div className="space-y-4">
            <button type="button" className="button-secondary compact" onClick={allowDevices}><SlidersHorizontal size={17} /> Обновить устройства</button>
            <DeviceSelect label="Микрофон" value={deviceValues.audioInputId} devices={devices.inputs} onChange={(value) => updateDevice('audioInputId', value)} />
            <DeviceSelect label="Наушники или динамики" value={deviceValues.audioOutputId} devices={devices.outputs} onChange={(value) => updateDevice('audioOutputId', value)} disabled={!('setSinkId' in HTMLMediaElement.prototype)} />
            {!('setSinkId' in HTMLMediaElement.prototype) && <p className="settings-hint">Этот браузер не позволяет сайту выбирать устройство вывода. Используется системное.</p>}
            {deviceError && <p className="error-note">{deviceError}</p>}
          </div>
        </SettingsCard>

        <SettingsCard icon={<Headphones size={20} />} title="Демонстрация экрана" description="Качество применяется при следующем запуске screen share.">
          {settings.data && <QualityForm value={settings.data.video_quality} onSaved={(next) => queryClient.setQueryData(['account-settings'], next)} />}
        </SettingsCard>

        <SettingsCard icon={<KeyRound size={20} />} title="Пароль" description="После смены остальные сессии будут завершены.">
          <PasswordForm />
        </SettingsCard>
      </div>
    </main>
  )
}

function SettingsCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="settings-card"><div className="settings-card-title"><span>{icon}</span><div><h2 className="font-display text-2xl font-semibold">{title}</h2><p>{description}</p></div></div><div className="mt-7">{children}</div></section>
}

function ProfileForm({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const [username, setUsername] = useState(user.username)
  const [displayName, setDisplayName] = useState(user.display_name)
  const mutation = useMutation({
    mutationFn: () => api<User>('/api/account/profile', { method: 'PATCH', body: JSON.stringify({ username, display_name: displayName }) }),
    onSuccess: onSaved,
  })
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
    <label className="field-label">Username<input className="text-input" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} minLength={3} maxLength={32} pattern="[a-z0-9_]+" required /></label>
    <label className="field-label">Отображаемое имя<input className="text-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required /></label>
    {mutation.error && <p className="error-note">{mutation.error.message}</p>}
    <button className="button-primary compact" disabled={mutation.isPending}>{mutation.isSuccess ? <><Check size={17} /> Сохранено</> : 'Сохранить профиль'}</button>
  </form>
}

function QualityForm({ value, onSaved }: { value: AccountSettings['video_quality']; onSaved: (settings: AccountSettings) => void }) {
  const [quality, setQuality] = useState(value)
  const mutation = useMutation({
    mutationFn: () => api<AccountSettings>('/api/account/settings', { method: 'PUT', body: JSON.stringify({ video_quality: quality }) }),
    onSuccess: onSaved,
  })
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
    <label className="field-label">Профиль качества<select className="text-input" value={quality} onChange={(event) => setQuality(event.target.value as AccountSettings['video_quality'])}><option value="low">720p · 15 кадров/с</option><option value="medium">1080p · 15 кадров/с</option><option value="high">1080p · 30 кадров/с</option></select></label>
    <button className="button-primary compact" disabled={mutation.isPending}>{mutation.isSuccess ? <><Check size={17} /> Сохранено</> : 'Сохранить качество'}</button>
  </form>
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const mutation = useMutation({
    mutationFn: () => api<void>('/api/account/password', { method: 'PUT', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }),
    onSuccess: () => { setCurrentPassword(''); setNewPassword('') },
  })
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate() }
  return <form className="space-y-4" onSubmit={submit}>
    <label className="field-label">Текущий пароль<input className="text-input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
    <label className="field-label">Новый пароль<input className="text-input" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
    {mutation.error && <p className="error-note">{mutation.error.message}</p>}
    <button className="button-primary compact" disabled={mutation.isPending}>{mutation.isSuccess ? <><Check size={17} /> Пароль изменён</> : 'Изменить пароль'}</button>
  </form>
}

function DeviceSelect({ label, value, devices, onChange, disabled }: { label: string; value: string; devices: MediaDeviceInfo[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="field-label">{label}<select className="text-input" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}><option value="">Системное устройство</option>{devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}</select></label>
}
