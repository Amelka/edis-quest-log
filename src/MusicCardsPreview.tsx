import { useEffect, useRef, useState } from 'react'
import { musicCards } from './musicCards'
import { hasSpotifySession, spotifyClientId } from './spotifyAuth'
import { MusicCardContent } from './MusicCardContent'
import { activateSpotify, prepareSpotify, disposeSpotify } from './spotifyPlayer'

export function requestedMusicCard() {
  return musicCards.find(card => card.id === new URLSearchParams(location.search).get('music-card')) || null
}
export function MusicCardsPreview() {
  const [selected, setSelected] = useState(requestedMusicCard)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (selected) dialog.current?.showModal()
    else {
      dialog.current?.close(); trigger.current?.focus()
      // Prepare while browsing, so opening the next card can activate audio in its click handler.
      if (spotifyClientId && hasSpotifySession()) void prepareSpotify().catch(() => {})
    }
  }, [selected])
  useEffect(() => () => disposeSpotify(), [])
  function close() {
    setSelected(null)
    const url = new URL(location.href)
    url.searchParams.delete('music-card')
    history.replaceState(null, '', url.pathname + url.search)
  }
  return <main className="wrap music-preview">
    <header><p className="eyebrow">Edi’s Quest Log · Podgląd kart specjalnych</p><h1>Fortepianowe odkrycia</h1><p>Kliknij kartę, aby ją otworzyć i posłuchać muzyki.</p></header>
    <div className="music-preview-grid">{musicCards.map(card => <button key={card.id} onClick={event => { trigger.current = event.currentTarget; activateSpotify(); setSelected(card) }}>
      <img src={`/art/music/${card.id}.jpg`} alt="" /><span>{card.title}</span><small>{card.composer}</small>
    </button>)}</div>
    <dialog className="card-dialog preview music-dialog" ref={dialog} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); close() }}>
      <div className="dialog-head"><div className="dialog-actions"><button className="icon" autoFocus aria-label="Zamknij" onClick={close}>×</button></div></div>
      {selected && <div className="card-presentation special"><MusicCardContent card={selected} /></div>}
    </dialog>
  </main>
}
