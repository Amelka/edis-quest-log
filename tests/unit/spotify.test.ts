import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const values = new Map<string, string>()
beforeEach(() => {
  vi.resetModules()
  values.clear()
  vi.stubGlobal('location', { origin: 'http://127.0.0.1:5174', href: 'http://127.0.0.1:5174/' })
  vi.stubGlobal('history', { replaceState: vi.fn() })
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('Spotify PKCE session', () => {
  it('rejects a mismatched or expired OAuth state', async () => {
    const { validOAuthState } = await import('../../src/spotifyAuth')
    const login = { state: 'expected', verifier: 'test', returnTo: '/', created: Date.now() }
    expect(validOAuthState(login, 'expected')).toBe(true)
    expect(validOAuthState(login, 'different')).toBe(false)
    expect(validOAuthState({ ...login, created: Date.now() - 600001 }, 'expected')).toBe(false)
    expect(validOAuthState(null, 'expected')).toBe(false)
  })
  it('never exchanges a code with a mismatched state and removes callback params', async () => {
    location.href = 'http://127.0.0.1:5174/?code=private-code&state=wrong'
    values.set('edi.spotify.login', JSON.stringify({ state: 'right', verifier: 'v', returnTo: '/?preview=special-cards&music-card=bach-prelude', created: Date.now() }))
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    const auth = await import('../../src/spotifyAuth')
    await auth.finishSpotifyLogin()
    expect(fetcher).not.toHaveBeenCalled()
    expect(auth.spotifyLoginError).toContain('nieprawidłowa')
    expect(values.has('edi.spotify.login')).toBe(false)
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/?preview=special-cards&music-card=bach-prelude')
  })
  it('refreshes an expired token only once for concurrent requests', async () => {
    values.set('edi.spotify.tokens', JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_at: 0 }))
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'new', expires_in: 3600 }) }); vi.stubGlobal('fetch', fetcher)
    const { spotifyToken } = await import('../../src/spotifyAuth')
    expect(await Promise.all([spotifyToken(), spotifyToken()])).toEqual(['new', 'new'])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(JSON.parse(values.get('edi.spotify.tokens')!).refresh_token).toBe('refresh')
  })
  it('clears invalid sessions when refresh authorization is rejected', async () => {
    values.set('edi.spotify.tokens', JSON.stringify({ access_token: 'old', refresh_token: 'invalid', expires_at: 0 }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))
    const { spotifyToken, hasSpotifySession } = await import('../../src/spotifyAuth')
    await expect(spotifyToken()).rejects.toThrow('ponownie')
    expect(hasSpotifySession()).toBe(false)
  })
})
