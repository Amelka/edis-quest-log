/// <reference types="vite/client" />
const TOKEN_KEY = 'edi.spotify.tokens'
const LOGIN_KEY = 'edi.spotify.login'
export const spotifyClientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() || ''
export const spotifyRedirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim() || `${location.origin}/`
type Tokens = { access_token: string; refresh_token: string; expires_at: number }
type Login = { state: string; verifier: string; returnTo: string; created: number }
let refreshing: Promise<string> | undefined
let sessionGeneration = 0
export let spotifyLoginError = ''

export function hasSpotifySession() { return Boolean(sessionStorage.getItem(TOKEN_KEY)) }
export function clearSpotifySession() { sessionGeneration++; sessionStorage.removeItem(TOKEN_KEY) }
export function validOAuthState(login: Login | null, state: string | null) {
  return Boolean(login && state && login.state === state && Date.now() - login.created < 600000 && Date.now() >= login.created)
}
function random() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
}
export async function connectSpotify(cardId: string) {
  if (!spotifyClientId) throw new Error('Połączenie Spotify nie jest jeszcze skonfigurowane.')
  const callback = new URL(spotifyRedirectUri)
  if (callback.origin !== location.origin) throw new Error('Otwórz aplikację pod adresem zgodnym z konfiguracją Spotify.')
  const verifier = random()
  const state = random()
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const returnTo = new URL(location.href)
  returnTo.searchParams.set('music-card', cardId)
  sessionStorage.setItem(LOGIN_KEY, JSON.stringify({ state, verifier, returnTo: returnTo.pathname + returnTo.search + returnTo.hash, created: Date.now() }))
  const params = new URLSearchParams({ client_id: spotifyClientId, response_type: 'code', redirect_uri: spotifyRedirectUri,
    scope: 'streaming user-read-email user-read-private user-modify-playback-state', state, code_challenge_method: 'S256', code_challenge: challenge })
  location.assign(`https://accounts.spotify.com/authorize?${params}`)
}
async function exchange(body: URLSearchParams) {
  const generation = sessionGeneration
  const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) clearSpotifySession()
    throw new Error('Nie udało się połączyć ze Spotify. Połącz konto ponownie.')
  }
  const data = await response.json()
  if (generation !== sessionGeneration) throw new Error('Konto Spotify zostało odłączone.')
  if (!data.access_token || !Number.isFinite(data.expires_in)) throw new Error('Spotify nie zwróciło prawidłowej sesji.')
  const previous: Tokens | null = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null')
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token || previous?.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 }))
  return data.access_token as string
}
export async function spotifyToken(): Promise<string> {
  const tokens: Tokens | null = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null')
  if (!tokens) throw new Error('Połącz konto Spotify Premium.')
  if (tokens.expires_at > Date.now() + 60000) return tokens.access_token
  if (!refreshing) {
    refreshing = exchange(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: spotifyClientId }))
      .finally(() => { refreshing = undefined })
  }
  return refreshing
}
export async function finishSpotifyLogin() {
  const url = new URL(location.href)
  const saved = sessionStorage.getItem(LOGIN_KEY)
  if (!saved || (!url.searchParams.has('code') && !url.searchParams.has('error'))) return
  let login: Login | null = null
  try {
    login = JSON.parse(saved)
    if (!validOAuthState(login, url.searchParams.get('state'))) throw new Error('Sesja logowania Spotify wygasła lub jest nieprawidłowa. Spróbuj ponownie.')
    if (url.searchParams.has('error')) throw new Error('Nie udzielono dostępu do Spotify. Nadal możesz oglądać karty.')
    await exchange(new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code')!, redirect_uri: spotifyRedirectUri,
      client_id: spotifyClientId, code_verifier: login!.verifier }))
  } catch (error) {
    spotifyLoginError = error instanceof Error ? error.message : 'Nie udało się połączyć ze Spotify.'
  } finally {
    sessionStorage.removeItem(LOGIN_KEY)
    const destination = login?.returnTo && login.returnTo.startsWith('/') && !login.returnTo.startsWith('//') ? login.returnTo : '/'
    history.replaceState(null, '', destination)
  }
}
