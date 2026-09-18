# Seans 0.3.0

Samodzielny prototyp wyboru filmu przez pojedynki dwóch plakatów. Wybrany film pozostaje po tej samej stronie. Wyłączne repozytorium: `KADARstudio/seans`, ID `1376451444`; strona: `docs/`. Nie używać plików, baz, sekretów, hostingu ani automatyzacji innych projektów.

## Zmiany 0.3

- „Widziałem” przełącza oznaczenie, ale nie zmienia pary, faworyta, talii ani liczby decyzji. Domyślnie obejrzane filmy mogą wrócić. Filtry pozwalają wybrać wszystkie / tylko nowe / na powtórkę.
- Ekran startowy, pojedynek i finał dopasowane do dostępnej wysokości telefonu przez `100dvh`. Główne przyciski i przyciski pod plakatami mają co najmniej 44 px. Opisy, zaawansowane filtry, oceny i dodatkowe platformy otwierają osobne panele; historia może się przewijać. Bardzo niskie okna i powiększony tekst mają dostępny przewijany wariant.
- Wyjście karty: 380 ms; wejście: 440 ms; finał: 850 ms. Ustawienie ograniczenia ruchu nadal wyłącza rozbudowane przejścia.
- Oryginalne efekty PCM odtwarzane przez jeden HTMLAudioElement, uruchamiany gestem użytkownika. Dźwięki są domyślnie wyłączone. Test dźwięku w panelu filtrów. Tam, gdzie API jest dostępne, po świadomym włączeniu ustawiany jest kanał audio `playback`; wyłączenie zwalnia go. Obsługa błędów `play()` nie blokuje pojedynku. Testy sprawdzają faktyczny postęp czasu odtwarzania, a nie tylko wywołanie funkcji. Nadal wymagany jest odbiór na fizycznym iPhonie, z jego głośnością, trybem cichym i słuchawkami.
- Wielomegabajtowy katalog jest zapisywany w IndexedDB jako datowana kopia awaryjna. Historia pozostaje lokalna i kompatybilna. Pojedyncza sesja losuje 150–301 kandydatów z całej pasującej bazy, zamiast ograniczać pobieranie do 100 filmów na platformę.

## Katalog

JustWatch, Polska, wyłącznie abonamenty FLATRATE sześciu wybranych platform. Pobieranie wszystkich stron, a w dużych katalogach rozłącznych zakresów roku premiery (łącznie z rokiem 0 używanym dla części filmów bez daty). Raport `coverage` porównuje pobrane unikalne rekordy z liczbami raportowanymi przez źródło. Niepełnego pobrania nie przedstawiamy jako kompletnego. Nawet zgodne liczby nie są gwarancją, że JustWatch odzwierciedla każdą ofertę platformy w danej chwili.

Po publikacji 0.3 workflow planuje pobieranie co sześć godzin. Nieudane pobranie zachowuje wcześniejszą kopię i jej datę. Przed komercyjnym wydaniem potrzebna jest właściwa licencja i wspierane API. Aplikacja nie loguje się na konta platform.

## Testy i uruchomienie

`npm test` — testy logiki i obsługi błędów dźwięku. `npm run check` — kontrola tożsamości projektu. `python3 -m http.server 8080 --directory docs` — lokalny serwer.

Testy Chromium i WebKit: `python3 tests/mobile.py` po instalacji `playwright==1.57.0` i obu silników. Zmienna `SEANS_PUBLIC_URL` dodaje test rzeczywistej strony do testu lokalnego. Raport `test-results/browser-report.json` jawnie rozdziela local/public oraz zaznacza brak testu fizycznego urządzenia.

Podgląd po publikacji main: https://raw.githack.com/KADARstudio/seans/main/docs/index.html

Hosting może pokazać własny przycisk „Open the page”. Samo zapisanie źródeł nie jest potwierdzeniem działania linku; wymagany jest test publicznego adresu.

## GitHub Pages

Przygotowany workflow publikuje `docs/`, gdy w tym repozytorium właściciel wybierze Settings → Pages → Source → GitHub Actions. Nie twórz drugiego workflow. Brak włączonego Pages nie zmienia działającego podglądu testowego, ale oznacza brak publikacji na github.io. Manifest pozwala otwierać dodaną do ekranu głównego stronę jako samodzielny widok; nie jest to wydanie App Store i nie deklarujemy pełnego działania offline.
