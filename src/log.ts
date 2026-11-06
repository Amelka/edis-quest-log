export type Quest = {
  id: string
  title: string
  piece: string
  minutes: number
  xp: number
  tips: string
  start: string
  end: string
  weekdays: number[]
}

export type Performance = {
  id: string
  title: string
  day: string
  xp: number
  rating: string
  comment: string
}

type Session = {
  questKey: string
  piece: string
  start: number
  end: number
}

type Timer = Omit<Session, 'end'> & { deadline: number }

export type Log = {
  quests: Quest[]
  performances: Performance[]
  sessions: Session[]
  completed: Record<string, number>
  revealed: string[]
  timer?: Timer
}

export const emptyLog: Log = {
  quests: [], performances: [], sessions: [], completed: {}, revealed: [],
}

export function dayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return [year, month, day].join('-')
}

export const dateOf = (day: string) => new Date(day + 'T12:00:00')
export const questKey = (quest: Quest, day: string) => quest.id + '/' + day
export const occurs = (quest: Quest, day: string) =>
  day >= quest.start && day <= quest.end && quest.weekdays.includes(dateOf(day).getDay())

export function elapsed(log: Log, key: string, now: number) {
  const saved = log.sessions.reduce((total, session) =>
    total + (session.questKey === key ? session.end - session.start : 0), 0)
  const timer = log.timer
  return saved + (timer?.questKey === key ? Math.max(0, Math.min(now, timer.deadline) - timer.start) : 0)
}

export function settleTimer(log: Log, now: number) {
  const timer = log.timer
  if (!timer) return
  const end = Math.min(now, timer.deadline)
  if (end > timer.start) log.sessions.push({ ...timer, end })
  delete log.timer
}

export const totalXP = (log: Log) => Object.values(log.completed).reduce((sum, xp) => sum + xp, 0)
export const specialEarned = (log: Log) => log.performances.filter(event => event.id in log.completed).length

export function practiceTotals(log: Log, now: number) {
  const pieces = new Map<string, number>()
  const days = new Map<string, number>()
  const sessions = [...log.sessions]
  if (log.timer) sessions.push({ ...log.timer, end: Math.min(now, log.timer.deadline) })
  for (const session of sessions) {
    const duration = Math.max(0, session.end - session.start)
    if (!duration) continue
    pieces.set(session.piece, (pieces.get(session.piece) ?? 0) + duration)
    let cursor = session.start
    while (cursor < session.end) {
      const date = new Date(cursor)
      const key = dayKey(date)
      date.setHours(24, 0, 0, 0)
      const end = Math.min(date.getTime(), session.end)
      days.set(key, (days.get(key) ?? 0) + end - cursor)
      cursor = end
    }
  }
  return { pieces, days }
}

let database: Promise<IDBDatabase> | undefined

function openLog() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('edis-quest-log', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('journal')
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        database = undefined
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Zamknij inne karty z dziennikiem i spróbuj ponownie.'))
  }).catch(error => {
    database = undefined
    throw error
  }) as Promise<IDBDatabase>
  return database
}

export async function accessLog(change?: (log: Log) => void): Promise<Log> {
  const db = await openLog()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('journal', change ? 'readwrite' : 'readonly')
    const store = transaction.objectStore('journal')
    const request = store.get('edi')
    let log: Log
    let failure: unknown
    request.onsuccess = () => {
      log = request.result ?? structuredClone(emptyLog)
      if (!change) return
      try {
        if (log.timer && log.timer.deadline <= Date.now()) settleTimer(log, Date.now())
        change(log)
        store.put(log, 'edi')
      } catch (error) {
        failure = error
        transaction.abort()
      }
    }
    transaction.oncomplete = () => resolve(log)
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Zapis został przerwany.'))
    transaction.onerror = () => reject(failure ?? transaction.error)
  })
}
