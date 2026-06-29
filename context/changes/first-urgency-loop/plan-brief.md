# First Urgency Loop (S-01) — Plan Brief

> Full plan: `context/changes/first-urgency-loop/plan.md`

## What & Why

North star Zwrotnika: użytkownik dodaje zakup i natychmiast widzi go na liście pogrupowanej według
pilności (Pilne / Wkrótce / Spokojnie / Minęło) z dniami, kwotą i sumą „Zagrożone". To pierwszy przepływ,
który udowadnia tezę produktu — i dostarcza wymaganą do certyfikatu logikę biznesową + CRUD.

## Starting Point

Fundament F-01 gotowy (tabela `items` + RLS „tylko własne", typy `Database`, otypowany klient). Starter
ma Astro SSR, auth, chronioną stronę `/dashboard` (placeholder), Vitest. Brak jeszcze jakiejkolwiek logiki
domenowej ani UI pozycji.

## Desired End State

Na `/dashboard`: formularz dodawania (3 typy okien) + lista pozycji w kubełkach pilności, sort wg kwoty,
suma „Zagrożone" na górze, walidacja zod z komunikatami, pusty stan z zachętą. Silnik pilności pokryty
unit-testami (`npm test`).

## Key Decisions Made

| Decyzja | Wybór | Dlaczego |
| --- | --- | --- |
| UI | Server-rendered (Astro) + form POST + reload | Najprostsze, solidne, zero JS klienta; cel speed; starter SSR |
| Typy okien w S-01 | Wszystkie 3 od razu | Świadomie — S-01 wchłania zakres S-02 |
| Walidacja | Serwerowa zod + komunikaty | Konwencja startera; serwer nie ufa klientowi |
| Testy | Unit-testy silnika pilności | Czysta funkcja → idealny test do CI (bez Supabase); domyka wymóg „test" |

## Scope

**In scope:** silnik pilności + typy + unit-testy; serwis items (list/create + zod); API POST `/api/items`; server-rendered `/dashboard` (formularz + lista kubełkowa + suma).

**Out of scope:** edycja/usuwanie/„Załatwione" (S-03), limit 30 (S-04), płatności, powiadomienia, parsowanie maili, interaktywna wyspa React.

## Architecture / Approach

Czysty rdzeń najpierw (silnik, testy, bez bazy → CI-friendly), potem wpięcie w dane/API/UI. RLS robi
izolację per-user, więc serwis nie filtruje ręcznie po `user_id` (poza insertem). Daty/statusy/suma liczone
po stronie serwera; `today` wstrzykiwane do silnika dla determinizmu testów. Formularz w schemacie PRG.

## Phases at a Glance

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Silnik + typy + testy | Logika pilności + pełne unit-testy (CI) | Złe progi/sort/suma = błędna pilność (R1) — stąd testy granic |
| 2. Dane + API + UI | Serwis, API create, strona z formularzem i listą | Walidacja/PRG; poprawne mapowanie kwoty/daty |

**Prerequisites:** F-01 (done); lokalny Supabase + `.env` (do manualnej weryfikacji Fazy 2).
**Estimated effort:** ~1 sesja, 2 fazy.

## Open Risks & Assumptions

- Wybór „wszystkie 3 typy okien" sprawia, że S-02 (all-window-types) staje się w większości zbędny —
  przytniemy/zaparkujemy go przy archiwizacji S-01.
- Test integracyjny tworzenia pozycji świadomie pominięty (wymaga Supabase, poza CI); RLS pokryte w F-01.

## Success Criteria (Summary)

- `npm test` (silnik), `astro check`, `lint`, `build` zielone.
- Dodanie pozycji każdego typu → właściwy kubełek z poprawnymi dniami/kwotą; suma „Zagrożone" się zgadza.
- Błędne dane → komunikat walidacji, pozycja nie powstaje; pusta lista → zachęta do dodania.
