import type { MusicCard } from './musicCards'
import { SpotifyCardPlayer } from './SpotifyCardPlayer'

export function MusicCardContent({ card }: { card: MusicCard }) {
  return <article className="card-detail music-card-detail">
    <p className="eyebrow">✦ Karta specjalna · {card.era}</p>
    <h2 id="dialog-title">{card.title}</h2>
    <div className="card-art"><img src={`/art/music/${card.id}.jpg`} alt={card.alt} /></div>
    <p className="music-composer">{card.composer}</p>
    <p className="music-catalogue">{card.catalogue}</p>
    <p className="music-date"><b>{card.date}</b><span>{card.dateNote}</span></p>
    <p>{card.description}</p>
    <p className="music-listen"><strong>Na tropie dźwięków</strong>{card.listenFor}</p>
    <SpotifyCardPlayer key={card.id} cardId={card.id} trackId={card.spotify.split('/').pop()!} performer={card.performer} />
  </article>
}
