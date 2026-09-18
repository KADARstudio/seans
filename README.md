# Seans 0.2.1

Samodzielny prototyp wyboru filmu przez pojedynki dwóch plakatów. Wybrany film zostaje po tej samej stronie. Animacje, opcjonalny dźwięk, historia, oceny i statystyki decyzji. Dane użytkownika tylko lokalnie. Brak logowania, monetyzacji i analityki.

## Izolacja

Wyłączne repozytorium: `KADARstudio/seans`, ID `1376451444`. Strona w `docs/`. Nie ma zależności od innych projektów KADARstudio ani operacji na ich serwerach lub bazach.

## Uruchomienie

`python3 -m http.server 8080 --directory docs` i otwórz `http://localhost:8080`. Testy: `npm test`. Kontrola granic projektu: `npm run check`.

## Katalog

Źródłem ofert jest JustWatch, Polska, wyłącznie abonamenty FLATRATE. Prototyp używa ograniczonej próbki do 100 popularnych filmów na platformę, nie pełnych katalogów. Interfejs pokazuje datę danych i ostrzega o starszej kopii. Nie gwarantujemy bieżącej dostępności tytułu. Integracja testowa jest nieoficjalna: przed komercyjnym wydaniem potrzebna jest właściwa licencja i wspierany interfejs. Nie używamy kont użytkowników platform.

## Publikacja

Wgranie źródeł nie oznacza ukończonej publikacji. Publiczny adres i wyniki testów trzeba zweryfikować osobno. GitHub Pages można skonfigurować z `main` / `docs`. Nie uruchamiaj workflow w innym repozytorium.
