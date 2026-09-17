# Plan lekcji

Wspólny plan tygodnia po polsku. Frontend jest publikowany na GitHub Pages, API działa w Sites z trwałą bazą D1. Dane planu, PIN oraz token podglądu nie trafiają do repozytorium ani do statycznego frontendu.

## Korzystanie

Otwórz prywatny link. „Edytuj plan” odblokowuje zmiany PIN-em na godzinę. Można zmieniać nazwy, dni, godziny i notatki, dodawać lub usuwać zajęcia oraz przeciągać je między dniami. Na telefonie w pionie cały tydzień pokazuje wszystkie dni jeden pod drugim; w poziomie (od 600 px szerokości) pięć dni mieści się w jednym wierszu; przyciski dni przewijają do wybranego dnia. Widok „Dzisiaj” nadal pokazuje pojedynczy dzień. Po odblokowaniu PIN-em można wpisać osobno „Kto odprowadza” i „Kto odbiera” dla każdego dnia oraz osobno dla każdej pozycji „Po lekcjach” (od 16:30). Kopię JSON można pobrać i wczytać po odblokowaniu edycji. Zmiany odświeżają się co 15 sekund; zapis od razu trafia do wspólnej bazy.

„?” oznacza niepewny odczyt ze zdjęcia. Wpis „Kangur” przypomina o cyklu co dwa tygodnie; nie filtruje tygodni, dopóki nie zostanie ustalona pierwsza data. Plan nie uwzględnia automatycznie świąt i wakacji.

## Uruchomienie lokalne

Node 24 lub nowszy. Przygotuj prywatny `private/seed.json` zgodny z walidacją, następnie `npm run init` i `npm start`. Adres oraz wygenerowany PIN znajdują się w `private/dostep.json`. Nie dodawaj folderu `private` do Git. Lokalny serwer nasłuchuje domyślnie tylko na 127.0.0.1:8787. `DATA_DIR`, `HOST`, `PORT` pozwalają zmienić lokalizację danych i nasłuch.

`npm test` sprawdza odmowę dostępu bez tokenu, PIN, blokadę prób, sesje, zapis, konflikty wersji, walidację godzin oraz zapis, zachowanie i usuwanie osób odprowadzających. `npx drizzle-kit generate` generuje migracje po zmianach schematu. `npm run build` przygotowuje Worker i migracje. Produkcja nie używa serwera Node ani lokalnej bazy SQLite.

## Produkcja i prywatność

- `public/config.js`: adres API; publikuj wyłącznie folder `public` na GitHub Pages.
- Worker: `worker.mjs`, wspólna walidacja: `validate.mjs`, schemat: `db/schema.ts`, migracje: `drizzle/`.
- Tajna zmienna Sites `PLAN_CONFIG` zawiera `viewHash`, `pinSalt`, `pinHash`, `origins`. Produkcyjny PIN jest haszowany PBKDF2-SHA256 (100 000 iteracji); lokalny serwer używa scrypt.
- Token podglądu ma 256 bitów losowości, w linku jest po `#`, a do API trafia w nagłówku Authorization. PIN nigdy nie znajduje się w linku. Sesja edycji jest trzymana tylko w pamięci strony; baza przechowuje jej hash. Obowiązuje globalny limit pięciu prób PIN-u na 15 minut dla planu, niezależny od adresu IP.
- Dane w kolumnie JSON zachowują starszy format tablicy zajęć przy odczycie. Nowe zapisy używają obiektu `{events, dayEscorts, dayPickups}`. Brak nowych pól w żądaniu starszego klienta zachowuje istniejące wpisy; jawny pusty tekst je usuwa. Kopie JSON obejmują nowe pola.
- Aktualizacje wymagają aktualnego numeru wersji, aby uniknąć utraty zmian drugiej osoby. Pierwszy zapis z wersją 0 może utworzyć plan tylko raz i również wymaga sesji edycji.
- Brak zewnętrznych fontów, analityki, metadanych planu i sitemap. HTML zawiera noindex; API wysyła no-store i X-Robots-Tag. robots.txt to dodatkowa wskazówka dla robotów, nie mechanizm kontroli dostępu. Token stanowi rzeczywistą kontrolę dostępu do danych. Osoba mająca pełny link może go przekazać dalej, także botowi.
- Twórz okresowe kopie przez „Pobierz kopię”. Przy wycieku linku wygeneruj nowy token, podmień `viewHash` w Sites i wdroż ponownie. Przy zmianie PIN-u podmień salt/hash, usuń aktywne sesje w bazie i wdroż ponownie. Nie umieszczaj sekretów w kodzie, historii Git ani logach.

Dokumentacja platform: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [SQLite w Node](https://nodejs.org/api/sqlite.html).
