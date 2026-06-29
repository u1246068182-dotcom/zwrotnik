---
project: "Zwrotnik"
version: 1
status: draft
created: 2026-06-28
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 1
  hard_deadline: null
  after_hours_only: true
---

# Zwrotnik — PRD

## Vision & Problem Statement

Polak kupujący online regularnie traci realne pieniądze, bo przegapia zamykające się okna czasowe:
14-dniowe ustawowe prawo odstąpienia od zakupu (zwrot), 2-letnią rękojmię oraz moment, w którym niechciana
subskrypcja sama się odnawia. Dziś pilnuje tego z pamięci, w notatkach albo w rozsypanych mailach — i co
jakiś czas po prostu traci kwotę, którą mógł odzyskać, albo której pobrania mógł uniknąć.

Wgląd, który czyni produkt sensownym: te wszystkie terminy mają wspólną naturę — „zamykające się okno,
przy którym są pieniądze" — więc da się je sprowadzić do jednego wskaźnika pilności i jednej posortowanej
listy. Zagraniczne aplikacje do śledzenia zwrotów i subskrypcji nie odpowiadają na polskie zapytania i nie
znają polskiego prawa konsumenckiego ani polskich sklepów; naturalnym kanałem dotarcia jest wyszukiwanie
(„termin zwrotu", „rękojmia ile trwa"), a nie istniejąca społeczność.

## User & Persona

Polak kupujący online — ogarnięty, nastawiony na „nie lubię tracić pieniędzy" — który robi kilkanaście
zakupów miesięcznie i chce w jednym miejscu widzieć, przy których z nich tyka zegar i ile złotych jest
zagrożonych. Sięga po produkt w momencie, gdy dodaje świeży zakup albo gdy zastanawia się „czy mam jeszcze
czas to zwrócić" / „czy coś mi się zaraz nie odnowi".

## Success Criteria

### Primary
- Zalogowany użytkownik dodaje zakup i natychmiast widzi go na liście z poprawnym statusem pilności, liczbą
  pozostałych dni i kwotą zagrożoną — oraz sumą „Zagrożone" na górze.

### Secondary
- Dodanie pozycji jest szybkie i niskoprogowe (minimum pól), więc użytkownik realnie wprowadza kolejne zakupy.

### Guardrails
- Użytkownik nigdy nie zobaczy ani nie zmodyfikuje cudzej pozycji.
- Status i liczba pozostałych dni są poprawne co do dnia względem daty odniesienia i długości okna — żeby
  „pilne" realnie odpowiadało zagrożonym pieniądzom.
- Produkt jest używalny na telefonie i instalowalny z poziomu przeglądarki, bez osobnej natywnej aplikacji.

## User Stories

### US-01: Użytkownik dodaje zakup i widzi jego pilność

- **Given** jestem zalogowany
- **When** dodaję pozycję (nazwa, sklep, kwota, data zakupu, typ okna)
- **Then** widzę ją na liście z policzonym statusem, liczbą pozostałych dni i kwotą

#### Acceptance Criteria
- Pozycja trafia do właściwego kubełka (Pilne / Wkrótce / Spokojnie / Minęło) zgodnie z progami dni.
- W obrębie kubełka pozycje są posortowane według kwoty malejąco.
- Suma „Zagrożone" równa się sumie kwot pozycji w stanie Pilne oraz Wkrótce.
- Brak pozycji pokazuje zachętę do dodania, nie pustą listę bez kontekstu.

### US-02: Użytkownik zarządza pozycją

- **Given** mam dodane pozycje
- **When** edytuję, usuwam albo oznaczam pozycję jako „Załatwione"
- **Then** lista i suma „Zagrożone" od razu się aktualizują, a „załatwione" znika z aktywnej listy

#### Acceptance Criteria
- Edycja kwoty, daty albo typu okna od razu przelicza status, dni i kwotę zagrożoną.
- „Załatwione" usuwa pozycję z aktywnej listy i z sumy „Zagrożone".

## Functional Requirements

### Konto i dostęp
- FR-001: Użytkownik może zarejestrować się i zalogować e-mailem i hasłem. Priority: must-have
- FR-002: Użytkownik może widzieć i modyfikować wyłącznie własne pozycje. Priority: must-have
  > Socratic: Kontrargument: „dla MVP wystarczy jeden użytkownik, autoryzacja to narzut." Rozstrzygnięcie:
  > zostaje — dostęp powiązany z użytkownikiem jest wymogiem produktu i fundamentem ochrony prywatności danych.

### Pozycje (CRUD)
- FR-003: Użytkownik może dodać pozycję z polami: nazwa, sklep (opcjonalnie), kwota, data odniesienia, typ okna. Priority: must-have
- FR-008: Użytkownik może edytować pozycję. Priority: must-have
- FR-009: Użytkownik może usunąć pozycję. Priority: must-have
- FR-010: Użytkownik może oznaczyć pozycję jako „Załatwione" (znika z aktywnej listy). Priority: must-have

### Silnik pilności
- FR-004: Aplikacja wylicza datę zamknięcia okna i liczbę pozostałych dni zgodnie z typem okna. Priority: must-have
- FR-005: Aplikacja przypisuje status (Pilne / Wkrótce / Spokojnie / Minęło) zgodnie z progami dni. Priority: must-have
- FR-006: Użytkownik widzi listę pogrupowaną w kubełki pilności, sortowaną wewnątrz kubełka według kwoty malejąco. Priority: must-have
- FR-007: Użytkownik widzi sumę „Zagrożone" (kwoty pozycji Pilne oraz Wkrótce). Priority: must-have

### Plan i limit
- FR-011: Użytkownik na planie bezpłatnym może dodać do 30 pozycji; przy próbie kolejnej widzi komunikat o limicie. Priority: nice-to-have
  > Socratic: Kontrargument: „sam licznik słabo konwertuje." Rozstrzygnięcie: limit zostaje jako reguła
  > i przedmiot testu, ale przy starcie egzekwowanie jest miękkie (komunikat); realna płatność to późniejsza wersja.
- FR-012: Użytkownik może edytować długość okna zwrotu dla pojedynczej pozycji (domyślnie 14 dni). Priority: nice-to-have

## Non-Functional Requirements

- Po dodaniu albo zmianie pozycji użytkownik widzi zaktualizowany status, liczbę dni i kwotę w czasie
  odbieranym jako natychmiastowy.
- Użytkownik nie jest w stanie odczytać ani zmienić zasobu należącego do innego użytkownika, nawet przez
  podmianę identyfikatora w adresie.
- Status i liczba pozostałych dni są poprawne co do dnia względem daty odniesienia i długości okna.
- Produkt pozostaje używalny na najnowszych przeglądarkach mobilnych i daje się zainstalować na ekranie
  głównym telefonu bez osobnej natywnej aplikacji.

## Business Logic

Aplikacja dla każdej pozycji wylicza, ile dni zostało do zamknięcia jej okna i ile złotych jest wtedy
zagrożonych, a następnie układa wszystkie pozycje w jedną listę według pilności i kwoty.

Wejścia od użytkownika to kwota, data odniesienia (data zakupu albo data odnowienia) oraz typ okna: zwrot
(domyślnie 14 dni od zakupu), rękojmia (2 lata od zakupu) albo subskrypcja (data odnowienia podana wprost).
Z nich wyliczana jest data zamknięcia okna, a z niej liczba pozostałych dni. Liczba dni przekłada się na
status: minęło (dni poniżej zera), pilne (0–3), wkrótce (4–14), spokojnie (powyżej 14). Wynik użytkownik
widzi jako jedną listę pogrupowaną w te statusy, wewnątrz kubełka uporządkowaną według kwoty malejąco,
z sumą kwot zagrożonych (pozycje pilne oraz wkrótce) prezentowaną na górze.

## Access Control

Aplikacja wieloużytkownikowa z jedną rolą (użytkownik; model płaski). Rejestracja i logowanie e-mailem
i hasłem. Niezalogowany użytkownik wchodzący na chronioną ścieżkę produktową jest kierowany do logowania.
Każdy użytkownik widzi i modyfikuje wyłącznie własne pozycje; izolacja danych pomiędzy użytkownikami jest
twardym wymogiem.

Na użytkowniku istnieje pojęcie planu (bezpłatny / płatny) jako miejsce pod przyszłą monetyzację; w MVP
każdy użytkownik jest na planie bezpłatnym, a limit 30 pozycji jest egzekwowany miękko (komunikat), bez
realnej płatności.

## Non-Goals

- Integracja z kontem bankowym i agregacja transakcji — to inny, znacznie cięższy produkt; świadomie poza zakresem.
- Automatyczne anulowanie subskrypcji za użytkownika — MVP tylko przypomina, nie działa za użytkownika.
- Monitoring spadków cen — osobny, kosztowny przepływ; poza MVP.
- Natywne aplikacje mobilne — MVP działa na telefonie z poziomu przeglądarki; natywne dopiero po zdobyciu trakcji.
- Realne płatności i twarde egzekwowanie limitu 30 pozycji — mechanizm planu istnieje, ale płatność to późniejsza wersja.
- Automatyczne odczytywanie terminów z maili — wartościowe, ale poza zakresem pierwszej wersji.

## Open Questions

1. **Czy długość okna zwrotu (14 dni) ma być edytowalna już w MVP (FR-012)?** — Owner: użytkownik. Block: no.
2. **Czy „Załatwione" archiwizuje, czy trwale usuwa pozycję?** — Owner: użytkownik. Domyślnie ukrywa z aktywnej listy. Block: no.
