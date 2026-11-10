import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { sessionExpired } from './log'

export type Account = 'Edi' | 'Mama'


export function AuthGate({ children }: {
  children: (account: Account, logout: () => Promise<void>) => ReactNode
}) {
  const [account, setAccount] = useState<Account | null>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function checkSession(signal?: AbortSignal) {
    try {
      const response = await fetch('/api/session', { cache: 'no-store', signal })
      if (!response.ok) throw new Error()
      const { account } = await response.json()
      setAccount(account)
      setError('')
    } catch {
      if (signal?.aborted) return
      setError('Nie udało się połączyć z dziennikiem.')
      setAccount(null)
    }
  }

  useEffect(() => {
    if (import.meta.env.DEV) return
    const controller = new AbortController()
    void checkSession(controller.signal)
    const expire = () => {
      setAccount(null)
      setError('Sesja wygasła. Zaloguj się ponownie.')
    }
    window.addEventListener(sessionExpired, expire)
    return () => {
      controller.abort()
      window.removeEventListener(sessionExpired, expire)
    }
  }, [])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      })
      if (response.status === 401) throw new Error('Nieprawidłowa nazwa użytkownika lub hasło.')
      if (response.status === 429) throw new Error('Za dużo prób. Spróbuj ponownie za minutę.')
      if (!response.ok) throw new Error('Nie udało się zalogować. Sprawdź, czy serwer dziennika działa.')
      const { account } = await response.json()
      setAccount(account)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zalogować.')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    const response = await fetch('/api/logout', { method: 'POST' })
    if (!response.ok) throw new Error()
    setAccount(null)
  }

  if (import.meta.env.DEV) return children('Edi', logout)
  if (account) return children(account, logout)

  return <main className="wrap login-page">
    <section className="panel login-panel" aria-labelledby="login-title">
      <h1 id="login-title">Edi’s Quest Log</h1>
      {account === undefined ? <p role="status">Sprawdzam sesję…</p> :
        <form onSubmit={login}>
          <label>Nazwa użytkownika<input name="username" autoComplete="username" autoCapitalize="none" required maxLength={64} /></label>
          <label>Hasło<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
          <button className="primary" disabled={busy}>{busy ? 'Logowanie…' : 'Zaloguj się'}</button>
          {error && <p className="error" role="alert">{error}</p>}
        </form>}
    </section>
  </main>
}
