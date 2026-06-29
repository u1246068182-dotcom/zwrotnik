---
project: "Zwrotnik"
version: 1
status: draft
created: 2026-06-29
updated: 2026-06-29
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Zwrotnik

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Użytkownik traci pieniądze, przegapiając zamykające się okna: zwrot (14 dni), rękojmię (2 lata) i odnowienia
subskrypcji. Zwrotnik sprowadza je do jednego wskaźnika pilności i jednej posortowanej listy z sumą kwot
zagrożonych. Klin produktu — jedyna cecha, bez której aplikacja staje się generyczną listą — to deterministyczny
silnik, który dla każdej pozycji liczy „ile dni i ile złotych jest zagrożonych" i układa je wg pilności.

## North star

**S-01: Dodaj zakup → lista wg pilności** — najmniejszy pełny przepływ, który udowadnia tezę produktu, dlatego
sekwencjonowany najwcześniej, jak pozwala fundament danych.

> Gwiazda przewodnia = najmniejszy przepływ end-to-end, którego zadziałanie dowodzi sensu produktu; wszystko inne
> ma znaczenie dopiero, gdy on działa.

## At a glance

| ID   | Change ID          | Outcome (user can …)                                                              | Prerequisites | PRD refs                                            | Status   |
| ---- | ------------------ | --------------------------------------------------------------------------------- | ------------- | --------------------------------------------------- | -------- |
| F-01 | items-schema-rls   | (foundation) tabela `items` + `profiles.plan` z RLS dopuszczającym tylko własne   | —             | FR-002, Access Control                              | done     |
| S-01 | first-urgency-loop | dodać zakup (zwrot) i zobaczyć go na liście wg pilności z dniami, kwotą i sumą     | F-01          | US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007 | proposed |
| S-02 | all-window-types   | dodać rękojmię i subskrypcję; status liczy się poprawnie dla każdego typu okna     | S-01          | FR-003, FR-004, FR-012                              | proposed |
| S-03 | manage-items       | edytować, usunąć i oznaczyć pozycję jako „Załatwione"                              | S-01          | US-02, FR-008, FR-009, FR-010                       | proposed |
| S-04 | free-limit-upsell  | przy 30 pozycjach zobaczyć komunikat o limicie przy próbie dodania kolejnej         | S-01          | FR-011                                              | proposed |

## Baseline

Co już jest w kodzie na `2026-06-29` (auto-research + potwierdzenie). Fundamenty zakładają obecność tych warstw
i ich NIE odtwarzają.

- **Frontend:** present — Astro + React + Tailwind (`src/components`, `src/layouts`, `src/pages`, `src/styles`).
- **Backend / API:** present — Astro API routes (`src/pages/api/`).
- **Data:** partial — klient Supabase wpięty (`src/lib/supabase.ts`, `supabase/config.toml`), ale brak schematu domenowego (tabeli `items`) i migracji.
- **Auth:** present — pełny scaffold e-mail+hasło (`src/pages/api/auth/{signin,signup,signout}.ts`, `src/middleware.ts`, `src/components/auth`, `src/pages/auth`).
- **Deploy / infra:** present — Cloudflare (`wrangler.jsonc`) + GitHub Actions (`.github/workflows/ci.yml`).
- **Observability:** absent.

## Foundations

### F-01: Schemat danych pozycji + RLS

- **Outcome:** (foundation) tabela `items` (oraz pole `profiles.plan`) istnieje z politykami RLS, które dopuszczają odczyt i zapis wyłącznie własnych rekordów użytkownika.
- **Change ID:** items-schema-rls
- **PRD refs:** FR-002, Access Control
- **Unlocks:** S-01
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez schematu i RLS żaden slice nie ma gdzie zapisać pozycji ani jak wymusić izolację per użytkownik; to jedyny brakujący fundament (auth/deploy/CI obecne w baseline), więc idzie pierwszy.
- **Status:** done

## Slices

### S-01: First urgency loop (north star)

- **Outcome:** User can dodać zakup typu zwrot i zobaczyć go na liście pogrupowanej wg pilności (Pilne/Wkrótce/Spokojnie/Minęło), z liczbą pozostałych dni, kwotą i sumą „Zagrożone".
- **Change ID:** first-urgency-loop
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** To klin produktu — jeśli pętla „dodaj → zobacz pilność" nie działa, reszta nie ma znaczenia. Sekwencjonowany tuż po fundamencie danych.
- **Status:** proposed

### S-02: Wszystkie typy okien

- **Outcome:** User can dodać pozycję typu rękojmia (2 lata) i subskrypcja (data odnowienia), a status oraz dni liczą się poprawnie dla każdego typu okna.
- **Change ID:** all-window-types
- **PRD refs:** FR-003, FR-004, FR-012
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Czy długość okna zwrotu ma być edytowalna per pozycja (FR-012, nice-to-have)? — Owner: użytkownik. Block: no.
- **Risk:** Rozszerza silnik o pozostałe typy okien; po S-01, bo dzieli z nim widok i model danych.
- **Status:** proposed

### S-03: Zarządzanie pozycjami

- **Outcome:** User can edytować, usunąć i oznaczyć pozycję jako „Załatwione"; lista i suma „Zagrożone" od razu się aktualizują.
- **Change ID:** manage-items
- **PRD refs:** US-02, FR-008, FR-009, FR-010
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-04
- **Blockers:** —
- **Unknowns:**
  - Czy „Załatwione" archiwizuje, czy trwale usuwa pozycję? — Owner: użytkownik. Block: no.
- **Risk:** Operacje na istniejących pozycjach; po S-01, bo wymaga istniejącej listy do edycji.
- **Status:** proposed

### S-04: Limit planu free + komunikat

- **Outcome:** User na planie free, mając 30 pozycji, widzi komunikat o limicie przy próbie dodania kolejnej (bez realnej płatności).
- **Change ID:** free-limit-upsell
- **PRD refs:** FR-011
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Miękki limit (komunikat), bez płatności; najmniejszy slice i najłatwiejszy do Parkowania, jeśli czas ciśnie (main_goal: speed).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID          | Suggested issue title                              | Ready for `/10x-plan` | Notes                                  |
| ---------- | ------------------ | -------------------------------------------------- | --------------------- | -------------------------------------- |
| F-01       | items-schema-rls   | Schemat danych pozycji + RLS per użytkownik        | yes                   | Run `/10x-plan items-schema-rls`       |
| S-01       | first-urgency-loop | Dodaj zakup → lista wg pilności                    | no                    | Czeka na F-01                          |
| S-02       | all-window-types   | Obsługa rękojmi i subskrypcji                      | no                    | Czeka na S-01                          |
| S-03       | manage-items       | Edycja/usuwanie/„Załatwione"                       | no                    | Czeka na S-01                          |
| S-04       | free-limit-upsell  | Limit 30 pozycji + komunikat                       | no                    | Czeka na S-01                          |

## Open Roadmap Questions

1. **Czy długość okna zwrotu (14 dni) ma być edytowalna per pozycja (FR-012)?** — Owner: użytkownik. Block: no (gates: S-02).
2. **Czy „Załatwione" archiwizuje, czy trwale usuwa pozycję?** — Owner: użytkownik. Block: no (gates: S-03).

## Parked

- **Integracja z kontem bankowym / agregacja transakcji** — Why parked: PRD §Non-Goals — inny, cięższy produkt.
- **Automatyczne anulowanie subskrypcji** — Why parked: PRD §Non-Goals — MVP tylko przypomina.
- **Monitoring spadków cen** — Why parked: PRD §Non-Goals — osobny, kosztowny przepływ.
- **Natywne aplikacje mobilne** — Why parked: PRD §Non-Goals — MVP działa z przeglądarki.
- **Realne płatności + twarde egzekwowanie limitu** — Why parked: PRD §Non-Goals — późniejsza wersja; w MVP limit miękki (S-04).
- **Automatyczne odczytywanie terminów z maili** — Why parked: PRD §Non-Goals — poza pierwszą wersją.

## Done

- **F-01: (foundation) tabela `items` + `profiles.plan` z RLS (tylko własne rekordy)** — Archived 2026-06-29 → `context/archive/2026-06-29-items-schema-rls/`. Lesson: —.
