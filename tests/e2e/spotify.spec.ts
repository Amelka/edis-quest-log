import { test as base, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
const port = 5182
const baseURL = `http://127.0.0.1:${port}`
const test = base.extend<{}, { musicServer: void }>({
  musicServer: [async ({}, use) => {
    const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      env: { ...process.env, VITE_SPOTIFY_CLIENT_ID: 'test-public-client', VITE_SPOTIFY_REDIRECT_URI: `${baseURL}/` }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    const closed = once(server, 'close')
    try {
      for (let n = 0; n < 100; n++) {
        try { if ((await fetch(baseURL)).ok) break } catch {}
        if (n === 99) throw new Error('Music preview server did not start')
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      await use()
    } finally { server.kill(); await closed }
  }, { scope: 'worker', auto: true }],
})
async function mockSpotify(page: import('@playwright/test').Page, delay = 0) {
  await page.addInitScript(({ delay }) => {
    sessionStorage.setItem('edi.spotify.tokens', JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', expires_at: Date.now() + 3600000 }))
    const mock: any = { plays: 0, pauses: 0, disconnected: 0, listeners: {}, state: null }
    ;(window as any).__spotify = mock
    ;(window as any).Spotify = { Player: class {
      addListener(name: string, fn: any) { mock.listeners[name] = fn; return true }
      connect() { setTimeout(() => mock.listeners.ready({ device_id: 'test-device' }), delay); return Promise.resolve(true) }
      disconnect() { mock.disconnected++ }
      activateElement() { return Promise.resolve() }
      getCurrentState() { return Promise.resolve(mock.state) }
      pause() { mock.pauses++; if (mock.state) { mock.state.paused = true; mock.listeners.player_state_changed(mock.state) } return Promise.resolve() }
      resume() { mock.state.paused = false; mock.listeners.player_state_changed(mock.state); return Promise.resolve() }
      seek(ms: number) { mock.state.position = ms; mock.listeners.player_state_changed(mock.state); return Promise.resolve() }
    } }
  }, { delay })
  await page.route('https://api.spotify.com/v1/me/player/play?*', async route => {
    const body = route.request().postDataJSON()
    await page.evaluate(uri => {
      const mock = (window as any).__spotify
      mock.plays++
      mock.state = { paused: false, position: 0, duration: 120000, track_window: { current_track: { uri, name: 'Testowe nagranie', artists: [{ name: 'Pianista testowy' }], album: { images: [] } } } }
      mock.listeners.player_state_changed(mock.state)
    }, body.uris[0])
    await route.fulfill({ status: 204 })
  })
}
test('card opens alone, starts playback, pauses, seeks and stops on close', async ({ page }) => {
  await mockSpotify(page)
  await page.goto(`${baseURL}/?preview=special-cards`)
  await page.getByRole('button', { name: /Preludium C-dur/ }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('heading')).toHaveText('Preludium C-dur')
  await expect(modal.getByRole('button', { name: 'Pauza', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => (window as any).__spotify.plays)).toBe(1)
  await modal.getByRole('button', { name: 'Pauza', exact: true }).click()
  await expect(modal.getByRole('button', { name: 'Odtwórz', exact: true })).toBeEnabled()
  await modal.getByRole('button', { name: 'Odtwórz', exact: true }).click()
  await modal.getByRole('slider', { name: 'Pozycja nagrania' }).press('Home')
  await modal.getByRole('slider', { name: 'Pozycja nagrania' }).press('ArrowRight')
  await expect(modal.getByText('0:01 / 2:00')).toBeVisible()
  await expect(modal.getByRole('link', { name: 'Posłuchaj w Spotify' })).toHaveAttribute('target', '_blank')
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()
  expect(await page.evaluate(() => (window as any).__spotify.state.paused)).toBe(true)
  expect(await page.evaluate(() => (window as any).__spotify.disconnected)).toBe(0)
  await page.getByRole('button', { name: /Marsz turecki/ }).click()
  await expect(modal.getByRole('heading')).toHaveText('Marsz turecki')
  await expect(modal.getByRole('button', { name: 'Pauza', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => (window as any).__spotify.plays)).toBe(2)
})
test('closing a card during connection never starts a track', async ({ page }) => {
  await mockSpotify(page, 500)
  await page.goto(`${baseURL}/?preview=special-cards`)
  await page.getByRole('button', { name: /Preludium C-dur/ }).click()
  await page.getByRole('button', { name: 'Zamknij', exact: true }).click()
  await page.waitForTimeout(700)
  expect(await page.evaluate(() => (window as any).__spotify.plays)).toBe(0)
})
test('blocked autoplay leaves an explicit playback button', async ({ page }) => {
  await mockSpotify(page)
  await page.goto(`${baseURL}/?preview=special-cards`)
  await page.getByRole('button', { name: /Preludium C-dur/ }).click()
  await expect(page.getByRole('button', { name: 'Pauza', exact: true })).toBeEnabled()
  await page.evaluate(() => { const mock = (window as any).__spotify; mock.state.paused = true; mock.listeners.player_state_changed(mock.state); mock.listeners.autoplay_failed() })
  await expect(page.getByText('Przeglądarka wymaga kliknięcia.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Odtwórz', exact: true })).toBeEnabled()
})
test('unconnected account starts PKCE authorization only on explicit click', async ({ page }) => {
  await page.goto(`${baseURL}/?preview=special-cards`)
  await page.getByRole('button', { name: /Preludium C-dur/ }).click()
  const button = page.getByRole('button', { name: 'Połącz Spotify Premium' })
  await expect(button).toBeVisible()
  await page.route('https://accounts.spotify.com/authorize?*', route => route.fulfill({ contentType: 'text/html', body: '<p>Spotify login mock</p>' }))
  await button.click()
  await page.waitForURL('https://accounts.spotify.com/authorize?*')
  const url = new URL(page.url())
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(url.searchParams.get('code_challenge')).toHaveLength(43)
  expect(url.searchParams.get('state')).toHaveLength(64)
  expect(url.searchParams.get('redirect_uri')).toBe(`${baseURL}/`)
  expect(url.searchParams.has('client_secret')).toBe(false)
})

test('Spotify denial keeps the external link and offers retry', async ({ page }) => {
  await mockSpotify(page)
  await page.route('https://api.spotify.com/v1/me/player/play?*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }))
  await page.goto(`${baseURL}/?preview=special-cards`)
  await page.getByRole('button', { name: /Preludium C-dur/ }).click()
  await expect(page.getByRole('status')).toContainText('Spotify odmówiło odtwarzania')
  await expect(page.getByRole('button', { name: 'Odtwórz', exact: true })).toBeEnabled()
  await expect(page.getByRole('link', { name: 'Posłuchaj w Spotify' })).toBeVisible()
})
test('mobile card controls fit inside the modal and remain reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseURL}/?preview=special-cards`)
  await page.getByRole('button', { name: /Preludium „Deszczowe”/ }).click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: 'Połącz Spotify Premium' }).scrollIntoViewIfNeeded()
  await expect(modal.getByRole('button', { name: 'Połącz Spotify Premium' })).toBeVisible()
  expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await modal.getByRole('button', { name: 'Zamknij', exact: true }).click()
  await expect(modal).not.toBeVisible()
})


test('missing device is transferred and retried without recreating the SDK player', async ({ page }) => {
  await mockSpotify(page)
  let attempts = 0
  let transfers = 0
  await page.route('https://api.spotify.com/v1/me/player', async route => {
    expect(route.request().postDataJSON()).toEqual({ device_ids: ['test-device'], play: false })
    transfers++
    await route.fulfill({ status: 204 })
  })
  await page.route('https://api.spotify.com/v1/me/player/play?*', async route => {
    attempts++
    if (attempts === 1) await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { reason: 'NO_ACTIVE_DEVICE' } }) })
    else await route.fallback()
  })
  await page.goto(`${baseURL}/?preview=special-cards`)
  await page.getByRole('button', { name: /Preludium C-dur/ }).click()
  await expect(page.getByRole('button', { name: 'Pauza', exact: true })).toBeEnabled()
  expect(attempts).toBe(2)
  expect(transfers).toBe(1)
  expect(await page.evaluate(() => (window as any).__spotify.disconnected)).toBe(0)
})

test('an accepted delayed play is paused after closing the modal', async ({ page }) => {
  await mockSpotify(page)
  let accepted = false
  await page.route('https://api.spotify.com/v1/me/player/play?*', async route => {
    accepted = true
    await new Promise(resolve => setTimeout(resolve, 500))
    await route.fallback()
  })
  await page.goto(`${baseURL}/?preview=special-cards`)
  await page.getByRole('button', { name: /Preludium C-dur/ }).click()
  await expect.poll(() => accepted).toBe(true)
  await page.getByRole('button', { name: 'Zamknij', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).__spotify.plays)).toBe(1)
  await expect.poll(() => page.evaluate(() => (window as any).__spotify.state.paused)).toBe(true)
})

test('main app restores an unlocked music card after Spotify authorization and plays it', async ({ page }) => {
  await mockSpotify(page)
  await page.goto(baseURL)
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('edis-quest-log', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('journal')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('journal', 'readwrite')
      tx.objectStore('journal').put({ quests: [], performances: [], sessions: [], completed: {}, revealed: ['beethoven'] }, 'edi')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })
  await page.goto(`${baseURL}/?music-card=bach-prelude`)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading')).toHaveText('Preludium C-dur')
  await expect(dialog.getByRole('button', { name: 'Pauza', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Zamknij', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).__spotify.state.paused)).toBe(true)
  await page.locator('.album-row.special').getByRole('button', { name: 'Preludium C-dur' }).click()
  await expect(dialog.getByRole('button', { name: 'Pauza', exact: true })).toBeEnabled()
})
