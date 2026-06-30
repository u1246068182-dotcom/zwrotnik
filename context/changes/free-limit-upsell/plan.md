# Free Limit Upsell (S-04) — Implementation Plan

## Overview

Plan `free` ogranicza liczbę aktywnych pozycji do 30. Przy próbie dodania kolejnej użytkownik widzi
komunikat o limicie (bez realnej płatności — odblokowanie to wersja 2). Sercem jest czysta funkcja
decyzyjna `isOverFreeLimit(plan, count)` (unit-test, CI-friendly), użyta w `createItem` przed insertem.

## Current State Analysis

- `src/lib/services/items.ts:createItem` waliduje wejście (zod) i wstawia pozycję — brak jakiegokolwiek limitu.
- `profiles.plan` (`free` | `premium`, default `free`) istnieje z F-01; RLS pozwala czytać własny profil.
- Dashboard pokazuje błędy przez `?error=` (PRG) — ten sam mechanizm użyjemy dla komunikatu o limicie.
- Limit liczymy po **aktywnych** pozycjach (`status_zalatwione = false`) — spójnie z listą.

### Key Discoveries:
- `createItem` ma już klient Supabase i `userId` — może dociągnąć plan i liczbę pozycji bez zmiany API.
- Liczbę pozycji policzymy zapytaniem z `count: "exact", head: true` (bez pobierania wierszy).

## Desired End State

Użytkownik na planie `free` z 30 aktywnymi pozycjami przy próbie dodania 31. dostaje komunikat o limicie
i pozycja nie powstaje. Reguła limitu jest pokryta unit-testem (`npm run test:unit`).

## What We're NOT Doing

- Realna płatność / odblokowanie (9,99 zł) — wersja 2.
- Twarda blokada poza komunikatem (np. ukrycie formularza) — pokazujemy komunikat, formularz zostaje.
- Ścieżka upgrade do `premium` — poza zakresem.

## Implementation Approach

Czysta funkcja `isOverFreeLimit` izoluje regułę (łatwy unit-test, zero zależności). `createItem` po walidacji
dociąga plan użytkownika i liczbę aktywnych pozycji, a przed insertem sprawdza regułę i — jeśli limit
osiągnięty — zwraca komunikat (przechwytywany przez istniejący przepływ `?error=`).

## Phase 1: Limit planu free + komunikat

### Changes Required:

#### 1. Reguła limitu (czysta funkcja)
**File**: `src/lib/plan.ts`
**Intent**: izolowana, testowalna reguła limitu darmowego planu.
**Contract**: `export const FREE_ITEM_LIMIT = 30;` oraz `export function isOverFreeLimit(plan: string, activeCount: number): boolean` — zwraca `true` gdy `plan === "free" && activeCount >= FREE_ITEM_LIMIT`.

#### 2. Unit-test reguły
**File**: `tests/unit/plan.test.ts`
**Intent**: zabezpieczyć regułę limitu (ryzyko R4 — limit egzekwowany poprawnie).
**Contract**: testy: `free`+29 → false; `free`+30 → true; `free`+31 → true; `premium`+100 → false.

#### 3. Egzekwowanie limitu w serwisie
**File**: `src/lib/services/items.ts`
**Intent**: przed insertem sprawdzić limit dla planu użytkownika i odrzucić z komunikatem.
**Contract**: w `createItem`, po udanej walidacji, pobrać `plan` z `profiles` (po `userId`) oraz liczbę
aktywnych pozycji (`items` z `status_zalatwione=false`, `count: "exact", head: true`); jeśli
`isOverFreeLimit(plan, count)` → zwrócić `{ error: <komunikat o limicie> }` zamiast insertu. Komunikat
wspomina limit 30 i że odblokowanie (9,99 zł) będzie dostępne wkrótce.

### Success Criteria:

#### Automated Verification:
- Unit-testy (w tym reguła limitu) przechodzą: `npm run test:unit`
- Typecheck przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:
- Użytkownik `free` z 30 aktywnymi pozycjami: próba dodania 31. pokazuje komunikat o limicie, pozycja nie powstaje.
- Przy < 30 pozycjach dodawanie działa normalnie.

**Implementation Note**: zatrzymaj się na ręczne potwierdzenie przed zamknięciem planu.

## Testing Strategy

### Unit Tests:
- `isOverFreeLimit` — progi (29/30/31) i `premium`.

### Integration Tests:
- Brak nowych w CI. Egzekwowanie w `createItem` zweryfikujemy smoke'em (dodanie 30 pozycji → 31. odrzucona) lokalnie.

### Manual Testing Steps:
1. Lokalnie wstaw 30 aktywnych pozycji dla testowego usera (skryptem przez API).
2. Spróbuj dodać 31. → oczekiwany redirect `/dashboard?error=` z komunikatem o limicie; liczba pozycji nadal 30.

## References

- Roadmap: `context/foundation/roadmap.md` (S-04)
- Serwis: `src/lib/services/items.ts`
- Plan/profil: `profiles.plan` (F-01)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Limit planu free + komunikat

#### Automated
- [x] 1.1 Unit-testy przechodzą: `npm run test:unit` — 85d938b
- [x] 1.2 Typecheck przechodzi: `npx astro check` — 85d938b
- [x] 1.3 Linting przechodzi: `npm run lint` — 85d938b
- [x] 1.4 Build przechodzi: `npm run build` — 85d938b

#### Manual
- [x] 1.5 Przy 30 aktywnych pozycjach 31. pokazuje komunikat o limicie, pozycja nie powstaje — 85d938b
