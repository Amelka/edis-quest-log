# Edi’s Quest Log

Lokalny dziennik ćwiczeń fortepianowych z questami, timerem, XP i albumem kart.

Na Macu otwórz w Finderze plik **Uruchom dziennik.command**. Otworzy się przeglądarka. Zostaw okno serwera otwarte podczas ćwiczeń. Ten sposób uruchamia gotowy build z folderu `dist/` za pomocą Pythona 3.

Do pracy nad kodem potrzebujesz Node.js 22 i npm. W katalogu projektu uruchom:

```sh
npm ci
npm run dev
```

Otwórz http://localhost:5173. Używaj tego samego adresu i profilu przeglądarki, aby wracać do swojej historii. Dane są zapisywane w IndexedDB. Wyczyszczenie danych tej witryny usuwa historię.

Polecenie `npm run build` sprawdza typy i tworzy gotową wersję w `dist/`. Możesz ją uruchomić przez `npm run preview` po zatrzymaniu serwera deweloperskiego.

Ilustracje Forte i Chopina pochodzą z moodboardu Pikselowa gildia v2. Licencje fontów znajdują się w katalogu `public/art`.
