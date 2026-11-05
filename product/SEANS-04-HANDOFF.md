# Seans 0.4 — oglądamy razem

Stan: implementacja w oddzielnej gałęzi `feature/together-v04`. Nie zastępuje `main`. Wersja solo i dźwięki nie zostały zmienione. Publiczny backend nie jest skonfigurowany; `docs/room-config.js` celowo ma `enabled: false`.

## Zakres

Dwie anonimowe sesje urządzeń, jedno zaproszenie, wspólna pula filmów dostępnych w wybranych platformach, osobna kolejność pojedynków. „Widziałem” pozostaje lokalną etykietą. Jednoznaczne veto wyklucza film z propozycji danej rundy. Do 12 pojedynków na osobę, następnie do trzech propozycji. Finał dopiero po dwóch potwierdzeniach tego samego filmu. Nie ma procentów zgodności ani automatycznego traktowania otwarcia platformy jako obejrzenia.

Nowy interfejs: `docs/together.html`. Wysłanie zaproszenia przez systemowe udostępnianie lub skopiowanie linku. Kod QR, konta, synchronizacja pełnej historii, płatności i personalizacja długoterminowa nie należą do tej wersji.

## Architektura

Przeglądarka → anonimowy Supabase Auth → Edge Function `seans-room` → prywatne tabele PostgreSQL. Cały stan gry i decyzja o finale są obliczane na serwerze. Porównanie wersji rekordu zapewnia atomowy zapis; identyfikator operacji i licznik własnych decyzji chronią przed podwójnym przetworzeniem i zastosowaniem kliknięcia do nowej karty.

Zaproszenie: losowy identyfikator pokoju i 256-bitowy sekret. Serwer przechowuje tylko skrót sekretu, a po dołączeniu drugiej osoby go unieważnia. Sekret przychodzi we fragmencie URL, usuwanym z paska adresu. Do serwera trafiają wyłącznie identyfikatory filmów, platformy oraz wybory bieżącego pokoju, nie wcześniejsza historia telefonu.

Pokój wygasa po czterech godzinach. Dostęp jest wtedy odrzucany także przed fizycznym sprzątaniem rekordów. Każdy uczestnik może zamknąć pokój. Klient przechowuje niedostarczoną operację i ponawia ją z tym samym identyfikatorem. Widok nie deklaruje udanego zapisu przed potwierdzeniem serwera.

## Granica wdrożenia — do wykonania po podłączeniu Supabase

1. Zweryfikować nazwę i stałe ID nowego projektu Seans. Utworzyć wyłącznie osobny projekt; nie używać projektu wyceny, jego bazy, kluczy ani sekretów. Najpierw potwierdzić dostępność planu Free w koncie. Nie podnosić płatnego planu bez osobnej zgody.
2. Wybrać własny adres HTTPS aplikacji. Nie aktywować anonimowych tokenów na współdzielonym `raw.githack.com`: inne aplikacje na tej domenie dzielą origin i pamięć. Skonfigurować osobny adres podglądu oraz adres produkcyjny; ograniczyć do nich `SEANS_ALLOWED_ORIGINS`.
3. Zastosować wyłącznie `supabase/migrations/202609190001_seans_rooms.sql` w nowej bazie. Bez resetowania schematu. Sprawdzić brak odczytu tabel i RPC dla anon/authenticated, prawa service_role i niepowodzenie odczytu jako trzecia osoba.
4. Włączyć anonimowy Auth i sprawdzić limity nadużyć. Przed szerszym testem publicznym dołożyć CAPTCHA/Turnstile i limity według zaufanego adresu IP. Obecne limity 200 pokojów i pięciu utworzeń na użytkownika w godzinę nie zastępują ochrony publicznego serwisu przed tworzeniem wielu anonimowych tożsamości.
5. Wdrożyć funkcję Edge `seans-room`. `verify_jwt=false` w warstwie platformy nie oznacza braku uwierzytelniania: funkcja zawsze weryfikuje token przez Auth. Sprawdzić to na wdrożonej usłudze.
6. Ustawić w serwerze listę dozwolonych originów; service-role key tylko w środowisku funkcji. Do `room-config.js` wolno wpisać wyłącznie URL projektu i klucz publiczny oraz dokładny origin strony. Sprawdzić, że klucz prywatny nie trafił do kodu klienta, logów ani zrzutów.
7. Włączyć cykliczne usuwanie wygasłych pokojów przez `seans_cleanup_expired()` (np. co godzinę), zweryfikować rezultat. Anonimowe konta Auth wymagają osobnej uzgodnionej retencji; nie twierdzimy, że usunięcie pokoju usuwa konto Auth, kopie zapasowe i logi operatora.
8. Test dwóch realnych telefonów: stworzenie pokoju, dołączenie, widziane/powtórki, prywatność wyborów, odświeżenie, zerwanie internetu, veto, brak zgodności, dwie zgody, link do filmu, zamknięcie i wygasanie. Dotychczasowe CI nie jest testem zewnętrznego Supabase Auth ani głośnika iPhone'a.
9. Dopiero po tym `enabled:true`, sprawdzenie publicznego linku i kontrolowane dołączenie zmian do `main`. Nie publikować nowego trybu automatycznie na podstawie samych testów modułu.

## Testy

`npm test`: dotychczasowy tryb solo.
`node --test tests/room-engine.test.mjs tests/room-api.test.mjs`: czysta logika i granica API.
`TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/seans_rooms_test node --test tests/room-sql.test.mjs`: rzeczywisty PostgreSQL. Skrypt odrzuca bazę inną niż lokalna `_test`.
`python tests/together-mobile.py`: dwie odrębne sesje w Chromium i WebKit, rzeczywisty handler i w CI rzeczywista baza. Testowy adapter tożsamości nie jest wdrożonym Supabase Auth. Raport zawiera jawną nazwę magazynu i ograniczenia.

Workflow `together-v04.yml` ma tylko odczyt GitHuba, nie publikuje zmian ani nie wywołuje serwerów innych aplikacji. Bazę testową tworzy w krótkotrwałym kontenerze.

## Utrzymanie

Na razie brak obowiązkowego logowania, reklam, płatności i analityki zbieranej na serwerze. Do badań produktu stosujemy zgody i ankietę testera, nie ukryty tracking. Nie przedstawiamy danych z lokalnego zegara jako pełnego czasu obu osób lub zaoszczędzonego czasu.
