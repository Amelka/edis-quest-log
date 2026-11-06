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
]

export const specialCards: Card[] = [
  { id: 'chopin', name: 'Fryderyk Chopin', detail: '1810–1849 · Polska i Francja', description: 'Dorastał w Warszawie i przez wiele lat mieszkał w Paryżu. Posłuchaj Nokturnu Es-dur op. 9 nr 2 i Etiudy „Rewolucyjnej”. Jako dziecko komponował już polonezy.', wiki: 'Fryderyk_Chopin' },
  { id: 'bach', name: 'Johann Sebastian Bach', detail: '1685–1750 · Niemcy', description: 'Pracował m.in. w Weimarze i Lipsku. Napisał Koncerty brandenburskie i zbiór Das Wohltemperierte Klavier. Był także organistą i miał dużą muzykalną rodzinę.', wiki: 'Johann_Sebastian_Bach' },
  { id: 'mozart', name: 'Wolfgang Amadeus Mozart', detail: '1756–1791 · Austria', description: 'Dorastał w Salzburgu i mieszkał w Wiedniu. Skomponował Czarodziejski flet i Eine kleine Nachtmusik. Jako dziecko koncertował w Europie razem z siostrą.', wiki: 'Wolfgang_Amadeus_Mozart' },
  { id: 'beethoven', name: 'Ludwig van Beethoven', detail: '1770–1827 · Niemcy i Austria', description: 'Urodził się w Bonn, a większość dorosłego życia spędził w Wiedniu. Napisał Sonatę „Księżycową” i IX Symfonię. Komponował także wtedy, gdy niemal całkowicie stracił słuch.', wiki: 'Ludwig_van_Beethoven' },
  { id: 'clara', name: 'Clara Schumann', detail: '1819–1896 · Niemcy', description: 'Dorastała w Lipsku i uczyła gry na fortepianie we Frankfurcie nad Menem. Napisała Koncert fortepianowy a-moll i Trio fortepianowe g-moll. Swoją karierę koncertową rozpoczęła jako dziecko.', wiki: 'Clara_Schumann' },
  { id: 'debussy', name: 'Claude Debussy', detail: '1862–1918 · Francja', description: 'Studiował i mieszkał w Paryżu. Napisał Clair de lune oraz La Mer. Do paryskiego konserwatorium przyjęto go, gdy miał dziesięć lat.', wiki: 'Claude_Debussy' },
]
