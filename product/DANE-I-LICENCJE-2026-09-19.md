# Dane filmowe — weryfikacja 19.09.2026

To rozpoznanie publicznych warunków, nie oferta handlowa ani opinia prawna. Nie kupiono dostępu i nie wysłano żadnego zapytania w imieniu firmy. Nie uzyskano komercyjnej licencji do dotychczasowego pobierania danych.

## Ustalenia

| Dostawca | Co potwierdzono | Co nadal trzeba ustalić |
|---|---|---|
| JustWatch Partner API | Token po zawarciu umowy; wymagane oznaczone linki do odpowiednich stron tytułów. | Cena dla małej polskiej bety i planu komercyjnego; prawa do plakatów, opisów i ich buforowania; pełne katalogi sześciu polskich abonamentów, gwarancje jakości i eksport. |
| Watchmode | Publiczny plan Startup 349 USD/miesiąc, 40 tys. zapytań i użytek komercyjny. Darmowy Developer 2500 zapytań jest niekomercyjny. | Rzeczywiste pokrycie Polski i wszystkich sześciu platform; zgodność identyfikatorów; polskie opisy; dozwolone przechowywanie i prawa do grafik. Cena katalogowa nie jest ofertą dla Seansu. |
| TMDB | Darmowy wariant niekomercyjny z atrybucją; użytek komercyjny wymaga kontaktu w sprawie licencji. | Koszt i zakres licencji, warunki obrazów; dostępność VOD jest osobnym wymaganiem, a nie automatycznie rozwiązaną licencją. |

Źródła pierwotne:
- https://apis.justwatch.com/docs/api/
- https://api.watchmode.com/
- https://developer.themoviedb.org/docs/faq

Wniosek roboczy: najpierw indywidualna wycena JustWatch; alternatywę porównać na tej samej liście tytułów i platform. Nie zamieniać działającego źródła na inne tylko dlatego, że ma atrakcyjny opis. Nie wpisywać do biznesplanu kosztu danych 0 zł ani przychodu afiliacyjnego bez umowy.

## Zakres zapytania

Polska, filmy (bez seriali na początek), Netflix, Prime Video w podstawowym abonamencie, Disney+, HBO Max, Apple TV i SkyShowtime. Bez zakupów, wypożyczeń i płatnych dodatkowych kanałów. Potrzebne plakaty, polskie tytuły/opisy, gatunki, rok, czas trwania, link do oferty i data aktualizacji. Należy zapytać o ograniczenia publikacji danych w statycznym pliku: dzisiejszy prototyp ma publiczny katalog, a umowa może wymagać pośredniczącego API.

Proponowane scenariusze do wyceny, nie prognoza: zamknięty pilotaż 5 i następnie 30 par, później 1000/10000/50000 aktywnych użytkowników miesięcznie. Poprosić o minimalny okres umowy, limity, koszt przekroczeń, zakończenie umowy i usunięcie kopii danych.

## Szkic zapytania — NIE WYSŁANO

Temat: Seans — wycena dostępu do polskich danych VOD i licencji na metadane

Dzień dobry,

przygotowujemy Seans, aplikację pomagającą jednej osobie lub parze wybrać film spośród tytułów dostępnych w posiadanych abonamentach. Jesteśmy na etapie prototypu i planujemy zamknięty pilotaż, a następnie rozważamy model freemium/subskrypcyjny.

Prosimy o ofertę licencyjną obejmującą polskie katalogi Netflix, Prime Video, Disney+, HBO Max, Apple TV i SkyShowtime. Potrzebujemy informacji o filmach w abonamencie, aktualizacji dostępności, linków do ofert oraz warunków wyświetlania plakatów, polskich tytułów, opisów i metadanych. Zależy nam na wykluczeniu zakupu, wypożyczenia i dodatkowo płatnych kanałów.

Prosimy o określenie ceny pilotażu oraz wariantów dla 1000, 10000 i 50000 aktywnych użytkowników miesięcznie, limitów i kosztów przekroczeń. Prosimy także o warunki buforowania i eksportu danych, okres retencji, dopuszczalne hostowanie obrazów, wymaganą atrybucję, dostęp do środowiska testowego oraz minimalny okres umowy.

Prosimy o osobne potwierdzenie, czy uprawnienia do grafik i opisów zawierają się w umowie API, czy wymagają dodatkowej licencji. Chcemy również ustalić, czy zamknięte testy prototypu przygotowywanego z myślą o przyszłej monetyzacji są objęte proponowaną zgodą.

Z poważaniem,
Kamil Krauzowicz
Kadar Studio — projekt Seans

## Koszt infrastruktury, niezależny od danych

Supabase publikuje plan Free, z ograniczeniami m.in. dwóch aktywnych projektów, 500 MB bazy i 5 GB transferu. Trzeba sprawdzić wykorzystanie konta i ewentualne usypianie projektu; nie zakładamy bezterminowej dostępności bez ograniczeń. Pro startuje od 25 USD/miesiąc, ale nie został wybrany ani uruchomiony. To nie obejmuje licencji do filmów ani kosztu hostingu strony.

Źródła: https://supabase.com/pricing ; https://supabase.com/docs/guides/auth/auth-anonymous
