# First Urgency Loop (S-01) — Implementation Plan

## Overview

North star produktu: użytkownik dodaje zakup i natychmiast widzi go na liście pogrupowanej według
pilności (Pilne / Wkrótce / Spokojnie / Minęło), z liczbą pozostałych dni, kwotą i sumą „Zagrożone".
Sercem jest deterministyczny **silnik pilności** (czysta funkcja) — zarazem nasz pierwszy unit-test
przyjazny CI (bez Supabase). Reszta to serwis danych, walidacja zod, API create i server-rendered strona.

## Current State Analysis

- Fundament F-01 gotowy: tabela `items` (+ `profiles`) z RLS „tylko własne", typy `Database`
  (`src/db/database.types.ts`), otypowany klient (`src/lib/supabase.ts:createClient`).
- Astro 6 SSR (`output: "server"`), React 19 islands, Tailwind 4. `src/middleware.ts` ustawia
  `context.locals.user`; `PROTECTED_ROUTES = ["/dashboard"]` — strona `/dashboard` jest już chroniona.
- Konwencje (`CLAUDE.md`): API routes eksportują `GET`/`POST` + `export const prerender = false`,
  walidacja wejścia przez zod; typy współdzielone w `src/types.ts`; serwisy/logika w `src/lib/services/`;
  React tylko gdy potrzebna interaktywność; łączenie klas przez `cn()`.
- Runner testów: Vitest (skonfigurowany w F-01), `npm test`.

### Key Discoveries:
- `src/pages/dashboard.astro` istnieje jako placeholder chronionej strony — tu osadzimy formularz + listę.
- Klient Supabase tworzony per request: `createClient(Astro.request.headers, Astro.cookies)` — RLS sam
  ogranicza wynik do zalogowanego użytkownika, więc serwis NIE filtruje po `user_id` ręcznie (poza insertem).
- `kwota` to `numeric(12,2)` → w TS przychodzi jako `number`; `data_odniesienia` jako `string` (ISO date).

## Desired End State

Zalogowany użytkownik na `/dashboard` widzi formularz dodawania (nazwa, sklep, kwota, data, typ okna)
i listę swoich pozycji pogrupowaną w kubełki pilności, posortowaną w kubełku wg kwoty malejąco, z sumą
„Zagrożone" na górze. Dodanie pozycji z błędnymi danymi pokazuje komunikat walidacji; pusta lista pokazuje
zachętę do dodania. Silnik pilności jest pokryty unit-testami uruchamianymi przez `npm test`.

## What We're NOT Doing

- Edycja, usuwanie, oznaczanie „Załatwione" — to S-03 (tu pozycje są tylko tworzone i listowane).
- Limit 30 pozycji i płatności — S-04 / wersja 2.
- Powiadomienia, auto-parsowanie maili — wersja 2.
- Interaktywna wyspa React / optymistyczne UI — świadomie server-rendered + reload (cel: speed).

## Critical Implementation Details

- **`new Date()` wstrzykiwane, nie wywoływane w silniku.** `buildUrgencyView(items, today)` przyjmuje
  `today` jako argument — inaczej testy progów statusów byłyby niedeterministyczne (zależne od dnia uruchomienia).
- **PRG (post-redirect-get) dla formularza.** API POST po sukcesie robi redirect 303 na `/dashboard`,
  po błędzie walidacji redirect na `/dashboard?error=<kod>` — strona odczytuje błąd z query. Zapobiega to
  podwójnemu wysłaniu przy odświeżeniu.

## Implementation Approach

Najpierw czysty rdzeń (silnik + typy + testy) — w pełni weryfikowalny bez bazy, idealny do CI. Potem wpięcie
w dane (serwis na otypowanym kliencie, RLS robi izolację), API create z walidacją zod i server-rendered
stronę z formularzem i listą. Liczby/daty liczone po stronie serwera; zero JS klienta w v1.

## Phase 1: Silnik pilności + typy + unit-testy

### Overview
Czysta logika domenowa i jej pełne pokrycie testami — bez zależności od Supabase.

### Changes Required:

#### 1. Typy współdzielone
**File**: `src/types.ts`
**Intent**: nazwane typy domenowe używane przez silnik, serwis i UI.
**Contract**: `WindowType = "zwrot" | "rekojmia" | "subskrypcja"`; `UrgencyStatus = "pilne" | "wkrotce" | "spokojnie" | "minelo"`; `Item` = wiersz z `Database["public"]["Tables"]["items"]["Row"]`; `ItemView = Item & { dataZamkniecia: string; dniDoZamkniecia: number; status: UrgencyStatus }`; `UrgencyView = { buckets: Record<UrgencyStatus, ItemView[]>; sumaZagrozona: number }`.

#### 2. Silnik pilności
**File**: `src/lib/urgency.ts`
**Intent**: czyste funkcje liczące datę zamknięcia, dni, status oraz budujące widok (kubełki + sort + suma).
**Contract**: funkcje `computeCloseDate(item)`, `daysUntil(closeDateISO, today)`, `statusForDays(days)`,
`buildUrgencyView(items, today): UrgencyView`. Reguły (kontrakt, na nim opierają się testy i UI):

```ts
const DEFAULT_RETURN_DAYS = 14;     // zwrot
const REKOJMIA_DAYS = 730;          // 2 lata
// data zamknięcia:
//   zwrot       -> data_odniesienia + (dlugosc_okna_dni ?? DEFAULT_RETURN_DAYS)
//   rekojmia    -> data_odniesienia + REKOJMIA_DAYS
//   subskrypcja -> data_odniesienia (data odnowienia jest datą zamknięcia)
// status wg dni do zamknięcia:
//   dni < 0  -> "minelo" | 0..3 -> "pilne" | 4..14 -> "wkrotce" | >14 -> "spokojnie"
// buildUrgencyView: pomija pozycje status_zalatwione=true; w kubełku sort wg kwota malejąco;
//   sumaZagrozona = suma kwota po pozycjach o statusie "pilne" lub "wkrotce".
```

#### 3. Unit-testy silnika
**File**: `tests/urgency.test.ts`
**Intent**: zabezpieczyć reguły biznesowe (ryzyko R1 z test-planu: zły status/kolejność = utrata pieniędzy).
**Contract**: testy z wstrzykniętym `today` (deterministyczne) pokrywające: granice progów statusu
(dni −1/0/3/4/14/15), datę zamknięcia dla każdego typu okna (w tym override `dlugosc_okna_dni`), sort wg
kwoty malejąco w kubełku, sumę „Zagrożone" (pilne+wkrótce, z pominięciem spokojnie/minęło), pominięcie
pozycji `status_zalatwione`.

### Success Criteria:

#### Automated Verification:
- Unit-testy silnika przechodzą: `npm test`
- Typecheck przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

**Implementation Note**: po przejściu automatycznej weryfikacji zatrzymaj się na potwierdzenie przed Fazą 2.

---

## Phase 2: Dane + API + UI (server-rendered)

### Overview
Wpięcie silnika w realny przepływ: serwis na otypowanym kliencie, walidacja zod, API create i chroniona
strona z formularzem (3 typy okien) oraz listą pogrupowaną z sumą.

### Changes Required:

#### 1. Serwis pozycji + schemat walidacji
**File**: `src/lib/services/items.ts`
**Intent**: odczyt aktywnych pozycji użytkownika i tworzenie nowej z walidacją.
**Contract**: `itemInputSchema` (zod): `nazwa` (string, min 1), `sklep` (string opcjonalny), `kwota`
(number > 0), `data_odniesienia` (ISO date string), `typ_okna` (enum 3 wartości), `dlugosc_okna_dni`
(int dodatni, opcjonalny). `listActiveForUser(supabase): Promise<Item[]>` (select `status_zalatwione=false`;
RLS ogranicza do usera). `createItem(supabase, userId, input): Promise<{ error?: string }>` (waliduje,
wstawia `user_id=userId`).

#### 2. API tworzenia pozycji
**File**: `src/pages/api/items/index.ts`
**Intent**: przyjąć POST formularza, zwalidować i utworzyć pozycję, PRG-redirect.
**Contract**: `export const prerender = false`; `POST({ request, locals, redirect })`: jeśli brak
`locals.user` → 401/redirect do logowania; sparsuj `formData`, zbuduj klient, `createItem`; sukces →
`redirect("/dashboard", 303)`; błąd walidacji → `redirect("/dashboard?error=<kod>", 303)`.

#### 3. Strona dashboard (formularz + lista)
**File**: `src/pages/dashboard.astro`
**Intent**: server-side pobranie pozycji, zbudowanie widoku silnikiem, render listy + sumy + formularza.
**Contract**: pobierz `items = listActiveForUser(supabase)`, `view = buildUrgencyView(items, new Date())`;
wyrenderuj sumę „Zagrożone", cztery kubełki (Pilne/Wkrótce/Spokojnie/Minęło) z pozycjami (nazwa, sklep,
kwota, dni, status), pusty stan przy braku pozycji; formularz POST→`/api/items` z polami i `<select>` typu
okna (3 wartości); komunikat błędu z `Astro.url.searchParams.get("error")`. Klasy łączone przez `cn()`.

*(Bez zmian w `src/middleware.ts` — `/dashboard` jest już w `PROTECTED_ROUTES`.)*

### Success Criteria:

#### Automated Verification:
- Typecheck przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`
- Unit-testy nadal przechodzą: `npm test`

#### Manual Verification:
- Dodanie pozycji każdego z 3 typów okien pojawia się we właściwym kubełku z poprawnymi dniami i kwotą.
- Suma „Zagrożone" zgadza się (pilne + wkrótce).
- Błędne dane (ujemna kwota / brak daty) pokazują komunikat walidacji, pozycja nie powstaje.
- Pusta lista pokazuje zachętę do dodania, nie pustą stronę.

**Implementation Note**: zatrzymaj się na ręczne potwierdzenie przed zamknięciem planu.

---

## Testing Strategy

### Unit Tests:
- Silnik pilności: progi statusów (granice), data zamknięcia per typ okna, sort wg kwoty, suma „Zagrożone", pominięcie załatwionych.

### Integration Tests:
- Brak nowych w S-01 (test RLS z F-01 nadal obowiązuje). Test integracyjny tworzenia pozycji świadomie pominięty (wymaga Supabase, poza CI).

### Manual Testing Steps:
1. `npm run db:start` (jeśli nie działa), `npm run dev`, zaloguj się.
2. Dodaj pozycję typu zwrot z datą sprzed 12 dni → status „Wkrótce" (zostały 2 dni), kwota w sumie „Zagrożone".
3. Dodaj rękojmię (data sprzed roku) → „Spokojnie"; subskrypcję z datą odnowienia jutro → „Pilne".
4. Wyślij formularz z ujemną kwotą → komunikat błędu, brak nowej pozycji.

## Performance Considerations

Lista per użytkownik jest mała (limit docelowo 30); brak paginacji w MVP. Silnik liczy O(n) + sort.

## Migration Notes

Brak nowych migracji — schemat z F-01 wystarcza.

## References

- Roadmap: `context/foundation/roadmap.md` (S-01)
- Fundament: `context/archive/2026-06-29-items-schema-rls/plan.md`
- Klient/typy: `src/lib/supabase.ts`, `src/db/database.types.ts`
- Konwencje: `CLAUDE.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Silnik pilności + typy + unit-testy

#### Automated
- [x] 1.1 Unit-testy silnika przechodzą: `npm test` — 0d34b4f
- [x] 1.2 Typecheck przechodzi: `npx astro check` — 0d34b4f
- [x] 1.3 Linting przechodzi: `npm run lint` — 0d34b4f

### Phase 2: Dane + API + UI

#### Automated
- [x] 2.1 Typecheck przechodzi: `npx astro check` — df8eaac
- [x] 2.2 Linting przechodzi: `npm run lint` — df8eaac
- [x] 2.3 Build przechodzi: `npm run build` — df8eaac
- [x] 2.4 Unit-testy nadal przechodzą: `npm test` — df8eaac

#### Manual
- [x] 2.5 Dodanie pozycji 3 typów → właściwy kubełek, dni i kwota poprawne — df8eaac
- [x] 2.6 Suma „Zagrożone" zgadza się (pilne + wkrótce) — df8eaac
- [x] 2.7 Błędne dane pokazują komunikat walidacji, pozycja nie powstaje — df8eaac
- [x] 2.8 Pusta lista pokazuje zachętę do dodania — df8eaac
