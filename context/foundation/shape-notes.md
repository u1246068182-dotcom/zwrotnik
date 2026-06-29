---
project: "Zwrotnik"
context_type: greenfield
created: 2026-06-28
updated: 2026-06-28
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 1
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "kontrola dostępu"
      decision: "logowanie e-mail + hasło; model płaski (jedna rola: użytkownik); każdy widzi tylko swoje pozycje"
    - topic: "logika domenowa"
      decision: "deterministyczny silnik pilności (priorytetyzacja + kalkulacja), nie pusty CRUD"
    - topic: "monetyzacja"
      decision: "darmowy do 30 pozycji; powyżej jednorazowo 9,99 zł; realna płatność i egzekwowanie limitu = wersja 2 (Parked)"
    - topic: "platforma"
      decision: "web-app jako PWA (iOS/Android/web z jednego kodu); natywne apki poza MVP"
    - topic: "zakres MVP"
      decision: "1 tydzień, north star = dodaj zakup → lista wg pilności z dniami i kwotą"
  frs_drafted: 12
  quality_check_status: accepted
---

# Shape Notes: Zwrotnik

> Notatki z sesji odkrywczej. Ciało antycypuje 10 sekcji PRD (greenfield) w kolejności,
> tak by `/10x-prd` mógł je czysto zmapować. Blok `## Forward: tech-stack` jest informacyjny
> (NIE część schemy PRD) — do konsumpcji przez `/10x-tech-stack-selector`.

## Vision & Problem Statement

Polak kupujący online regularnie traci realne pieniądze, bo przegapia zamykające się okna
czasowe: 14-dniowe ustawowe prawo odstąpienia (zwrot), 2-letnią rękojmię oraz moment, w którym
niechciana subskrypcja sama się odnawia. Dziś pilnuje tego z pamięci, w notatkach albo w rozsypanych
mailach — i co jakiś czas po prostu traci kwotę, którą mógł odzyskać albo której pobrania mógł uniknąć.

Wgląd, który czyni produkt sensownym: te wszystkie terminy mają wspólną naturę — „zamykające się okno,
przy którym są pieniądze" — więc da się je sprowadzić do jednego, deterministycznego wskaźnika pilności
i jednej posortowanej listy. Globalni gracze (Refundly, ReturnTrack, Rocket Money) nie rankują na polskie
frazy i nie znają polskiego prawa konsumenckiego ani polskich sklepów; kanałem dotarcia jest wyszukiwanie
("termin zwrotu", "rękojmia ile trwa"), a nie istniejąca społeczność.

## User & Persona

**Persona główna:** Polak kupujący online (ogarnięty, „nie lubię tracić kasy"), który robi kilkanaście
zakupów miesięcznie i chce w jednym miejscu widzieć, przy których z nich tyka zegar i ile złotych jest
zagrożonych. Sięga po produkt w momencie, gdy dodaje świeży zakup albo gdy zastanawia się „czy mam jeszcze
czas to zwrócić / czy coś mi się zaraz nie odnowi".

## Success Criteria

### Primary
- Zalogowany użytkownik dodaje zakup i natychmiast widzi go na liście z poprawnym statusem pilności,
  liczbą pozostałych dni i kwotą zagrożoną — oraz sumą „Zagrożone" na górze.

### Secondary
- Dodanie pozycji jest szybkie i niskoprogowe (minimum pól), więc użytkownik realnie wprowadza kolejne zakupy.

### Guardrails
- Użytkownik nigdy nie zobaczy ani nie zmodyfikuje cudzej pozycji (prywatność / IDOR) — to też kluczowy
  test bezpieczeństwa.
- Status i liczba dni są poprawne co do dnia względem daty odniesienia i długości okna — żeby „pilne"
  realnie odpowiadało zagrożonym pieniądzom.
- Produkt jest używalny na telefonie (instalowalny z przeglądarki, PWA), bez osobnej natywnej aplikacji.

## User Stories

### US-01: Użytkownik dodaje zakup i widzi jego pilność

- **Given** jestem zalogowany
- **When** dodaję pozycję (nazwa, sklep, kwota, data zakupu, typ okna)
- **Then** widzę ją na liście z policzonym statusem, liczbą pozostałych dni i kwotą

#### Acceptance Criteria
- Pozycja trafia do właściwego kubełka (Pilne / Wkrótce / Spokojnie / Minęło) wg progów dni.
- W obrębie kubełka pozycje są posortowane wg kwoty malejąco.
- Suma „Zagrożone" = suma kwot pozycji w stanie Pilne + Wkrótce.
- Pusty stan (brak pozycji) pokazuje zachętę do dodania, nie pustą listę bez kontekstu.

### US-02: Użytkownik zarządza pozycją

- **Given** mam dodane pozycje
- **When** edytuję, usuwam albo oznaczam pozycję jako „Załatwione"
- **Then** lista i suma „Zagrożone" od razu się aktualizują, a „załatwione" znika z aktywnej listy

## Functional Requirements

### Konto i dostęp
- FR-001: Użytkownik can zarejestrować się i zalogować e-mailem i hasłem. Priority: must-have
- FR-002: Użytkownik can widzieć i modyfikować wyłącznie własne pozycje. Priority: must-have
  > Socratic: Kontrargument: „dla MVP wystarczy jeden user, autoryzacja to narzut." Rozstrzygnięcie:
  > zostaje — auth per użytkownik jest wymogiem certyfikatu i fundamentem testu IDOR.

### Pozycje (CRUD)
- FR-003: Użytkownik can dodać pozycję z polami: nazwa, sklep (opcjonalnie), kwota, data odniesienia, typ okna. Priority: must-have
- FR-008: Użytkownik can edytować pozycję. Priority: must-have
- FR-009: Użytkownik can usunąć pozycję. Priority: must-have
- FR-010: Użytkownik can oznaczyć pozycję jako „Załatwione" (znika z aktywnej listy). Priority: must-have

### Silnik pilności
- FR-004: Aplikacja can wyliczyć datę zamknięcia okna i liczbę pozostałych dni wg typu okna. Priority: must-have
- FR-005: Aplikacja can przypisać status (Pilne / Wkrótce / Spokojnie / Minęło) wg progów dni. Priority: must-have
- FR-006: Użytkownik can zobaczyć listę pogrupowaną w kubełki pilności, sortowaną wewnątrz kubełka wg kwoty malejąco. Priority: must-have
- FR-007: Użytkownik can zobaczyć sumę „Zagrożone" (kwoty pozycji Pilne + Wkrótce). Priority: must-have

### Plan / limit
- FR-011: Użytkownik na planie free can dodać do 30 pozycji; przy próbie kolejnej widzi komunikat o limicie. Priority: nice-to-have
  > Socratic: Kontrargument: „sam licznik słabo konwertuje." Rozstrzygnięcie: limit zostaje jako reguła
  > i test, ale przy launchu egzekwowanie miękkie (komunikat), realna płatność dopiero w wersji 2.
- FR-012: Użytkownik can edytować długość okna zwrotu dla pojedynczej pozycji (domyślnie 14 dni). Priority: nice-to-have

## Non-Functional Requirements

- Po dodaniu albo zmianie pozycji użytkownik widzi zaktualizowany status, dni i kwotę w czasie odbieranym
  jako natychmiastowy (poniżej ~1 s).
- Użytkownik nie jest w stanie odczytać ani zmienić zasobu należącego do innego użytkownika, nawet przez
  podmianę identyfikatora.
- Status i liczba pozostałych dni są poprawne co do dnia względem daty odniesienia i długości okna.
- Produkt pozostaje używalny na najnowszych przeglądarkach mobilnych i da się go zainstalować na ekranie
  głównym telefonu bez osobnej natywnej aplikacji.

## Business Logic

Aplikacja dla każdej pozycji wylicza, ile dni zostało do zamknięcia jej okna i ile złotych jest wtedy
zagrożonych, a następnie układa wszystkie pozycje w jedną listę według pilności i kwoty.

Wejścia (od użytkownika): kwota, data odniesienia (data zakupu albo data odnowienia) oraz typ okna —
zwrot (domyślnie 14 dni od zakupu), rękojmia (2 lata od zakupu) albo subskrypcja (data odnowienia wprost).
Z nich wyliczana jest data zamknięcia okna, a z niej liczba pozostałych dni. Liczba dni przekłada się na
status: minęło (dni < 0), pilne (0–3), wkrótce (4–14), spokojnie (powyżej 14). Wynik użytkownik widzi jako
jedną listę pogrupowaną w te statusy, wewnątrz kubełka uporządkowaną wg kwoty malejąco, z sumą kwot
zagrożonych (pozycje pilne + wkrótce) na górze.

## Access Control

Aplikacja wieloużytkownikowa. Jedna rola: użytkownik (model płaski). Rejestracja i logowanie e-mailem
i hasłem. Niezalogowany użytkownik wchodzący na chronioną ścieżkę produktową jest kierowany do logowania.
Każdy użytkownik widzi i modyfikuje wyłącznie własne pozycje; izolacja danych per użytkownik jest twardym
wymogiem (patrz guardrail prywatności).

Pole planu (`free` / `premium`) istnieje na użytkowniku jako szew pod przyszłą monetyzację; w MVP każdy
jest `free`, a egzekwowanie limitu 30 pozycji jest miękkie (komunikat, bez realnej płatności).

## Non-Goals

- Integracja z kontem bankowym — to model typu Rocket Money, inny i cięższy produkt; świadomie poza zakresem.
- Automatyczne anulowanie subskrypcji za użytkownika — MVP tylko przypomina, nie działa za usera.
- Monitoring spadków cen / price-protection — osobny, kosztowny przepływ; poza MVP.
- Natywne aplikacje iOS/Android — MVP to PWA z jednego kodu; natywne dopiero po trakcji.
- Realne płatności i twarde egzekwowanie limitu — szew istnieje, ale płatność to wersja 2 (po certyfikacie).
- Automatyczne parsowanie maili — wartościowe, ale rozsadza tydzień; wersja 2.

## Open Questions

1. **Czy długość okna zwrotu (14 dni) ma być edytowalna już w MVP (FR-012)?** — Owner: użytkownik. Block: no.
2. **Czy „Załatwione" archiwizuje, czy trwale usuwa?** — Owner: użytkownik. Domyślnie: ukrywa z aktywnej listy. Block: no.

## Forward: tech-stack

> Informacyjne — NIE część schemy PRD. Do konsumpcji przez `/10x-tech-stack-selector`.

- Preferowany kierunek: web-app jako **PWA** (jeden kod = iOS + Android + przeglądarka, instalowalne).
- Backend/auth/baza: rozważany **Supabase** (auth z JWT + Postgres + API + RLS pod izolację per użytkownik).
- Hosting: rozważany **Vercel / Cloudflare** (free tier, publiczny URL pod SEO).
- Architektura API-first + auth tokenowe → otwarte drzwi na przyszłe natywne klienty na ten sam backend.
- Świadomie odrzucone na teraz: surowe AWS/GCP (koszt czasu + ryzyko rachunku); migracja na GCP = wersja 2.

## Forward: technical-roadmap

> Informacyjne — NIE część schemy PRD.

- Wersja 2 (po certyfikacie): realne płatności (jednorazowe odblokowanie 9,99 zł powyżej 30 pozycji),
  auto-parsowanie maili (AI), presety polskich sklepów (Allegro, Zalando, x-kom), powiadomienia push/e-mail,
  landing + SEO pod „termin zwrotu" / „rękojmia", migracja/rozbudowa na GCP, natywne aplikacje.

## Quality cross-check

Wszystkie elementy greenfield obecne: Access Control ✓ · Business Logic (reguła jednozdaniowa) ✓ ·
artefakt shape-notes ✓ · budżet czasu ≤ 3 tyg. (1 tydzień) ✓ · Non-Goals ✓. Status: accepted.
