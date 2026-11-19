import { clearSpotifySession, spotifyToken } from './spotifyAuth'
export type Playback = { paused: boolean; position: number; duration: number; track_window: { current_track: { uri: string; name: string; artists: { name: string }[]; album: { images: { url: string }[] } } } }
type Listener = (state: Playback | null) => void
interface Player {
  connect(): Promise<boolean>; disconnect(): void; activateElement(): Promise<void>
  pause(): Promise<void>; resume(): Promise<void>; seek(ms: number): Promise<void>
  getCurrentState(): Promise<Playback | null>
  addListener(event: string, listener: (data: any) => void): boolean
}
declare global { interface Window {
  Spotify?: { Player: new (options: { name: string; getOAuthToken: (callback: (token: string) => void) => void; volume: number }) => Player }
  onSpotifyWebPlaybackSDKReady?: () => void
} }
let sdk: Promise<void> | undefined
let player: Player | undefined
let connecting: Promise<string> | undefined
let device = ''
let generation = 0
let connectionEpoch = 0
let activeTrack = ''
let stateListener: Listener | undefined
let errorListener: ((message: string) => void) | undefined
let commands: Promise<unknown> = Promise.resolve()
let cancelConnection: (() => void) | undefined

function loadSDK() {
  if (window.Spotify) return Promise.resolve()
  if (!sdk) sdk = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    const timer = window.setTimeout(() => { script.remove(); sdk = undefined; reject(new Error('Spotify nie odpowiada. Sprawdź połączenie i spróbuj ponownie.')) }, 15000)
    window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timer); resolve() }
    script.onerror = () => { clearTimeout(timer); script.remove(); sdk = undefined; reject(new Error('Nie udało się załadować odtwarzacza Spotify.')) }
    document.head.append(script)
  })
  return sdk
}
export async function prepareSpotify() { await ready() }
export function activateSpotify() { void player?.activateElement().catch(() => {}) }

async function ready() {
  if (device) return device
  if (connecting) return connecting
  const epoch = connectionEpoch
  connecting = (async () => {
    await spotifyToken()
    await loadSDK()
    if (epoch !== connectionEpoch) throw new Error('Karta została zamknięta.')
    return new Promise<string>((resolve, reject) => {
      player?.disconnect()
      const instance = new window.Spotify!.Player({ name: 'Edi’s Quest Log', volume: .4,
        getOAuthToken: callback => { void spotifyToken().then(token => { if (epoch === connectionEpoch) callback(token) }).catch(error => { if (epoch === connectionEpoch) errorListener?.(error.message) }) } })
      player = instance
      const timer = window.setTimeout(() => { instance.disconnect(); if (player === instance) player = undefined; reject(new Error('Połączenie odtwarzacza trwa zbyt długo. Spróbuj ponownie.')) }, 15000)
      const fail = (message: string) => {
        clearTimeout(timer); instance.disconnect()
        if (player === instance) { player = undefined; device = '' }
        if (epoch === connectionEpoch) { errorListener?.(message); cancelConnection = undefined }
        reject(new Error(message))
      }
      cancelConnection = () => { clearTimeout(timer); instance.disconnect(); reject(new Error('Karta została zamknięta.')) }
      instance.addListener('ready', ({ device_id }) => {
        clearTimeout(timer)
        if (epoch !== connectionEpoch) { instance.disconnect(); reject(new Error('Karta została zamknięta.')); return }
        cancelConnection = undefined; device = device_id; resolve(device_id)
      })
      instance.addListener('not_ready', () => { if (epoch !== connectionEpoch) return; device = ''; errorListener?.('Utracono połączenie ze Spotify. Spróbuj ponownie.') })
      instance.addListener('player_state_changed', (state: Playback | null) => {
        if (epoch !== connectionEpoch) return
        if (state && state.track_window.current_track.uri !== activeTrack) {
          // Never let Spotify's queue continue to a different song behind the card.
          if (!state.paused) void instance.pause().catch(() => {})
          return
        }
        stateListener?.(state)
      })
      instance.addListener('autoplay_failed', () => epoch === connectionEpoch && errorListener?.('Przeglądarka wymaga kliknięcia. Naciśnij „Odtwórz”.'))
      instance.addListener('initialization_error', () => fail('Ta przeglądarka nie obsługuje odtwarzania Spotify. Użyj linku poniżej.'))
      instance.addListener('authentication_error', () => { if (epoch !== connectionEpoch) return; clearSpotifySession(); fail('Sesja Spotify wygasła. Połącz konto ponownie.') })
      instance.addListener('account_error', () => fail('Odtwarzanie na karcie wymaga konta Spotify Premium.'))
      instance.addListener('playback_error', () => epoch === connectionEpoch && errorListener?.('Nie udało się odtworzyć nagrania. Spróbuj ponownie lub otwórz Spotify.'))
      void instance.connect().then(ok => { if (!ok) fail('Nie udało się połączyć odtwarzacza Spotify.') }).catch(() => fail('Nie udało się połączyć odtwarzacza Spotify.'))
    })
  })().finally(() => { if (epoch === connectionEpoch) connecting = undefined })
  return connecting
}
export function listenSpotify(onState: Listener, onError: (message: string) => void) {
  stateListener = onState; errorListener = onError
  return () => { if (stateListener === onState) { stateListener = undefined; errorListener = undefined } }
}
function enqueue<T>(command: () => Promise<T>): Promise<T> {
  const result = commands.then(command, command)
  commands = result.catch(() => {})
  return result
}
async function playbackRequest(path: string, token: string, body: object) {
  return fetch(`https://api.spotify.com/v1/me/player${path}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}
async function playbackError(response: Response) {
  const data = await response.json().catch(() => ({}))
  const reason = data.error?.reason || ''
  if (response.status === 401) { clearSpotifySession(); return new Error('Sesja Spotify wygasła. Połącz konto ponownie.') }
  if (response.status === 403) return new Error('Spotify odmówiło odtwarzania. Sprawdź konto Premium i dostęp do aplikacji.')
  if (response.status === 429) return new Error('Spotify otrzymało za dużo żądań. Spróbuj ponownie za chwilę.')
  if (reason === 'TRACK_NOT_PLAYABLE') return new Error('To nagranie nie jest dostępne dla Twojego konta. Otwórz je w Spotify.')
  if (response.status === 404) return new Error('Spotify nie widzi odtwarzacza w tej przeglądarce. Spróbuj ponownie.')
  return new Error(`Spotify nie uruchomiło odtwarzania (błąd ${response.status}). Spróbuj ponownie.`)
}
export async function playSpotify(trackId: string) {
  const ticket = ++generation
  activateSpotify()
  // Serialize play and close/pause: a delayed play response must never restart
  // music after closing a card, or pause a newer card's track.
  return enqueue(async () => {
    if (ticket !== generation) return
    const id = await ready()
    const token = await spotifyToken()
    if (ticket !== generation) return
    const instance = player!
    activeTrack = `spotify:track:${trackId}`
    let response = await playbackRequest(`/play?device_id=${encodeURIComponent(id)}`, token,
      { uris: [activeTrack], position_ms: 0 })
    if (ticket !== generation) { await instance.pause().catch(() => {}); return }
    // SDK ready and Spotify Web API device registration can get out of sync.
    // Transfer to this existing device, then retry only the missing-device error.
    if (response.status === 404) {
      const transfer = await playbackRequest('', token, { device_ids: [id], play: false })
      if (ticket !== generation) { await instance.pause().catch(() => {}); return }
      if (!transfer.ok) throw await playbackError(transfer)
      for (const delay of [300, 700]) {
        await new Promise(resolve => setTimeout(resolve, delay))
        if (ticket !== generation) return
        response = await playbackRequest(`/play?device_id=${encodeURIComponent(id)}`, token,
          { uris: [`spotify:track:${trackId}`], position_ms: 0 })
        if (ticket !== generation) { await instance.pause().catch(() => {}); return }
        if (response.status !== 404) break
      }
    }
    if (!response.ok) throw await playbackError(response)
    const state = await instance.getCurrentState()
    if (ticket === generation) stateListener?.(state)
  })
}
export async function pauseSpotify() { await player?.pause() }
export async function resumeSpotify() { activateSpotify(); await player?.resume() }
export async function seekSpotify(ms: number) { await player?.seek(ms) }
export async function currentSpotifyState() { return player?.getCurrentState() }
export function stopSpotify() {
  generation++; activeTrack = ''
  const instance = player
  // Pause immediately, and again after any accepted play command has completed.
  void instance?.pause().catch(() => {})
  void enqueue(async () => { await instance?.pause().catch(() => {}) })
}
export function disposeSpotify() {
  stopSpotify(); connectionEpoch++; cancelConnection?.(); cancelConnection = undefined
  player?.disconnect(); player = undefined; device = ''; connecting = undefined
}
export function disconnectSpotify() { disposeSpotify(); clearSpotifySession() }
