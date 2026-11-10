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
http://localhost:5174. Używa ona oddzielnego zapisu w przeglądarce, dzięki
czemu testowe wpisy nie trafiają do właściwego dziennika.

Ilustracje Forte i Chopina pochodzą z moodboardu Pikselowa gildia v2. Licencje fontów znajdują się w katalogu `public/art`.

## Testy

Po instalacji zależności przez `npm ci` uruchom testy logiki i API poleceniem
`npm test`. Testy API wymagają `python3`.

Przed pierwszym uruchomieniem testów przeglądarkowych zainstaluj Chromium
poleceniem `npx playwright install chromium`. Następnie uruchom
`npm run test:e2e`. Polecenie buduje aplikację i sprawdza ją na lokalnym
serwerze Python. Testy zapisu używają osobnych katalogów tymczasowych.
