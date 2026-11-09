import { useState } from 'react'
import type { CSSProperties } from 'react'
import { colorForPiece, dateOf, dayKey, piecePalette } from './log'
import type { Log, practiceTotals } from './log'

const shortDate = new Intl.DateTimeFormat('pl', { day: 'numeric', month: 'numeric' })
const fullDate = new Intl.DateTimeFormat('pl', { weekday: 'long', day: 'numeric', month: 'long' })
const minute = 60_000

function clockLabel(duration: number) {
  const seconds = Math.floor(duration / 1000)
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
}

function durationLabel(duration: number) {
  const seconds = Math.floor(duration / 1000)
  return Math.floor(seconds / 60) + ' min ' + (seconds % 60) + ' s'
}

export function ProgressRing({ title, value, detail, progress }: {
  title: string; value: string; detail: string; progress: number
}) {
  const fill = Math.max(0, Math.min(1, progress))
  return <div className="profile-metric">
    <h3>{title}</h3>
    <div className="profile-ring" style={{ '--ring-fill': fill * 100 + '%' } as CSSProperties}>
      <div className="ring-label"><strong>{value}</strong><span>{detail}</span></div>
    </div>
  </div>
}

type WeekData = { today: string; totals: ReturnType<typeof practiceTotals> }

function weekData({ today, totals }: WeekData) {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = dateOf(today)
    date.setDate(date.getDate() + index - 6)
    return dayKey(date)
  })
  const pieces = [...new Set(dates.flatMap(day => [...(totals.piecesByDay.get(day)?.keys() ?? [])]))]
    .sort((a, b) => a.localeCompare(b, 'pl'))
  return { dates, pieces }
}

export function WeeklyReportButton({ today, totals }: WeekData) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)

  async function exportReport() {
    setExporting(true)
    setExportError(false)
    try {
      const { downloadWeeklyReport } = await import('./weeklyReport')
      const { dates, pieces } = weekData({ today, totals })
      await downloadWeeklyReport(dates, pieces, totals)
    } catch {
      setExportError(true)
    } finally {
      setExporting(false)
    }
  }

  return <div className="weekly-report-action">
    <button type="button" disabled={exporting} onClick={exportReport}>
      {exporting ? 'Przygotowuję PDF…' : 'Pobierz raport PDF'}
    </button>
    {exportError && <p className="error" role="alert">Nie udało się pobrać raportu. Spróbuj ponownie.</p>}
  </div>
}

export function PracticeWeek({ today, totals, colors }: WeekData & { colors: Log['pieceColors'] }) {
  const [filter, setFilter] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const { dates, pieces } = weekData({ today, totals })
  const activeFilter = filter !== null && pieces.includes(filter) ? filter : null
  const activeDay = selectedDay && dates.includes(selectedDay) ? selectedDay : today
  const breakdown = [...(totals.piecesByDay.get(activeDay) ?? [])].sort((a, b) => b[1] - a[1])
  const max = Math.max(minute, ...dates.map(day => totals.days.get(day) ?? 0))
  const chartMax = Math.ceil(max / minute) * minute
  const color = (piece: string) => piecePalette[colorForPiece(colors, piece)].hex

  return <section className="practice-week" aria-labelledby="practice-week-title">
    <h3 id="practice-week-title">Ostatnie 7 dni</h3>
    <div className="week-filters" role="group" aria-label="Filtr utworu">
      <button type="button" aria-pressed={activeFilter === null} onClick={() => setFilter(null)}>Wszystkie</button>
      {pieces.map(piece => <button type="button" key={piece} aria-pressed={activeFilter === piece} onClick={() => setFilter(piece)}>
        <span className="week-dot" style={{ backgroundColor: color(piece) }} aria-hidden="true" />{piece}
      </button>)}
    </div>
    <p className="album-note">Wybierz kolumnę, żeby zobaczyć utwory i czas gry w danym dniu.</p>
    <div className="week-bars" role="group" aria-label="Czas gry według dni">
      {dates.map(day => {
        const duration = (activeFilter === null ? totals.days.get(day) : totals.piecesByDay.get(day)?.get(activeFilter)) ?? 0
        const date = dateOf(day)
        return <button type="button" className="week-column" key={day} aria-pressed={activeDay === day}
          aria-label={fullDate.format(date) + ', ' + durationLabel(duration)}
          onClick={() => setSelectedDay(day)}>
          <span className="week-track" aria-hidden="true"><span className="week-bar" style={{
            height: duration / chartMax * 100 + '%',
            backgroundColor: activeFilter === null ? undefined : color(activeFilter),
          }} /></span>
          <span className="week-time">{clockLabel(duration)}</span>
          <span className="week-date">{shortDate.format(date)}</span>
        </button>
      })}
    </div>
    <section className="week-breakdown" aria-labelledby="week-breakdown-title" aria-live="polite">
      <h4 id="week-breakdown-title">Utwory · {fullDate.format(dateOf(activeDay))}</h4>
      {breakdown.length ? <ul>{breakdown.map(([piece, duration]) => <li className="split" key={piece}>
        <span><span className="week-dot" style={{ backgroundColor: color(piece) }} aria-hidden="true" />{piece}</span>
        <strong>{durationLabel(duration)}</strong>
      </li>)}</ul> : <p>Brak ćwiczeń</p>}
    </section>
  </section>
}
