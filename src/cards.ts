export type Card = {
  id: string
  name: string
  detail: string
  description: string
  wiki: string
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
]

export const specialCards: Card[] = [
  { id: 'beethoven', name: 'Ludwig van Beethoven', detail: '1770–1827 · Niemcy i Austria', description: 'Urodził się w Bonn, a większość dorosłego życia spędził w Wiedniu. Napisał Sonatę „Księżycową” i IX Symfonię. Komponował także wtedy, gdy niemal całkowicie stracił słuch.', wiki: 'Ludwig_van_Beethoven' },
  { id: 'liszt', name: 'Franz Liszt', detail: '1811–1886 · Węgry', description: 'Węgierski pianista i kompozytor, który koncertował w całej Europie. Posłuchaj jego II Rapsodii węgierskiej i Sonaty h-moll. W Budapeszcie został pierwszym prezesem akademii muzycznej, która dziś nosi jego imię.', wiki: 'Ferenc_Liszt' },
  { id: 'bach', name: 'Johann Sebastian Bach', detail: '1685–1750 · Niemcy', description: 'Pracował m.in. w Weimarze i Lipsku. Napisał Koncerty brandenburskie i zbiór Das Wohltemperierte Klavier. Był także organistą i miał dużą muzykalną rodzinę.', wiki: 'Johann_Sebastian_Bach' },
  { id: 'tekla', name: 'Tekla Bądarzewska-Baranowska', detail: '1823–1861 · Polska', description: 'Warszawska kompozytorka, która pisała krótkie utwory na fortepian. Jej „Modlitwę dziewicy” wydawano nawet w Stanach Zjednoczonych i Australii. Posłuchaj też jej mazura „Słodkie marzenie”.', wiki: 'Tekla_Bądarzewska-Baranowska' },
  { id: 'mozart', name: 'Wolfgang Amadeus Mozart', detail: '1756–1791 · Austria', description: 'Dorastał w Salzburgu i mieszkał w Wiedniu. Skomponował Czarodziejski flet i Eine kleine Nachtmusik. Jako dziecko koncertował w Europie razem z siostrą.', wiki: 'Wolfgang_Amadeus_Mozart' },
  { id: 'chopin', name: 'Fryderyk Chopin', detail: '1810–1849 · Polska i Francja', description: 'Dorastał w Warszawie i przez wiele lat mieszkał w Paryżu. Posłuchaj Nokturnu Es-dur op. 9 nr 2 i Etiudy „Rewolucyjnej”. Jako dziecko komponował już polonezy.', wiki: 'Fryderyk_Chopin' },
]
