# Seans 0.2.1

Samodzielny prototyp wyboru filmu przez pojedynki dwóch plakatów. Wybrany film zostaje po tej samej stronie. Animacje, opcjonalny dźwięk, historia, oceny i statystyki decyzji. Dane użytkownika tylko lokalnie. Brak logowania, monetyzacji i własnej analityki.

## Izolacja

Wyłączne repozytorium: `KADARstudio/seans`, ID `1376451444`. Strona w `docs/`. Nie ma zależności od innych projektów KADARstudio ani operacji na ich serwerach lub bazach.

## Uruchomienie

`python3 -m http.server 8080 --directory docs` i otwórz `http://localhost:8080`. Testy: `npm test`. Kontrola granic projektu: `npm run check`.

Podgląd testowy: https://raw.githack.com/KADARstudio/seans/main/docs/index.html

Hosting podglądu może wyświetlić własne potwierdzenie „Open the page”. Zgodność i dostępność podglądu są sprawdzane oddzielnie od lokalnych testów przeglądarkowych.

## Katalog

Źródłem ofert jest JustWatch, Polska, wyłącznie abonamenty FLATRATE. Prototyp używa ograniczonej próbki do 100 popularnych filmów na platformę, nie pełnych katalogów. Workflow planuje odświeżanie raz na godzinę. Dane są zapisywane dopiero po walidacji; nieudany odczyt nie zmienia daty starej kopii. Harmonogram może być opóźniony. Interfejs pokazuje datę danych i ostrzega o starszej kopii. Nie gwarantujemy bieżącej dostępności tytułu. Integracja testowa jest nieoficjalna: przed komercyjnym wydaniem potrzebna jest właściwa licencja i wspierany interfejs. Nie używamy kont użytkowników platform.

## Docelowy hosting GitHub Pages

Przygotowany workflow sam publikuje stronę, kiedy właściciel jednorazowo włączy w tym repozytorium **Settings → Pages → Build and deployment → Source → GitHub Actions**. W tym wariancie nie wybieraj „Deploy from a branch” i nie twórz drugiego pliku workflow. Następny przebieg istniejącego workflow publikuje katalog `docs/` po testach. Można go uruchomić z zakładki Actions przyciskiem „Run workflow”. Nie uruchamiaj tych zadań w innym repozytorium.

Sam zapis źródeł lub zielony wynik testów lokalnych nie jest potwierdzeniem działania publicznej strony. Raport `test-results/browser-report.json` oddziela kontrole `local` i `public`. Opcjonalny błąd podglądu nie unieważnia lokalnych testów, ale oznacza brak potwierdzonego podglądu w tym przebiegu. Testy Chromium i WebKit nie zastępują testu na fizycznym telefonie.
