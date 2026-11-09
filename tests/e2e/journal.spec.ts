import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { expect, test as base } from '@playwright/test'
import { emptyLog } from '../../src/log'
import type { Log } from '../../src/log'

const now = new Date('2026-11-08T12:00:00+01:00')
const day = '2026-11-08'
const test = base.extend<{ openJournal: (seed?: Partial<Log>) => Promise<void> }>({
  openJournal: async ({ page }, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'edi-e2e-'))
    const server = spawn('python3', ['-B', 'tests/serve.py', directory], { stdio: ['ignore', 'pipe', 'inherit'] })
    const closed = once(server, 'close')
    const lines = createInterface({ input: server.stdout })
    try {
      const [line] = await once(lines, 'line', { signal: AbortSignal.timeout(5000) })
      await use(async seed => {
        if (seed) await writeFile(join(directory, 'journal.json'), JSON.stringify({ ...emptyLog, ...seed }))
        await page.clock.install({ time: new Date(now.getTime() - 60_000) })
        await page.clock.pauseAt(now)
        await page.goto(line)
        await expect(page.getByRole('button', { name: 'Statystyki' })).toBeEnabled()
      })
    } finally {
      lines.close()
      server.kill()
      try { await closed } finally { await rm(directory, { recursive: true, force: true }) }
    }
  },
})

test('ukończenie questu zapisuje czas, XP i odblokowuje kartę przy 100 XP', async ({ page, openJournal }) => {
  await openJournal({ completed: { previous: 99 } })
  await expect(page.getByRole('button', { name: 'Odkryj kartę' })).toHaveCount(0)
  await page.getByRole('button', { name: /Dodaj/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Utwór', { exact: true }).fill('Polonez')
  await dialog.getByLabel('Minuty').fill('1')
  await dialog.getByLabel('XP', { exact: true }).fill('1')
  await dialog.getByRole('button', { name: 'Zapisz w planie' }).click()
  const quest = page.locator('#quests').getByRole('button', { name: /Polonez/ })
  await quest.click()
  await dialog.getByRole('button', { name: /Zacznij ćwiczyć/ }).click()
  await expect(dialog.getByRole('button', { name: /Zatrzymaj timer/ })).toBeVisible()
  await page.clock.fastForward(61_000)
  await dialog.getByRole('button', { name: /Oznacz quest jako ukończony/ }).click()
  await expect(quest).toContainText('Ukończony')
  await page.reload()
  await expect(quest).toContainText('Ukończony')
  await expect(page.locator('.profile-player .xp')).toHaveText('100 XP')
  await expect(page.getByRole('button', { name: 'Odkryj kartę' })).toHaveCount(1)
  await expect(page.locator('.profile-ring').first()).toContainText('1 min')
  await quest.click()
  await expect(dialog.getByText('✓ Quest ukończony')).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Oznacz quest jako ukończony/ })).toHaveCount(0)
})

test('występ jest pierwszy, można zmienić jego datę i usunąć go bez utraty nagrody', async ({ page, openJournal }) => {
  await openJournal({
    quests: [{ id: 'quest', piece: 'Polonez', minutes: 5, xp: 20, tips: '', start: day, end: day, weekdays: [0] }],
    performances: [{ id: 'event', title: 'Koncert', day, xp: 50, rating: '', comment: '' }],
  })
  const quests = page.locator('#quests')
  const performance = quests.getByRole('button', { name: /Koncert/ })
  await expect(quests.locator('.entry').first()).toContainText('Koncert')
  await performance.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Edytuj' }).click()
  await dialog.getByLabel('Data', { exact: true }).fill('2026-11-07')
  await dialog.getByRole('button', { name: 'Zapisz zmiany' }).click()
  await dialog.getByRole('button', { name: 'Zamknij' }).click()
  await expect(performance).toBeVisible()
  await page.getByRole('button', { name: 'Dziś', exact: true }).click()
  await expect(performance).toHaveCount(0)
  await page.getByRole('button', { name: /7 listopada.*występ/ }).click()
  await performance.click()
  await dialog.getByRole('button', { name: 'Oznacz występ jako ukończony' }).click()
  await expect(dialog.getByText(/Występ ukończony/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Edytuj' }).click()
  page.once('dialog', confirmation => confirmation.dismiss())
  await dialog.getByRole('button', { name: 'Usuń występ' }).click()
  await expect(dialog).toBeVisible()
  page.once('dialog', confirmation => confirmation.accept())
  await dialog.getByRole('button', { name: 'Usuń występ' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(performance).toHaveCount(0)
  await expect(page.getByRole('button', { name: /7 listopada.*występ/ })).toHaveCount(0)
  await expect(page.locator('.profile-player .xp')).toHaveText('50 XP')
  await expect(page.locator('.album-row.special').getByRole('button', { name: 'Odkryj kartę' })).toBeVisible()
})

test('filtr tygodnia zmienia kolumny, a szczegóły dnia nadal pokazują wszystkie utwory', async ({ page, openJournal }, testInfo) => {
  const start = Date.parse('2026-11-07T12:00:00+01:00')
  await openJournal({ sessions: [
    { questKey: 'p', piece: 'Polonez', start, end: start + 120_000 },
    { questKey: 'n', piece: 'Nokturn', start: start + 180_000, end: start + 360_000 },
  ] })
  await page.getByRole('button', { name: 'Statystyki' }).click()
  const dialog = page.getByRole('dialog')
  const bars = dialog.getByRole('group', { name: 'Czas gry według dni' })
  await expect(bars.getByRole('button')).toHaveCount(7)
  await dialog.getByRole('button', { name: 'Polonez', exact: true }).click()
  const dayWithPractice = bars.getByRole('button', { name: /7 listopada.*2 min/ })
  await dayWithPractice.focus()
  await dayWithPractice.press('Enter')
  const breakdown = dialog.getByRole('region', { name: /Utwory/ })
  await expect(breakdown.getByRole('listitem').filter({ hasText: 'Polonez' })).toContainText('2 min')
  await expect(breakdown.getByRole('listitem').filter({ hasText: 'Nokturn' })).toContainText('3 min')
  await bars.getByRole('button', { name: /8 listopada/ }).click()
  await expect(breakdown).toContainText('Brak ćwiczeń')
  await page.clock.resume()
  const pendingDownload = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Pobierz raport PDF' }).click()
  const download = await pendingDownload
  expect(download.suggestedFilename()).toBe('edi-raport-2026-11-02_2026-11-08.pdf')
  await download.saveAs(testInfo.outputPath('raport.pdf'))
  await dialog.getByRole('button', { name: 'Wszystkie' }).click()
  await expect(bars.getByRole('button', { name: /7 listopada.*5 min/ })).toBeVisible()
})
