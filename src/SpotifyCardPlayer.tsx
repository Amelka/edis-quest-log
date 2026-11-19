import { useEffect, useState } from 'react'
import { connectSpotify, hasSpotifySession, spotifyClientId, spotifyLoginError } from './spotifyAuth'
import { currentSpotifyState, disconnectSpotify, listenSpotify, pauseSpotify, playSpotify, resumeSpotify, seekSpotify, stopSpotify } from './spotifyPlayer'
import type { Playback } from './spotifyPlayer'
const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export function SpotifyCardPlayer({ cardId, trackId, performer }: { cardId: string; trackId: string; performer: string }) {
  const [connected, setConnected] = useState(hasSpotifySession)
  const [state, setState] = useState<Playback | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(spotifyLoginError)
  const [started, setStarted] = useState(false)
  const uri = `spotify:track:${trackId}`
  const matching = state?.track_window.current_track.uri === uri ? state : null
  const track = matching?.track_window.current_track
  const paused = matching?.paused ?? true

  useEffect(() => {
    if (!connected || !spotifyClientId) return
    let live = true
    const report = (message: string) => { if (live) { setError(message); setBusy(false); setConnected(hasSpotifySession()) } }
    const unlisten = listenSpotify(next => {
      if (!live || !next || next.track_window.current_track.uri !== uri) return
      setState({ ...next }); setBusy(false); setStarted(true); setError('')
    }, report)
    setBusy(true)
    void playSpotify(trackId).then(() => { if (live) setBusy(false) }).catch(error => report(error.message))
    const interval = window.setInterval(() => {
      void currentSpotifyState().then(next => { if (live && next?.track_window.current_track.uri === uri) setState({ ...next }) }).catch(() => {})
    }, 1000)
    return () => { live = false; clearInterval(interval); unlisten(); stopSpotify() }
  }, [connected, trackId, uri])

  async function toggle() {
    setError('')
    setBusy(true)
    try {
      if (!started || !matching) await playSpotify(trackId)
      else if (paused) await resumeSpotify()
      else await pauseSpotify()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Nie udało się odtworzyć nagrania.')
      setConnected(hasSpotifySession())
    } finally { setBusy(false) }
  }
  return <section className="spotify-player" aria-label="Odtwarzacz Spotify">
    <div className="spotify-player-heading"><strong>Spotify</strong><span>Fortepian · {performer}</span></div>
    {!spotifyClientId ? <p className="spotify-message">Odtwarzacz czeka na konfigurację połączenia Spotify.</p> : !connected ? <>
      <p className="spotify-message">Połącz Spotify Premium, aby słuchać bezpośrednio na karcie.</p>
      <button className="spotify-connect" onClick={() => { setError(''); void connectSpotify(cardId).catch(error => setError(error.message)) }}>Połącz Spotify Premium</button>
    </> : <>
      {track && <div className="spotify-now-playing">{track.album.images[0] && <img src={track.album.images[0].url} alt="Okładka nagrania" />}<div><strong>{track.name}</strong><small>{track.artists.map(a => a.name).join(', ')}</small></div></div>}
      <div className="spotify-controls"><button onClick={() => void toggle()} disabled={busy} aria-label={paused ? 'Odtwórz' : 'Pauza'}>{busy ? 'Łączenie…' : paused ? '▶ Odtwórz' : 'Ⅱ Pauza'}</button><span>{time(matching?.position || 0)} / {time(matching?.duration || 0)}</span></div>
      <input type="range" aria-label="Pozycja nagrania" min="0" step="1000" max={matching?.duration || 1} value={matching?.position || 0} disabled={!matching || busy}
        onChange={event => { const value = Number(event.target.value); setState(previous => previous ? { ...previous, position: value } : null); void seekSpotify(value).catch(() => setError('Nie udało się przewinąć nagrania.')) }} />
      <button className="spotify-disconnect" onClick={() => { disconnectSpotify(); setConnected(false); setState(null); setStarted(false); setError('') }}>Odłącz konto</button>
    </>}
    {error && <p className="spotify-message" role="status">{error}</p>}
    <a className="reward-link spotify-external" href={`https://open.spotify.com/track/${trackId}`} target="_blank" rel="noopener noreferrer">Posłuchaj w Spotify ↗</a>
  </section>
}
