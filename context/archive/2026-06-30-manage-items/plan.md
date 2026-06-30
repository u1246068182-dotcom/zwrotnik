# Zarządzanie pozycjami (S-03) — Implementation Plan

## Overview

Pełny CRUD na istniejących pozycjach: **edycja** (osobna strona SSR), **usuwanie** (z `window.confirm`)
oraz **„Załatwione" / „Przywróć"** (przełączanie flagi `status_zalatwione`). Po każdej operacji lista wg
pilności i suma „Zagrożone" są aktualne — silnik pilności (`urgency.ts`) przelicza status/dni/kwotę przy
każdym odczycie, więc edycja nie wymaga osobnego przeliczania.

## Current State Analysis

- `src/lib/services/items.ts`: `listActiveForUser` (czyta aktywne) + `createItem` (zod `itemInputSchema` + insert). Brak update/delete/markDone.
- `src/pages/api/items/index.ts`: `POST` w stylu PRG (sukces → `/dashboard`, błąd → `/dashboard?error=`). Wzorzec do powielenia dla mutacji.
- `src/pages/dashboard.astro`: renderuje aktywne pozycje w kubełkach, sumę „Zagrożone", formularz dodawania, błąd z `?error=`. Brak akcji na pozycji.
- `supabase/migrations/...init_items.sql`: polityki RLS `items_update` i `items_delete` + `grant ... update, delete on public.items to authenticated` **już istnieją** → DB gotowe, zero migracji.
- `status_zalatwione` (boolean, default false) istnieje w `items`; `listActiveForUser` filtruje `status_zalatwione = false` → „Załatwione" = ustawienie flagi `true`, „Przywróć" = `false`.

### Key Discoveries:
- HTML formularze wspierają tylko GET/POST → mutacje (update/delete/done/undone) jako `POST` z polem `_action` na jeden dynamiczny route `/api/items/[id]`.
- Edycja używa tych samych pól co dodawanie → reuse `itemInputSchema` (już testowany w `tests/unit/items.schema.test.ts`).
- RLS wymusza własność: `update/delete` z `.eq("id", id)` dotykają 0 wierszy, gdy pozycja nie należy do usera — izolacja po stronie bazy, do potwierdzenia testem integration.
- Silnik pilności liczy „przy odczycie" → po edycji wystarczy redirect na `/dashboard`, status/dni/kwota przeliczą się same.

## Desired End State

Zalogowany użytkownik na `/dashboard` przy każdej aktywnej pozycji ma: **Edytuj** (→ strona edycji z
formularzem prefill), **Załatwione** (znika z aktywnej listy i sumy) oraz **Usuń** (po `confirm` kasuje
rekord). Osobna sekcja „Załatwione" na dole listuje załatwione pozycje z akcją **Przywróć** (wraca do
aktywnej listy). Mutacje działają wyłącznie na własnych pozycjach (RLS). Edycja waliduje wejście jak
dodawanie; błędy wracają przez `?error=`.

## What We're NOT Doing

- Twardego usuwania przy „Załatwione" — to soft-hide flagą (zgodnie ze schematem i domyślną decyzją PRD §Open Q2).
- Edycji inline na dashboardzie (React island) — edycja to osobna strona SSR.
- Edycji długości okna zwrotu jako osobnej funkcji (FR-012) — pole `dlugosc_okna_dni` jest już w formularzu, ale FR-012 jako odrębny temat zostaje poza zakresem.
- Masowych operacji (zaznacz wiele), paginacji, historii zmian.

## Implementation Approach

Warstwa serwisu dostaje trzy nowe, cienkie operacje na bazie (`updateItem`, `deleteItem`, `setDone`),
każda polegająca na RLS dla izolacji własności. Jeden dynamiczny route `POST /api/items/[id]` rozgałęzia
się po `_action` (`update` | `delete` | `done` | `undone`) i stosuje PRG. UI: osobna strona edycji (SSR,
formularz prefill) + przyciski-formularze przy pozycjach na dashboardzie i nowa sekcja „Załatwione".
Testy: integration RLS (mutacje tylko na własnych pozycjach — główne ryzyko bezpieczeństwa) + unit, że
edycja odrzuca niepoprawne wejście przed dotknięciem bazy.

## Phase 1: Serwis mutacji + API route + testy

### Overview
Logika i bezpieczeństwo: trzy operacje serwisu, jeden dynamiczny route mutacji, pokrycie testami zanim powstanie UI.

### Changes Required:

#### 1. Operacje serwisu
**File**: `src/lib/services/items.ts`
**Intent**: dodać edycję, usuwanie i przełączanie flagi „Załatwione"; edycja waliduje wejście jak `createItem`.
**Contract**:
- `listDoneForUser(supabase): Promise<Item[]>` — pozycje `status_zalatwione = true`, sort `created_at` malejąco.
- `updateItem(supabase, id, raw): Promise<{ error?: string }>` — `itemInputSchema.safeParse(raw)`; przy błędzie zwraca komunikat; w sukcesie `update` pól (nazwa, sklep, kwota, data_odniesienia, typ_okna, dlugosc_okna_dni) `.eq("id", id)` (RLS wymusza własność). **Nie** zmienia `user_id` ani `status_zalatwione`.
- `deleteItem(supabase, id): Promise<{ error?: string }>` — `delete().eq("id", id)`.
- `setDone(supabase, id, done: boolean): Promise<{ error?: string }>` — `update({ status_zalatwione: done }).eq("id", id)`.

#### 2. Dynamiczny route mutacji
**File**: `src/pages/api/items/[id].ts`
**Intent**: jeden endpoint POST obsługujący wszystkie mutacje pojedynczej pozycji, PRG jak w `api/items/index.ts`.
**Contract**: `export const prerender = false;` + `POST`. Bez `locals.user` → redirect `/auth/signin`. Czyta `params.id` i pole `_action` z formData: `update` → `updateItem` (czyta pozostałe pola formularza jak `index.ts`, z helperem `opt`); `delete` → `deleteItem`; `done` → `setDone(true)`; `undone` → `setDone(false)`; nieznane `_action` → błąd. Sukces → redirect `/dashboard`; błąd → `/dashboard?error=` (dla `update` można wrócić na stronę edycji z błędem — patrz Faza 2).

#### 3. Testy integration (RLS) + unit (walidacja edycji)
**File**: `tests/integration/rls.items.test.ts` (rozszerzenie), `tests/unit/items.update.test.ts` (nowy)
**Intent**: potwierdzić izolację własności przy mutacjach (główne ryzyko) oraz że edycja odrzuca niepoprawne wejście bez dotykania bazy.
**Contract**:
- Integration (lokalny Supabase): user B nie może `updateItem` / `deleteItem` / `setDone` pozycji usera A (operacja dotyka 0 wierszy, dane A bez zmian); właściciel może.
- Unit: `updateItem` z niepoprawnym wejściem (np. ujemna kwota, zła data) zwraca `{ error }` i **nie** wywołuje `.update` na kliencie (stub Supabase, którego metody mutujące nie są osiągane).

### Success Criteria:

#### Automated Verification:
- Unit-testy przechodzą: `npm run test:unit`
- Integration-testy przechodzą lokalnie: `npm run test:integration`
- Typecheck przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:
- (przeniesione do Fazy 2 — w Fazie 1 brak UI; mutacje weryfikujemy testami i smoke'em przez curl)

**Implementation Note**: zatrzymaj się na potwierdzenie po automatycznych checkach przed Fazą 2.

---

## Phase 2: UI — strona edycji + akcje na dashboardzie

### Overview
Wystawienie operacji użytkownikowi: strona edycji, przyciski przy pozycjach, sekcja „Załatwione".

### Changes Required:

#### 1. Strona edycji
**File**: `src/pages/items/[id]/edit.astro`
**Intent**: SSR strona z formularzem prefill do edycji jednej pozycji.
**Contract**: ładuje pozycję po `params.id` (RLS → tylko własna; brak → redirect `/dashboard?error=`); renderuje ten sam zestaw pól co formularz dodawania, wypełniony wartościami pozycji (w tym wybrany `typ_okna`); `POST` na `/api/items/[id]` z ukrytym `_action=update`. Link „Anuluj" wraca na `/dashboard`. Błąd edycji pokazywany przez `?error=`.

#### 2. Akcje na dashboardzie + sekcja „Załatwione"
**File**: `src/pages/dashboard.astro`
**Intent**: przy każdej aktywnej pozycji akcje Edytuj/Załatwione/Usuń; nowa sekcja listująca załatwione z Przywróć.
**Contract**:
- Import `listDoneForUser`; pobierz `doneItems` obok aktywnych.
- Przy każdej aktywnej pozycji: link **Edytuj** (`/items/[id]/edit`); mały formularz `POST /api/items/[id]` z `_action=done` (**Załatwione**); formularz z `_action=delete` i `onsubmit="return confirm('Usunąć pozycję? Tej operacji nie można cofnąć.')"` (**Usuń**).
- Nowa sekcja **„Załatwione"** na dole (gdy `doneItems.length > 0`): pozycje wyszarzone, z formularzem `_action=undone` (**Przywróć**) i opcjonalnie **Usuń**.

### Success Criteria:

#### Automated Verification:
- Typecheck przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:
- Edycja kwoty/daty/typu okna z poziomu strony edycji zmienia status/dni/kwotę na liście i sumę „Zagrożone".
- „Załatwione" usuwa pozycję z aktywnej listy i sumy oraz pokazuje ją w sekcji „Załatwione"; „Przywróć" wraca ją na listę.
- „Usuń" po potwierdzeniu kasuje pozycję; anulowanie `confirm` nic nie zmienia.
- Próba wejścia na `/items/[cudzy-id]/edit` nie pokazuje cudzej pozycji.

**Implementation Note**: zatrzymaj się na ręczne potwierdzenie przed zamknięciem planu.

---

## Testing Strategy

### Unit Tests:
- `updateItem` odrzuca niepoprawne wejście (kwota ≤ 0, zła data) i nie wywołuje mutacji na kliencie.
- (istniejące `items.schema.test.ts` pokrywają kontrakt walidacji wspólny dla dodawania i edycji.)

### Integration Tests (lokalny Supabase, poza CI):
- Izolacja RLS: user B nie modyfikuje/usuwa/„załatwia" pozycji usera A; właściciel może.

### Manual Testing Steps:
1. Zaloguj się, dodaj pozycję, kliknij **Edytuj**, zmień kwotę/datę/typ → sprawdź przeliczony status/dni i sumę.
2. Kliknij **Załatwione** → pozycja znika z listy i sumy, pojawia się w sekcji „Załatwione"; **Przywróć** → wraca.
3. Kliknij **Usuń**, anuluj `confirm` (bez zmian), potem potwierdź (pozycja zniknęła).
4. Spróbuj otworzyć `/items/<id-innego-usera>/edit` → brak dostępu do cudzej pozycji.

## References

- Roadmap: `context/foundation/roadmap.md` (S-03)
- Serwis/PRG: `src/lib/services/items.ts`, `src/pages/api/items/index.ts`
- Migracja (RLS gotowe): `supabase/migrations/*_init_items.sql`
- Test RLS: `tests/integration/rls.items.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Serwis mutacji + API route + testy

#### Automated
- [x] 1.1 Unit-testy przechodzą: `npm run test:unit` — 09c647a
- [x] 1.2 Integration-testy przechodzą lokalnie: `npm run test:integration` — 09c647a
- [x] 1.3 Typecheck przechodzi: `npx astro check` — 09c647a
- [x] 1.4 Linting przechodzi: `npm run lint` — 09c647a
- [x] 1.5 Build przechodzi: `npm run build` — 09c647a

### Phase 2: UI — strona edycji + akcje na dashboardzie

#### Automated
- [x] 2.1 Typecheck przechodzi: `npx astro check` — 9d16d68
- [x] 2.2 Linting przechodzi: `npm run lint` — 9d16d68
- [x] 2.3 Build przechodzi: `npm run build` — 9d16d68

#### Manual
- [x] 2.4 Edycja kwoty/daty/typu zmienia status/dni/kwotę na liście i sumę „Zagrożone" — 9d16d68
- [x] 2.5 „Załatwione" usuwa z aktywnej listy/sumy i pokazuje w sekcji „Załatwione"; „Przywróć" wraca pozycję — 9d16d68
- [x] 2.6 „Usuń" po potwierdzeniu kasuje pozycję; anulowanie `confirm` nic nie zmienia — 9d16d68
- [x] 2.7 Wejście na `/items/[cudzy-id]/edit` nie pokazuje cudzej pozycji — 9d16d68
