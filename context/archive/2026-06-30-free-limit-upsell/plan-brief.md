# Free Limit Upsell (S-04) — Plan Brief

> Full plan: `context/changes/free-limit-upsell/plan.md`

## What & Why

Plan `free` ogranicza liczbę aktywnych pozycji do 30; przy próbie dodania kolejnej użytkownik widzi
komunikat o limicie (bez płatności — to wersja 2). Domyka „freemium-ready" i wymóg FR-011.

## Starting Point

`createItem` (S-01) waliduje i wstawia pozycję bez żadnego limitu. Pole `profiles.plan` (free/premium)
istnieje z F-01. Dashboard pokazuje błędy przez `?error=`.

## Desired End State

Użytkownik `free` z 30 aktywnymi pozycjami przy próbie dodania 31. dostaje komunikat o limicie i pozycja
nie powstaje. Reguła pokryta unit-testem w CI.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego |
| --- | --- | --- |
| Co liczy się do limitu | Aktywne pozycje (bez załatwionych) | Spójne z listą; załatwione zwalniają miejsce |
| Test | Unit-test czystej funkcji `isOverFreeLimit` | Czyste → CI (test:unit); domyka R4 |
| Egzekwowanie | W `createItem` przed insertem | Jeden punkt prawdy; bez zmiany API |
| Komunikat | Przez istniejący `?error=` | Spójne z walidacją; zero nowego UI |

## Scope

**In scope:** `src/lib/plan.ts` (FREE_ITEM_LIMIT + isOverFreeLimit) + unit-test; sprawdzenie limitu w `createItem` z komunikatem.

**Out of scope:** płatność/odblokowanie, ścieżka upgrade do premium, ukrywanie formularza.

## Architecture / Approach

Czysta funkcja `isOverFreeLimit(plan, count)` izoluje regułę (testowalna bez bazy). `createItem` dociąga
plan z `profiles` i liczbę aktywnych pozycji (`count: exact, head`), sprawdza regułę przed insertem.

## Phases at a Glance

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Limit + komunikat | Reguła + unit-test + egzekwowanie w serwisie | Limit źle egzekwowany (R4) — stąd unit-test progów |

**Prerequisites:** S-01 (done); lokalny Supabase do smoke'u manualnego.
**Estimated effort:** ~1 sesja, 1 faza.

## Open Risks & Assumptens

- Manualny test wymaga 30 pozycji (wstawimy skryptem przez API).

## Success Criteria (Summary)

- `npm run test:unit`, `astro check`, `lint`, `build` zielone.
- Przy 30 aktywnych pozycjach 31. → komunikat o limicie, pozycja nie powstaje; < 30 działa normalnie.
