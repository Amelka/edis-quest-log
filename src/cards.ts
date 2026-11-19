import { musicCards } from './musicCards'
import type { MusicCard } from './musicCards'

export type Card = {
  id: string
  name: string
  detail: string
  description: string
  wiki: string
  image?: string
  music?: MusicCard
}

export const regularCards: Card[] = [
  { id: 'forte', name: 'Forte', detail: 'Dynamika · f', description: 'Gdy w nutach widzisz f, zagraj głośno. Forte to wielki górski stworek, którego głos słychać w całej dolinie.', wiki: 'Dynamika_(muzyka)' },
  { id: 'piano', name: 'Piano', detail: 'Dynamika · p', description: 'Piano to znak, że masz grać cicho. Wyobraź sobie, że twoje palce stąpają tak lekko jak ten królik po mchu.', wiki: 'Dynamika_(muzyka)' },
  { id: 'staccato', name: 'Staccato', detail: 'Artykulacja · krótkie dźwięki', description: 'Kropka nad nutą lub pod nią może oznaczać staccato. Skróć dźwięk i pozwól mu odskoczyć jak małemu sprężynowemu stworkowi.', wiki: 'Staccato' },
  { id: 'legato', name: 'Legato', detail: 'Artykulacja · płynne dźwięki', description: 'Legato łączy kolejne dźwięki płynnie. Zagraj melodię tak, jakby jej nuty były jedną długą wstęgą.', wiki: 'Legato' },
  { id: 'crescendo', name: 'Crescendo', detail: 'Dynamika · coraz głośniej', description: 'Crescendo mówi, żeby stopniowo grać coraz głośniej. Zacznij od małego kiełka, a potem pozwól dźwiękom urosnąć.', wiki: 'Dynamika_(muzyka)' },
  { id: 'adagio', name: 'Adagio', detail: 'Tempo · powoli', description: 'Adagio oznacza wolne tempo. Ten księżycowy stworek nigdzie się nie spieszy, ale idzie równym krokiem.', wiki: 'Tempo_(muzyka)' },
  { id: 'diminuendo', name: 'Diminuendo', detail: 'Dynamika · coraz ciszej', description: 'Diminuendo mówi, żeby stopniowo grać coraz ciszej. Pomyśl o kręgach na wodzie: im dalej od łapki aksolotla, tym słabiej je widać.', wiki: 'Dynamika_(muzyka)' },
  { id: 'allegro', name: 'Allegro', detail: 'Tempo · szybko i żwawo', description: 'Allegro oznacza szybkie, żwawe tempo. Wyobraź sobie lisa, który mknie po ścieżce i stawia łapy w równym rytmie.', wiki: 'Tempo_(muzyka)' },
  { id: 'fermata', name: 'Fermata', detail: 'Zapis nutowy · dłuższy dźwięk lub pauza', description: 'Fermata nad nutą pozwala potrzymać dźwięk dłużej, a nad pauzą wydłuża ciszę. To jak chwila, w której miodowy slime zawisa nad skałą, zanim ruszy dalej.', wiki: 'Fermata' },
  { id: 'arpeggio', name: 'Arpeggio', detail: 'Technika · dźwięki akordu po kolei', description: 'Przy arpeggio dźwięki akordu brzmią jeden po drugim. Zagraj kolejno do, mi i sol, tak jak trzy slime’y podskakują coraz wyżej po schodach.', wiki: 'Arpeggio' },
  { id: 'glissando', name: 'Glissando', detail: 'Technika · ślizg po dźwiękach', description: 'Glissando to płynny ślizg przez kolejne dźwięki w górę lub w dół. Na fortepianie słychać wtedy serię klawiszy, jakby dźwięki zjeżdżały po wodnej zjeżdżalni.', wiki: 'Glissando' },
  { id: 'ostinato', name: 'Ostinato', detail: 'Budowa utworu · powtarzany motyw', description: 'Ostinato to krótki motyw, który powtarza się w utworze. Żółw wybija wciąż ten sam rytm. Na pianinie lewa ręka może tak samo powtarzać swój wzór, gdy prawa gra melodię.', wiki: 'Ostinato' },
  { id: 'ritardando', name: 'Ritardando', detail: 'Tempo · coraz wolniej', description: 'Gdy widzisz rit., stopniowo zwalniaj. Wyobraź sobie, że jedziesz po taśmociągu w spiralnej muszli i powoli wytracasz rozpęd.', wiki: 'Tempo_(muzyka)' },
  { id: 'accelerando', name: 'Accelerando', detail: 'Tempo · coraz szybciej', description: 'Gdy widzisz accel., stopniowo przyspieszaj. Wyobraź sobie, że nabierasz rozpędu na rampie, żeby wystrzelić w kosmos.', wiki: 'Tempo_(muzyka)' },
  { id: 'sforzando', name: 'Sforzando', detail: 'Dynamika · mocny akcent', description: 'Gdy widzisz sfz, zagraj oznaczoną nutę lub akord z nagłym, mocnym akcentem. Wyobraź sobie, że skaczesz na bęben i wydobywasz z niego jedno potężne bum!', wiki: 'Dynamika_(muzyka)' },
  { id: 'tenuto', name: 'Tenuto', detail: 'Artykulacja · pełna długość nuty', description: 'Gdy widzisz kreskę tenuto nad nutą lub pod nią, przytrzymaj dźwięk przez całą zapisaną długość. Wyobraź sobie, że rozciągasz swój sprężysty ogon między dwoma kołkami i trzymasz go do końca odliczania.', wiki: 'Tenuto' },
  { id: 'pauza', name: 'Pauza', detail: 'Zapis nutowy · chwila ciszy', description: 'Gdy widzisz pauzę, przez wskazany czas zachowaj ciszę i licz dalej w myślach. Wyobraź sobie, że siedzisz nieruchomo w bańce i czekasz na moment, kiedy znów możesz się ruszyć.', wiki: 'Pauza_(muzyka)' },
  { id: 'tryl', name: 'Tryl', detail: 'Ozdobnik · dwa dźwięki na zmianę', description: 'Gdy grasz tryl, szybko przechodź z jednego dźwięku na sąsiedni i z powrotem. Wyobraź sobie, że przeskakujesz między dwoma klawiszami, raz na jeden, raz na drugi.', wiki: 'Tryl' },
]

// Stable reward-slot IDs preserve already discovered cards and their order.
// The musical content has its own ID, used for artwork and Spotify callbacks.
const specialRewardIds = ['beethoven', 'liszt', 'bach', 'tekla', 'mozart', 'chopin']
export const specialCards: Card[] = musicCards.map((music, index) => ({
  id: specialRewardIds[index],
  name: music.title,
  detail: `${music.composer} · ${music.date}`,
  description: music.description,
  wiki: '',
  image: `/art/music/${music.id}.jpg`,
  music,
}))
