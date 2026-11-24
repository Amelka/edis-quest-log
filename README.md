# Edi’s Quest Log

Lokalny dziennik ćwiczeń fortepianowych z questami, timerem, XP i albumem kart.

Na Macu otwórz w Finderze plik **Edi's Quest Log.command**. Otworzy się przeglądarka. Zostaw okno serwera otwarte podczas ćwiczeń. Ten sposób uruchamia gotowy build z folderu `dist/` za pomocą Pythona 3.

Przy pierwszym uruchomieniu z Terminala ustaw osobne hasła dla kont
`Edi` i `Mama`. Terminal nie pokazuje wpisywanych znaków. Potem zaloguj się
w przeglądarce nazwą konta i wybranym hasłem. Oba konta korzystają z profilu
Ediego i mają te same funkcje. Ponowne uruchomienie serwera kończy sesje.

Dziennik zapisuje questy, XP i historię ćwiczeń w pliku `.journal/journal.json`
we współdzielonym folderze aplikacji. Konta Amelia i Edi mają dostęp do
tego samego zapisu, także z różnych przeglądarek. Plik
`journal.previous.json` obok dziennika zawiera poprzedni zapis (po pierwszym
zapisie zawiera jego kopię). Możesz objąć ten folder kopią Time Machine.

Adres otwiera się automatycznie i może być inny na każdym koncie.

Do pracy nad kodem potrzebujesz Node.js 22 i npm. W katalogu projektu uruchom
`npm ci`, a potem `npm run build`, aby sprawdzić typy i zbudować gotową
wersję. Uruchom ją dwuklikiem lub przez `npm run preview`.

`npm run dev` otwiera osobną wersję deweloperską pod adresem
http://127.0.0.1:5174. Używa ona oddzielnego zapisu w przeglądarce, dzięki
czemu testowe wpisy nie trafiają do właściwego dziennika.

Ilustracje Forte i Chopina pochodzą z moodboardu Pikselowa gildia v2. Licencje fontów znajdują się w katalogu `public/art`.

## Testy

Po instalacji zależności przez `npm ci` uruchom testy logiki i API poleceniem
`npm test`. Testy API wymagają `python3`.

Przed pierwszym uruchomieniem testów przeglądarkowych zainstaluj Chromium
poleceniem `npx playwright install chromium`. Następnie uruchom
`npm run test:e2e`. Polecenie buduje aplikację i sprawdza ją na lokalnym
serwerze Python. Testy zapisu używają osobnych katalogów tymczasowych.

### Wersja online

Vercel buduje aplikację przez `npm run build`. Funkcje pod `/api` używają
`DATABASE_URL` z integracji Neon. Zmienne systemowe Vercel określają dozwolone
adresy wdrożeń. Przy własnej domenie ustaw `JOURNAL_HOST` na jej nazwę bez
protokołu. Dane logowania i pliki dziennika nie należą do repozytorium.

Przed przełączeniem zamknij lokalny dziennik, aby nikt nie dopisywał danych.
W środowisku z ustawionym `DATABASE_URL` do pustej bazy zainstaluj pakiety
z `requirements.txt` i uruchom `python3 -B scripts/import_neon.py`. Skrypt
tworzy lokalną kopię, przenosi oba istniejące loginy oraz bieżący i poprzedni
zapis, a następnie porównuje zapisane bajty. Odmawia nadpisania innej historii.
Testy zapisu uruchamiaj z osobną bazą. Po przełączeniu korzystaj z wersji
online, żeby uniknąć równoległych historii.

## Karty fortepianowe i Spotify

Podgląd sześciu nowych kart w modalach: `http://127.0.0.1:5174/?preview=special-cards`.
Sześć kart utworów zastępuje kolekcję kompozytorów w albumie aplikacji.
Dotychczasowe identyfikatory miejsc w kolekcji pozostają zachowane: odkryte
karty zachowują pozycję i liczbę, a pozostałe odkrywa się za występy jak wcześniej.
Podgląd umożliwia obejrzenie wszystkich sześciu kart bez zmiany dziennika.

Odtwarzanie na karcie używa Spotify Web Playback SDK i konta Spotify Premium.
Utwór uruchamia się przy otwarciu karty po połączeniu konta. Jeśli przeglądarka
zablokuje automatyczny start, użyj „Odtwórz”. Zamknięcie modala zatrzymuje
odtwarzanie. Urządzenie pozostaje połączone do zamknięcia podglądu lub odłączenia konta. Link „Posłuchaj w Spotify” działa niezależnie.

1. Utwórz aplikację w https://developer.spotify.com/dashboard (Web API i Web Playback SDK).
2. W Settings dodaj Redirect URI `http://127.0.0.1:5174/`. W User Management
   dodaj konto, które będzie słuchało, jeśli wymaga tego tryb deweloperski.
3. Utwórz `.env.local` na podstawie `.env.example` i wpisz publiczny Client ID.
   Client Secret nie jest używany ani umieszczany w przeglądarce.
4. Uruchom ponownie Vite i otwórz podgląd przez `127.0.0.1`, nie `localhost`.
   Wybierz kartę i „Połącz Spotify Premium”. Zgoda obejmuje streaming oraz
   sterowanie odtwarzaniem; uruchomienie muzyki może przenieść odtwarzanie
   z innego urządzenia Spotify do tej przeglądarki.

Logowanie korzysta z Authorization Code PKCE (S256), jednorazowego `state`
i odświeżania tokenów. Tokeny są w `sessionStorage` tej karty przeglądarki;
„Odłącz konto” je usuwa. Nie są zapisywane w dzienniku ani przesyłane do jego API.
Dla wdrożenia ustaw `VITE_SPOTIFY_REDIRECT_URI` na dokładny adres HTTPS
zarejestrowany w Spotify. Lokalny launcher używa zmiennego portu, więc do testów
Spotify używaj stałego portu Vite. Pełny streaming wymaga ręcznej próby po połączeniu konta Premium;
testy automatyczne używają atrapy SDK.

## Osobne konta online

Konta `tola` i `mateusz` korzystają z osobnych dzienników, początkowo pustych.
Konta `edi` i `mama` nadal współdzielą dotychczasowy dziennik Ediego.
Hasła są przechowywane wyłącznie jako skróty PBKDF2 z osobnymi solami.

Po ustawieniu produkcyjnego `DATABASE_URL` w środowisku i instalacji
`requirements.txt` uruchom `python3 -B scripts/add_personal_accounts.py`.
Skrypt pyta o hasła bez wyświetlania znaków, rozszerza schemat i tworzy konta
w jednej transakcji. Nie nadpisuje istniejących haseł ani dzienników.
Następnie wdróż wersję aplikacji obsługującą osobne dzienniki.
Plik `.env.local` nie jest automatycznie ładowany przez skrypty Pythona.
