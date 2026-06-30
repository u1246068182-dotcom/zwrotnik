# Zarządzanie pozycjami (S-03) — Plan Brief

> Full plan: `context/changes/manage-items/plan.md`

## What & Why

Domknięcie podstawowego cyklu życia pozycji: po dodaniu (S-01) użytkownik musi móc **edytować**,
**usunąć** i oznaczyć pozycję jako **„Załatwione"** (US-02, FR-008/009/010). Bez tego lista szybko
zaśmieca się nieaktualnymi pozycjami i traci wiarygodność sumy „Zagrożone".

## Starting Point

`createItem` + `listActiveForUser` istnieją; dashboard renderuje aktywne pozycje, sumę i formularz
dodawania. DB ma już polityki RLS `update`/`delete` i granty oraz kolumnę `status_zalatwione` (F-01) —
warstwa danych jest gotowa, S-03 to wyłącznie warstwa aplikacji.

## Desired End State

Przy każdej aktywnej pozycji na dashboardzie: **Edytuj** (osobna strona SSR z formularzem prefill),
**Załatwione** (znika z listy i sumy) i **Usuń** (po `confirm`). Sekcja „Załatwione" na dole z akcją
**Przywróć**. Edycja przelicza status/dni/kwotę; mutacje działają tylko na własnych pozycjach (RLS).

## Key Decisions Made

| Decyzja | Wybór | Dlaczego |
| --- | --- | --- |
| UX edycji | Osobna strona `/items/[id]/edit` (SSR) | Najprostsze i odporne, zero JS, spójne z resztą SSR |
| Routing mutacji | Jeden `POST /api/items/[id]` z polem `_action` | HTML wspiera tylko GET/POST; jeden plik zamiast czterech |
| „Załatwione" | Soft-hide flagą `status_zalatwione` | Zgodne ze schematem i domyślną decyzją PRD; odwracalne |
| Undo | Sekcja „Załatwione" + „Przywróć" | Pełniejszy UX, ochrona przed pomyłkowym „Załatwione" |
| Usuwanie | `window.confirm` przed POST | Jedna linia, chroni przed przypadkową utratą |
| Testy | Integration RLS (mutacje) + unit walidacji edycji | Pokrywa ryzyko izolacji własności i regresję walidacji |

## Scope

**In scope:** `updateItem`/`deleteItem`/`setDone`/`listDoneForUser` w serwisie; `POST /api/items/[id]`
(`update`/`delete`/`done`/`undone`); strona edycji; akcje + sekcja „Załatwione" na dashboardzie; testy.

**Out of scope:** twarde usuwanie przy „Załatwione", edycja inline (React), FR-012 jako odrębny temat,
operacje masowe, paginacja, historia zmian.

## Architecture / Approach

Cienkie operacje serwisu polegają na RLS dla izolacji własności (`.eq("id", id)`). Jeden dynamiczny route
rozgałęzia po `_action` i stosuje PRG (sukces → `/dashboard`, błąd → `?error=`). Silnik pilności liczy
przy odczycie, więc po edycji wystarczy redirect — przeliczenie jest darmowe.

## Phases at a Glance

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Serwis + API + testy | Mutacje, route `[id]`, integration RLS + unit walidacji | Izolacja własności przy update/delete (RLS) |
| 2. UI | Strona edycji, akcje na dashboardzie, sekcja „Załatwione" | Spójność stanu listy/sumy po operacji |

**Prerequisites:** S-01 (done); lokalny Supabase do integration-testów i smoke'u.
**Estimated effort:** ~1 sesja, 2 fazy.

## Open Risks & Assumptions

- Integration-testy wymagają lokalnego Supabase (poza CI) — jak istniejący `rls.items.test.ts`.
- `window.confirm` to natywny dialog — akceptowalny w MVP.

## Success Criteria (Summary)

- Edycja przelicza status/dni/kwotę i sumę „Zagrożone".
- „Załatwione" usuwa z aktywnej listy/sumy; „Przywróć" przywraca; „Usuń" po potwierdzeniu kasuje.
- Mutacje i edycja działają wyłącznie na własnych pozycjach (RLS, test integration).
