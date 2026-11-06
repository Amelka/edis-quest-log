import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { regularCards, specialCards } from './cards'
import type { Card } from './cards'
import { accessLog, colorForPiece, dateOf, dayKey, elapsed, emptyLog, moveQuest, occurs, pieceColorKey, pieceColorOptions, piecePalette, practiceTotals, questKey, questsForDay, setPieceColor, settleTimer, specialEarned, totalXP } from './log'
import type { Log, Performance, PieceColor, Quest } from './log'
import './style.css'

type Modal = { kind: 'add' } | { kind: 'quest' | 'edit'; id: string; day: string } |
  { kind: 'event'; id: string } | { kind: 'card'; card: Card; special: boolean; discovering?: boolean } | { kind: 'history' }

const weekdayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So']
const formatDate = new Intl.DateTimeFormat('pl', { day: 'numeric', month: 'long' })
const fullDate = new Intl.DateTimeFormat('pl', { weekday: 'long', day: 'numeric', month: 'long' })
const minutes = (ms: number) => Math.floor(ms / 60000)
const cardUrl = (card: Card) => '/art/' + card.id + '.jpg'

function dateRange(today: string, selected: string) {
  const start = dateOf(today)
  start.setDate(start.getDate() - 2)
  const end = dateOf(today)
  const month = end.getMonth()
  end.setMonth(month + 1, 1)
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
  end.setDate(Math.min(dateOf(today).getDate(), lastDay))
  const first = selected < dayKey(start) ? dateOf(selected) : start
  if (selected > dayKey(end)) end.setTime(dateOf(selected).getTime())
  const days = []
  for (const date = new Date(first); date <= end; date.setDate(date.getDate() + 1)) days.push(dayKey(date))
  return days
}

function Gem() {
  return <svg className="gem-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 4h12l5 6-11 11L1 10Z" fill="currentColor" />
    <path d="m6 4 2 6H1Zm12 0 5 6h-7Z" fill="#fff" opacity=".35" />
    <path d="m8 10 4 11 4-11Z" fill="#14112a" opacity=".35" />
    <path d="M1 10h22M8 10l4-6 4 6" fill="none" stroke="#14112a" opacity=".6" />
  </svg>
}

function Dialog({ title, children, close, action, cardMode }: {
  title: string; children: ReactNode; close: () => void; action?: ReactNode; cardMode?: 'preview' | 'discovery'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = ref.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog className={cardMode ? 'card-dialog ' + cardMode : undefined} ref={ref} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); close() }}>
    <div className="dialog-head">
      {!cardMode && <h2 id="dialog-title">{title}</h2>}
      <div className="dialog-actions">
        {action}
        <button className="icon" aria-label="Zamknij" autoFocus onClick={close}>×</button>
      </div>
    </div>
    {children}
  </dialog>
}

function EntryForm({ day, quest, suggestions, colors, save }: {
  day: string; quest?: Quest; suggestions: string[]; colors: Log['pieceColors'];
  save: (entry: Quest | Performance, color?: PieceColor) => void
}) {
  const [kind, setKind] = useState('quest')
  const [pieceInput, setPieceInput] = useState(quest?.piece ?? '')
  const [colorOverride, setColorOverride] = useState<{ key: string; color: PieceColor }>()
  const pieceKey = pieceColorKey(pieceInput)
  const chosenColor = colorOverride?.key === pieceKey ? colorOverride.color : colorForPiece(colors, pieceInput)
  const [repeat, setRepeat] = useState(quest ? quest.weekdays.length === 7 ? 'daily' : quest.start === quest.end ? 'once' : 'weekly' : 'daily')
  const [start, setStart] = useState(quest?.start ?? day)
  const defaultEnd = dateOf(day)
  defaultEnd.setDate(defaultEnd.getDate() + 6)
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const value = (key: string) => String(data.get(key) ?? '').trim()
    const start = value('start')
    const title = value('title')
    const piece = value('piece')
    const common = { id: quest?.id ?? crypto.randomUUID(), xp: Number(value('xp')) }
    if (!(kind === 'quest' ? piece : title)) {
      setError(kind === 'quest' ? 'Wpisz nazwę utworu.' : 'Wpisz nazwę występu.')
      return
    }
    if (kind === 'event') {
      save({ ...common, title, day: start, rating: '', comment: '' })
      return
    }
    const end = repeat === 'once' ? start : value('end')
    const weekdays = repeat === 'once' ? [dateOf(start).getDay()] :
      repeat === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : data.getAll('weekday').map(Number)
    if (!weekdays.length || !dateRangeContainsDay(start, end, weekdays)) {
      setError('Wybierz przynajmniej jeden dzień, który wypada w podanym zakresie.')
      return
    }
    save({ ...common, start, end, weekdays, title, piece, minutes: Number(value('minutes')), tips: value('tips') },
      colorOverride?.key === pieceColorKey(piece) ? colorOverride.color : undefined)
  }
  return <form onSubmit={submit}>
    {!quest && <label>Rodzaj wpisu<select value={kind} onChange={event => { setKind(event.target.value); setError('') }}>
      <option value="quest">Quest ćwiczeniowy</option><option value="event">Występ lub konkurs</option>
    </select></label>}
    <label>Nazwa<input key={kind} name="title" defaultValue={quest?.title} required={kind === 'event'} maxLength={100}
      placeholder={kind === 'quest' ? 'Opcjonalnie, np. Lewa ręka' : 'Koncert zimowy'} /></label>
    {kind === 'quest' && <>
      <label>Utwór<input name="piece" list="known-pieces" value={pieceInput} onChange={event => setPieceInput(event.target.value)} required maxLength={100} placeholder="Nokturn Es-dur" /></label>
      <label>Kolor utworu
        <span className="piece-color-picker">
          <span className="piece-color-swatch" style={{ backgroundColor: piecePalette[chosenColor].hex }} aria-hidden="true" />
          <select value={chosenColor} onChange={event => setColorOverride({ key: pieceKey, color: event.target.value as PieceColor })}>
            {pieceColorOptions.map(color => <option key={color} value={color}>{piecePalette[color].name}</option>)}
          </select>
        </span>
      </label>
      <datalist id="known-pieces">{suggestions.map(piece => <option key={piece} value={piece} />)}</datalist>
    </>}
    <div className="form-row">
      <label>{kind === 'quest' && (repeat !== 'once' || quest) ? 'Data od' : 'Data'}<input name="start" type="date" required defaultValue={start} onInput={event => setStart(event.currentTarget.value)} /></label>
      {kind === 'quest' && <label>Minuty<input name="minutes" type="number" min="1" max="240" defaultValue={quest?.minutes ?? 10} required /></label>}
      <label>XP<input key={kind} name="xp" type="number" min="1" max="9999" defaultValue={kind === 'quest' ? quest?.xp ?? 20 : 100} required /></label>
    </div>
    {kind === 'quest' && <>
      <label>Powtarzanie<select value={repeat} onChange={event => { setRepeat(event.target.value); setError('') }}>
        <option value="once">Jednorazowo</option><option value="daily">Codziennie</option><option value="weekly">Wybrane dni tygodnia</option>
      </select></label>
      {(repeat !== 'once' || quest) && <label>Data do<input name="end" type="date" min={start}
        value={repeat === 'once' ? start : undefined} defaultValue={repeat === 'once' ? undefined : quest?.end ?? dayKey(defaultEnd)}
        key={repeat === 'once' ? 'once' : 'range'} disabled={repeat === 'once'} required /></label>}
      {repeat === 'weekly' && <fieldset><legend>Dni tygodnia</legend><div className="weekdays">
        {[1, 2, 3, 4, 5, 6, 0].map(index => <label key={index}><input type="checkbox" name="weekday" value={index} defaultChecked={quest?.weekdays.includes(index)} />{weekdayNames[index]}</label>)}
      </div></fieldset>}
      <label>Wskazówki nauczyciela<textarea name="tips" defaultValue={quest?.tips} rows={3} maxLength={1500} /></label>
    </>}
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary">{quest ? 'Zapisz zmiany' : 'Zapisz w planie'}</button>
  </form>
}

function dateRangeContainsDay(start: string, end: string, weekdays: number[]) {
  const date = dateOf(start)
  for (let offset = 0; offset < 7 && dayKey(date) <= end; offset++, date.setDate(date.getDate() + 1)) {
    if (weekdays.includes(date.getDay())) return true
  }
  return false
}

function AlbumRow({ cards, log, available, special, open, reveal }: {
  cards: Card[]; log: Log; available: number; special: boolean;
  open: (card: Card, special: boolean) => void; reveal: (special: boolean) => void;
}) {
  const count = cards.filter(card => log.revealed.includes(card.id)).length
  const next = cards.find(card => !log.revealed.includes(card.id))
  return <section className={'album-row ' + (special ? 'special' : '')}>
    <div className="split"><h3>{special ? 'Karty specjalne' : 'Karty zwykłe'}</h3><span className="count">{count} / {cards.length}</span></div>
    <div className="card-grid">{cards.map((card, index) => {
      const unlocked = log.revealed.includes(card.id)
      return unlocked ? <button className="card-slot unlocked" key={card.id} onClick={() => open(card, special)}>
        <img src={cardUrl(card)} alt="" /><span>{card.name}</span>
      </button> : card === next && available > 0 ?
        <button className="card-slot card-back ready" key={card.id} aria-label="Odkryj kartę" onClick={() => reveal(special)}><b aria-hidden="true">✦</b><span>Odkryj</span></button> :
        <div className="card-slot card-back locked" key={card.id} aria-label={'Zakryta karta ' + (index + 1)}><b aria-hidden="true">{special ? '✦' : '♫'}</b><span>{String(index + 1).padStart(2, '0')}</span></div>
    })}</div>
    {!next ? <p className="album-note">Kolekcja ukończona — {count}/{cards.length}.{available > 0 && ' Czekające odkrycia: ' + available + '.'}</p> :
      <p className="album-note">{available > 0 ? 'Czekające odkrycia: ' + available : special ? 'Ukończ występ, żeby zdobyć kartę specjalną.' : 'Co 100 XP możesz odkryć nową kartę.'}</p>}
  </section>
}

function EventDetails({ event, done, today, save, complete }: {
  event: Performance; done: boolean; today: string; save: (rating: string, comment: string) => void; complete: () => void;
}) {
  return <>
    <p className="eyebrow">{formatDate.format(dateOf(event.day))} · +{event.xp} XP · karta specjalna</p>
    {done ? <form onSubmit={submit => {
      submit.preventDefault()
      const data = new FormData(submit.currentTarget)
      save(String(data.get('rating')).trim(), String(data.get('comment')).trim())
    }}>
      <p className="success">✓ Występ ukończony</p>
      <label>Ocena<input name="rating" defaultValue={event.rating} maxLength={80} /></label>
      <label>Komentarz<textarea name="comment" rows={4} defaultValue={event.comment} maxLength={1500} /></label>
      <button className="primary">Zapisz notatkę</button>
    </form> : <button className="primary" disabled={event.day > today} onClick={complete}>Oznacz występ jako ukończony</button>}
  </>
}

function App() {
  const [log, setLog] = useState(emptyLog)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(Date.now)
  const today = dayKey(new Date(now))
  const [selected, setSelected] = useState(dayKey)
  const [drag, setDrag] = useState<{ day: string; questId: string; targetId?: string } | null>(null)
  const [modal, setModal] = useState<Modal | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const axis = useRef<HTMLDivElement>(null)
  const channel = useRef<BroadcastChannel | null>(null)
  const busy = useRef(false)

  async function load() {
    try {
      setLog(await accessLog())
      setLoaded(true)
      setError('')
    } catch {
      setError('Nie udało się odczytać dziennika. Sprawdź, czy lokalny serwer działa, i odśwież stronę.')
    }
  }

  useEffect(() => {
    void load()
    const broadcast = new BroadcastChannel('edis-quest-log')
    channel.current = broadcast
    broadcast.onmessage = () => void load()
    const refresh = () => { if (!busy.current) void load() }
    window.addEventListener('focus', refresh)
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => {
      broadcast.close()
      channel.current = null
      window.removeEventListener('focus', refresh)
      window.clearInterval(interval)
    }
  }, [])

  async function update(change: (state: Log) => void, after?: (state: Log) => void) {
    if (busy.current || !loaded) return
    busy.current = true
    try {
      const state = await accessLog(change)
      setLog(state)
      setError('')
      channel.current?.postMessage('changed')
      after?.(state)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Zapis się nie powiódł. Spróbuj ponownie.')
    } finally {
      busy.current = false
    }
  }

  const { pieces, days } = practiceTotals(log, now)
  const pieceStyle = (piece: string) => ({
    '--piece-color': piecePalette[colorForPiece(log.pieceColors, piece)].hex,
  } as CSSProperties)
  const xp = totalXP(log)
  const earned = Math.floor(xp / 100) - regularCards.filter(card => log.revealed.includes(card.id)).length
  const specials = specialEarned(log) - specialCards.filter(card => log.revealed.includes(card.id)).length
  const quests = questsForDay(log, selected)
  const events = log.performances.filter(event => event.day === selected)
  const completed = quests.filter(quest => questKey(quest, selected) in log.completed).length
  const timeline = dateRange(today, selected)

  useEffect(() => {
    const strip = axis.current
    const button = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (strip && button) {
      const bounds = strip.getBoundingClientRect()
      const selectedBounds = button.getBoundingClientRect()
      if (selectedBounds.left < bounds.left || selectedBounds.right > bounds.right) {
        strip.scrollLeft += selectedBounds.left - bounds.left - 4
      }
    }
  }, [selected, today])
  const running = log.timer && log.timer.deadline > now ? log.timer : undefined
  const modalQuest = modal?.kind === 'quest' || modal?.kind === 'edit' ? log.quests.find(quest => quest.id === modal.id) : undefined
  const currentQuest = modal?.kind === 'quest' && modalQuest ? { quest: modalQuest, day: modal.day } : null
  const suggestions = [...new Set([...log.quests.map(quest => quest.piece), ...pieces.keys()])]
    .sort((a, b) => a.localeCompare(b, 'pl'))
  const currentKey = currentQuest ? questKey(currentQuest.quest, currentQuest.day) : ''
  const remaining = currentQuest ? Math.max(0, currentQuest.quest.minutes * 60000 - elapsed(log, currentKey, now)) : 0
  const seconds = Math.ceil(remaining / 1000)
  const currentEvent = modal?.kind === 'event' ? log.performances.find(event => event.id === modal.id) : undefined

  function reorderQuest(questId: string, targetId: string) {
    if (questId === targetId) return
    void update(state => moveQuest(state, selected, questId, targetId),
      () => setNotice('✓ Kolejność questów zapisana.'))
  }

  function reveal(special: boolean) {
    let card: Card | undefined
    void update(state => {
      const deck = special ? specialCards : regularCards
      const count = deck.filter(entry => state.revealed.includes(entry.id)).length
      const credits = special ? specialEarned(state) : Math.floor(totalXP(state) / 100)
      if (credits <= count) return
      card = deck.find(entry => !state.revealed.includes(entry.id))
      if (card) state.revealed.push(card.id)
    }, () => { if (card) setModal({ kind: 'card', card, special, discovering: true }) })
  }

  function toggleTimer(quest: Quest, day: string) {
    const key = questKey(quest, day)
    void update(state => {
      const time = Date.now()
      if (state.timer?.questKey === key) { settleTimer(state, time); return }
      if (state.timer) throw new Error('Zatrzymaj najpierw timer drugiego questu.')
      const planned = state.quests.find(item => item.id === quest.id)
      if (!planned || !occurs(planned, day)) throw new Error('Quest nie jest już zaplanowany na ten dzień.')
      const left = planned.minutes * 60000 - elapsed(state, key, time)
      if (left > 0 && !(key in state.completed) && day <= dayKey()) {
        state.timer = { questKey: key, piece: planned.piece, start: time, deadline: time + left }
      }
    })
  }

  function completeQuest(quest: Quest, day: string) {
    const key = questKey(quest, day)
    let awarded = false
    void update(state => {
      const planned = state.quests.find(item => item.id === quest.id)
      if (!planned || !occurs(planned, day)) throw new Error('Quest nie jest już zaplanowany na ten dzień.')
      if (key in state.completed) return
      if (elapsed(state, key, Date.now()) < planned.minutes * 60000) {
        throw new Error('Dokończ ćwiczenie przed zaliczeniem questu.')
      }
      state.completed[key] = planned.xp
      awarded = true
    }, state => {
      if (awarded) setNotice(state.quests.filter(item => occurs(item, day)).every(item => questKey(item, day) in state.completed)
        ? '✓ Plan dnia ukończony! +' + state.completed[key] + ' XP' : '✓ Quest ukończony! +' + state.completed[key] + ' XP')
      setModal(null)
    })
  }

  function chooseToday() {
    setSelected(today)
    axis.current?.scrollTo({ left: 0 })
  }

  return <>
    <header className="top"><div className="wrap top-inner"><a className="brand" href="#main"><span>♫</span> Edi’s Quest Log</a><span className="top-label">GILDIA MUZYCZNA</span></div></header>
    <main className="wrap" id="main">
      <section className="panel profile" aria-labelledby="profile-heading">
        <div className="profile-player">
          <img className="avatar" src="/art/edi-avatar-v2.png" alt="" />
          <div>
            <div className="split profile-title">
              <div><div className="eyebrow">GRACZ</div><h2 id="profile-heading">Edi</h2></div>
              <strong className="xp">{xp} XP</strong>
            </div>
            <div className="split"><span>Do następnej karty</span><b>{xp % 100} / 100 XP</b></div>
            <progress max={100} value={xp % 100} aria-label="Postęp do następnej karty" />
            {earned > 0 && <a className="reward-link" href="#album">✧ Czekające odkrycia: {earned}</a>}
          </div>
        </div>
        <div><h3>Twoja praktyka</h3><p className="album-note">Dzisiaj: <strong>{minutes(days.get(today) ?? 0)} min</strong></p>
          {pieces.size === 0 && <p className="album-note">Tu pojawi się czas ćwiczeń dla każdego utworu.</p>}
          {[...pieces].sort((a, b) => b[1] - a[1]).map(([piece, duration]) => <div className="piece" key={piece} style={pieceStyle(piece)}>
            <div className="split"><span>{piece}</span><b>{minutes(duration)} min</b></div>
            <progress max={Math.max(...pieces.values())} value={duration} aria-label={'Czas ćwiczeń: ' + piece} />
          </div>)}
          <button className="history" disabled={!loaded} onClick={() => setModal({ kind: 'history' })}>Historia ćwiczeń i występów →</button>
        </div>
      </section>
      {error && !modal && <div className="error" role="alert">{error} {!loaded && <button onClick={() => void load()}>Spróbuj ponownie</button>}</div>}
      <p className="notice" role="status">{notice}</p>
      <div className="dashboard">
        <div className="main-column">
          <section className="panel calendar" aria-labelledby="calendar-heading">
            <div className="split"><div><div className="eyebrow">01 / PLAN</div><h2 id="calendar-heading">Kalendarz</h2></div>
              <div className="calendar-controls"><button onClick={() => {
                const earlier = dateOf(timeline[0]); earlier.setDate(earlier.getDate() - 7); setSelected(dayKey(earlier))
                axis.current?.scrollTo({ left: 0 })
              }} aria-label="Pokaż wcześniejszy tydzień">‹</button><button onClick={chooseToday}>Dziś</button><button onClick={() => axis.current?.scrollBy({ left: 290 })} aria-label="Przewiń kalendarz w prawo">›</button></div>
            </div>
            <div className="axis" ref={axis}>{timeline.map(day => {
              const date = dateOf(day)
              const special = log.performances.some(event => event.day === day)
              return <button key={day} aria-current={day === today ? 'date' : undefined} aria-pressed={day === selected}
                aria-label={fullDate.format(date) + (special ? ', występ' : '')}
                className={['day', day < today && 'past', [0, 6].includes(date.getDay()) && 'weekend', day === today && 'today', special && 'performance-day'].filter(Boolean).join(' ')}
                onClick={() => setSelected(day)}><small>{weekdayNames[date.getDay()]}</small><strong>{date.getDate()}</strong>{special && <Gem />}</button>
            })}</div>
          </section>
          <section id="quests" className="panel quests" aria-labelledby="quests-heading">
            <div className="split quest-heading"><div><div className="eyebrow">02 / ZADANIA · {formatDate.format(dateOf(selected))}</div>
              <h2 id="quests-heading">{selected === today ? 'Questy na dziś' : 'Questy tego dnia'}</h2></div>
              <button className="secondary" disabled={!loaded} onClick={() => setModal({ kind: 'add' })}>+ Dodaj</button></div>
            {running && !quests.some(quest => questKey(quest, selected) === running.questKey) && <p className="album-note">Timer działa w innym queście. <button onClick={() => {
              const [id, day] = running.questKey.split('/')
              const quest = log.quests.find(item => item.id === id)
              if (quest) setModal({ kind: 'quest', id: quest.id, day })
            }}>Otwórz timer</button></p>}
            {!quests.length && !events.length && <div className="empty"><span aria-hidden="true">♫</span><h3>{loaded ? 'Plan jest pusty' : 'Wczytuję dziennik…'}</h3><p>{loaded ? 'Dodaj quest lub występ, żeby zaplanować kolejny krok.' : 'Za chwilę pokażę twój plan.'}</p></div>}
            {quests.length > 0 && <p className="album-note">{completed} / {quests.length} ukończonych{completed === quests.length && ' · ✓ Plan dnia ukończony'}</p>}
            {quests.map((quest, index) => {
              const key = questKey(quest, selected)
              const done = key in log.completed
              const title = quest.title || quest.piece
              const canReorder = quests.length > 1
              const activeDrag = drag?.day === selected ? drag : null
              const isTarget = activeDrag?.targetId === quest.id && activeDrag.questId !== quest.id
              const sourceIndex = quests.findIndex(item => item.id === activeDrag?.questId)
              const targetClass = isTarget ? (sourceIndex < index ? ' drop-after' : ' drop-before') : ''

              return <div className={'quest-row' + targetClass} key={key} style={pieceStyle(quest.piece)}
                onDragOver={event => {
                  if (!activeDrag || activeDrag.questId === quest.id) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  if (!isTarget) setDrag({ ...activeDrag, targetId: quest.id })
                }}
                onDragLeave={event => {
                  if (isTarget && !(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
                    setDrag({ ...activeDrag, targetId: undefined })
                  }
                }}
                onDrop={event => {
                  if (!activeDrag) return
                  event.preventDefault()
                  setDrag(null)
                  reorderQuest(activeDrag.questId, quest.id)
                }}>
                <button className="entry" onClick={() => setModal({ kind: 'quest', id: quest.id, day: selected })}>
                  <span className={'entry-icon ' + (done ? 'done' : '')}>{done ? '✓' : '♫'}</span>
                  <span><strong>{title}</strong><small>{title !== quest.piece ? quest.piece + ' · ' : ''}{quest.minutes} min{done ? ' · Ukończony' : running?.questKey === key ? ' · Trwa ćwiczenie' : ''}</small></span>
                  <b>+{done ? log.completed[key] : quest.xp} XP</b>
                </button>
                {canReorder && <span className="quest-grip" draggable aria-hidden="true" title="Przeciągnij, aby zmienić kolejność"
                  onDragStart={event => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', title)
                    const row = event.currentTarget.closest('.quest-row')
                    if (row) event.dataTransfer.setDragImage(row, 16, 16)
                    setDrag({ day: selected, questId: quest.id })
                  }} onDragEnd={() => setDrag(null)}>⠿</span>}
              </div>
            })}
            {events.map(event => <button className="entry event" key={event.id} onClick={() => setModal({ kind: 'event', id: event.id })}>
              <span className="entry-icon"><Gem /></span><span><strong>{event.title}</strong><small>{event.id in log.completed ? 'Ukończony występ' : 'Występ · karta specjalna'}</small></span><b>+{event.xp} XP</b>
            </button>)}
          </section>
        </div>
        <section className="panel album" id="album" aria-labelledby="album-heading">
          <div className="eyebrow">03 / KOLEKCJA</div><h2 id="album-heading">Album kart</h2>
          <div className="album-layout">
            <AlbumRow cards={regularCards} log={log} available={earned} special={false} open={(card, special) => setModal({ kind: 'card', card, special })} reveal={reveal} />
            <AlbumRow cards={specialCards} log={log} available={specials} special open={(card, special) => setModal({ kind: 'card', card, special })} reveal={reveal} />
          </div>
        </section>
      </div>
    </main>
    {modal && <Dialog key={modal.kind} title={modal.kind === 'add' ? 'Dodaj do planu' : modal.kind === 'edit' ? 'Edytuj quest' : modal.kind === 'quest' ? (modalQuest?.title || modalQuest?.piece || 'Quest') :
      modal.kind === 'event' ? currentEvent?.title ?? 'Występ' : modal.kind === 'card' ? modal.card.name : 'Historia praktyki'}
      close={() => { setModal(null); setError('') }}
      cardMode={modal.kind === 'card' ? modal.discovering ? 'discovery' : 'preview' : undefined}
      action={currentQuest && <button onClick={() => setModal({ kind: 'edit', id: currentQuest.quest.id, day: currentQuest.day })}>Edytuj</button>}>
      {error && <p className="error" role="alert">{error}</p>}
      {modal.kind === 'add' && <EntryForm day={selected} suggestions={suggestions} colors={log.pieceColors} save={(entry, color) => void update(state => {
        if ('piece' in entry) {
          state.quests.push(entry)
          setPieceColor(state, entry.piece, color)
        } else state.performances.push(entry)
      }, () => { setSelected('piece' in entry ? entry.start : entry.day); setModal(null); setNotice('✓ Wpis dodany do planu.') })} />}
      {modal.kind === 'edit' && modalQuest && <EntryForm day={modal.day} quest={modalQuest} suggestions={suggestions} colors={log.pieceColors} save={(entry, color) => void update(state => {
        const index = state.quests.findIndex(quest => quest.id === entry.id)
        if (index < 0 || !('piece' in entry)) return
        if (state.timer?.questKey.startsWith(entry.id + '/')) {
          throw new Error('Zatrzymaj timer tego questu przed zapisaniem zmian.')
        }
        state.quests[index] = entry
        setPieceColor(state, entry.piece, color)
      }, () => {
        if ('piece' in entry && !occurs(entry, modal.day)) {
          const date = dateOf(entry.start)
          while (!occurs(entry, dayKey(date))) date.setDate(date.getDate() + 1)
          setSelected(dayKey(date))
        }
        setModal(null)
        setNotice('✓ Zmiany questu zapisane.')
      })} />}
      {currentQuest && <>
        <p className="eyebrow">+{log.completed[currentKey] ?? currentQuest.quest.xp} XP</p>
        {currentQuest.quest.tips && <p className="tips">{currentQuest.quest.tips}</p>}
        <output className="timer" role="timer" aria-label="Pozostały czas">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</output>
        {currentKey in log.completed ? <p className="success">✓ Quest ukończony</p> : <>
          {currentQuest.day > today && <p>Możesz zacząć w dniu questu.</p>}
          {running && running.questKey !== currentKey && <p>Timer działa w innym queście.</p>}
          {remaining > 0 && <button className="primary" disabled={currentQuest.day > today || Boolean(running && running.questKey !== currentKey)}
            onClick={() => toggleTimer(currentQuest.quest, currentQuest.day)}>
            {running?.questKey === currentKey ? 'Ⅱ Zatrzymaj timer' : elapsed(log, currentKey, now) ? '▶ Wznów ćwiczenie' : '▶ Zacznij ćwiczyć'}
          </button>}
          {remaining === 0 && <button className="primary" onClick={() => completeQuest(currentQuest.quest, currentQuest.day)}>✓ Oznacz quest jako ukończony</button>}
        </>}
      </>}
      {currentEvent && <EventDetails key={currentEvent.id} event={currentEvent} today={today} done={currentEvent.id in log.completed}
        save={(rating, comment) => void update(state => {
          const event = state.performances.find(item => item.id === currentEvent.id)
          if (event && event.id in state.completed) Object.assign(event, { rating, comment })
        }, () => { setNotice('✓ Notatka zapisana.'); setModal(null) })}
        complete={() => void update(state => {
          if (currentEvent.day <= dayKey() && !(currentEvent.id in state.completed)) state.completed[currentEvent.id] = currentEvent.xp
        }, () => setNotice('✓ Występ ukończony. Karta specjalna czeka w albumie.'))} />}
      {modal.kind === 'card' && <div className={'card-presentation' + (modal.special ? ' special' : '')}>
        {modal.discovering && <div className="card-back reveal-back" aria-hidden="true">
          <b>{modal.special ? '✦' : '♫'}</b>
        </div>}
        <article className="card-detail">
          <h2 id="dialog-title">{modal.card.name}</h2>
          <div className="card-art">
            <img src={cardUrl(modal.card)} alt={'Ilustracja karty ' + modal.card.name} />
          </div>
          <p className="eyebrow">{modal.card.detail}</p>
          <p>{modal.card.description}</p>
          <a className="reward-link" href={'https://pl.wikipedia.org/wiki/' + encodeURIComponent(modal.card.wiki)} target="_blank" rel="noreferrer">Czytaj w Wikipedii ↗</a>
        </article>
      </div>}
      {modal.kind === 'history' && <>
        <h3>Ćwiczenia według dni</h3>
        {!days.size && <p>Twoje ćwiczenia pojawią się tutaj po uruchomieniu timera.</p>}
        <ul className="history-list">{[...days].sort(([a], [b]) => b.localeCompare(a)).map(([day, duration]) => <li className="split" key={day}><button onClick={() => { setSelected(day); setModal(null) }}>{fullDate.format(dateOf(day))}</button><strong>{minutes(duration)} min</strong></li>)}</ul>
        <h3>Ukończone występy</h3>
        {!specialEarned(log) && <p>Tutaj pojawią się ukończone występy.</p>}
        <ul className="history-list">{log.performances.filter(event => event.id in log.completed).sort((a, b) => b.day.localeCompare(a.day)).map(event => <li key={event.id}>
          <button onClick={() => setModal({ kind: 'event', id: event.id })}>{event.title} · {formatDate.format(dateOf(event.day))}</button>
          {event.rating && <p>Ocena: {event.rating}</p>}{event.comment && <p>{event.comment}</p>}
        </li>)}</ul>
      </>}
    </Dialog>}
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
