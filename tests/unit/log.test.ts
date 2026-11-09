import { describe, expect, it } from 'vitest'
import { elapsed, emptyLog, moveQuest, occurs, practiceTotals, questsForDay, settleTimer, specialEarned, totalXP } from '../../src/log'
import type { Log, Quest } from '../../src/log'

const minute = 60_000
const monday = '2026-11-02'
const tuesday = '2026-11-03'
const weekdays = [0, 1, 2, 3, 4, 5, 6]
const quest: Quest = {
  id: 'q1', piece: 'Polonez', minutes: 5, xp: 20, tips: '',
  start: monday, end: tuesday, weekdays,
}
const freshLog = () => structuredClone(emptyLog)

describe('plan dnia', () => {
  it('uwzględnia obie granice zakresu i dni tygodnia', () => {
    expect(['2026-11-01', monday, tuesday, '2026-11-04'].map(day => occurs(quest, day)))
      .toEqual([false, true, true, false])
    expect(occurs({ ...quest, weekdays: [1] }, tuesday)).toBe(false)
    expect([monday, tuesday].map(day => occurs({ ...quest, end: monday, weekdays: [1] }, day)))
      .toEqual([true, false])
  })

  it('zapisuje kolejność wyłącznie dla wybranego dnia', () => {
    const log = freshLog()
    log.quests = [quest, { ...quest, id: 'q2' }]
    moveQuest(log, monday, 'q2', 'q1')
    moveQuest(log, monday, 'missing', 'q2')
    expect(questsForDay(log, monday).map(entry => entry.id)).toEqual(['q2', 'q1'])
    expect(questsForDay(log, tuesday).map(entry => entry.id)).toEqual(['q1', 'q2'])
  })
})

describe('czas i nagrody', () => {
  it('rozlicza timer do terminu i nie powiela sesji przy ponownym rozliczeniu', () => {
    const log = freshLog()
    log.timer = { questKey: 'q1', piece: 'Polonez', start: minute, deadline: 6 * minute }
    settleTimer(log, 8 * minute)
    settleTimer(log, 9 * minute)
    expect(log.timer).toBeUndefined()
    expect(log.sessions).toHaveLength(1)
    expect(elapsed(log, 'q1', 9 * minute)).toBe(5 * minute)
  })

  it('zachowuje XP i kartę specjalną za usunięty ukończony występ', () => {
    const log: Log = {
      ...freshLog(), completed: { concert: 100 },
      performances: [
        { id: 'concert', title: 'Koncert', day: monday, xp: 100, rating: '', comment: '', deleted: true },
        { id: 'future', title: 'Występ', day: tuesday, xp: 100, rating: '', comment: '' },
      ],
    }
    expect(totalXP(log)).toBe(100)
    expect(specialEarned(log)).toBe(1)
  })

  it('dzieli sesję przez lokalną północ i ogranicza aktywny timer do terminu', () => {
    const log = freshLog()
    log.sessions.push({
      questKey: 'q1', piece: 'Polonez',
      start: Date.parse('2026-10-31T22:58:00Z'), end: Date.parse('2026-10-31T23:03:00Z'),
    })
    const start = Date.parse('2026-10-31T23:10:00Z')
    log.timer = { questKey: 'q2', piece: 'Preludium', start, deadline: start + 4 * minute }
    const { pieces, days, piecesByDay } = practiceTotals(log, start + 9 * minute)
    expect([...pieces]).toEqual([['Polonez', 5 * minute], ['Preludium', 4 * minute]])
    expect([...days]).toEqual([['2026-10-31', 2 * minute], ['2026-11-01', 7 * minute]])
    expect([...piecesByDay.get('2026-11-01')!]).toEqual([['Polonez', 3 * minute], ['Preludium', 4 * minute]])
  })
})
