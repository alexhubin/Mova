const storageKey = 'mova.audio-devices.v1'

export type LocalDeviceSettings = {
  audioInputId: string
  audioOutputId: string
}

const defaults: LocalDeviceSettings = { audioInputId: '', audioOutputId: '' }

export function loadDeviceSettings(): LocalDeviceSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '') as Partial<LocalDeviceSettings>
    return {
      audioInputId: typeof parsed.audioInputId === 'string' ? parsed.audioInputId : '',
      audioOutputId: typeof parsed.audioOutputId === 'string' ? parsed.audioOutputId : '',
    }
  } catch {
    return defaults
  }
}

export function saveDeviceSettings(settings: LocalDeviceSettings) {
  localStorage.setItem(storageKey, JSON.stringify(settings))
}

export async function requestAndListAudioDevices() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  stream.getTracks().forEach((track) => track.stop())
  const devices = await navigator.mediaDevices.enumerateDevices()
  return {
    inputs: devices.filter((device) => device.kind === 'audioinput'),
    outputs: devices.filter((device) => device.kind === 'audiooutput'),
  }
}
