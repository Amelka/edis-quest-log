import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { practiceTotals } from './log'

async function asset(name: string) {
  const response = await fetch('/art/' + name)
  if (!response.ok) throw new Error('Nie udało się pobrać zasobów raportu.')
  return new Uint8Array(await response.arrayBuffer())
}

function duration(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
}

export async function downloadWeeklyReport(
  dates: string[], pieces: string[], totals: ReturnType<typeof practiceTotals>,
) {
  const [font, avatar] = await Promise.all([asset('lexend.ttf'), asset('edi-avatar-v2.png')])
  const pdf = new jsPDF({ orientation: 'landscape', format: 'a4', putOnlyUsedFonts: true })
  pdf.addFileToVFS('Lexend.ttf', Array.from(font, byte => String.fromCharCode(byte)).join(''))
  pdf.addFont('Lexend.ttf', 'Lexend', 'normal')
  pdf.setFont('Lexend')
  const first = dates[0]
  const last = dates[dates.length - 1]
  const formatDate = (date: string) => date.split('-').reverse().join('.')

  autoTable(pdf, {
    startY: 48,
    margin: { top: 48, right: 14, bottom: 15, left: 14 },
    head: [['Utwór', ...dates.map(formatDate), 'Razem']],
    body: pieces.length ? pieces.map(piece => {
      const times = dates.map(date => totals.piecesByDay.get(date)?.get(piece) ?? 0)
      return [piece, ...times.map(duration), duration(times.reduce((sum, time) => sum + time, 0))]
    }) : [[{ content: 'Brak ćwiczeń w tym okresie', colSpan: dates.length + 2 }]],
    foot: [['Łącznie', ...dates.map(date => duration(totals.days.get(date) ?? 0)),
      duration(dates.reduce((sum, date) => sum + (totals.days.get(date) ?? 0), 0))]],
    showFoot: 'lastPage',
    styles: { font: 'Lexend', fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [42, 33, 77], fontStyle: 'normal' },
    footStyles: { fillColor: [42, 33, 77], fontStyle: 'normal' },
    columnStyles: { 0: { cellWidth: 63 } },
    rowPageBreak: 'avoid',
    willDrawPage: () => {
      pdf.addImage(avatar, 'PNG', 14, 13, 28, 28, 'edi')
      pdf.setTextColor(42, 33, 77)
      pdf.setFontSize(19)
      pdf.text('Edi · Tygodniowy raport ćwiczeń', 48, 22)
      pdf.setFontSize(10)
      pdf.text(formatDate(first) + ' - ' + formatDate(last) + '   |   Czas gry w minutach i sekundach (mm:ss)', 48, 32)
    },
  })
  pdf.save('edi-raport-' + first + '_' + last + '.pdf')
}
