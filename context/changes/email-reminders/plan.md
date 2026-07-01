# Przypomnienia mailowe — Implementation Plan

## Overview

Per pozycja użytkownik może ustawić **jedno** przypomnienie na konkretną **datę + godzinę** (dokładność do
godziny). Cyklicznie (co godzinę) harmonogram znajduje należne przypomnienia aktywnych pozycji, wysyła
mail (Resend) i **zeruje `reminder_at`** — z perspektywy użytkownika przypomnienie znika. Model 2-stanowy:
pozycja albo ma przypomnienie, albo nie; bez edycji (usuń i ustaw od nowa).

## Current State Analysis

- `items` nie ma pola przypomnienia. Migracja doda `reminder_at timestamptz null`.
- `src/pages/api/items/[id].ts`: rozgałęzia po `_action` (update/delete/done/undone, PRG) — dołożymy `set-reminder` i `clear-reminder`.
- `src/lib/services/items.ts`: cienkie operacje na RLS — dołożymy `setReminder`/`clearReminder`.
- `src/pages/dashboard.astro`: akcje per pozycja (Edytuj/Załatwione/Usuń) — dołożymy stan przypomnienia (ustaw/usuń).
- **Worker** ma tylko `SUPABASE_URL`+`SUPABASE_KEY` (anon). Wysyłka do wszystkich (RLS bypass) wymaga service-role; dojdą sekrety `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`.
- **Resend** skonfigurowany jako SMTP Supabase; do własnej wysyłki użyjemy Resend API (klucz jako sekret Workera). Sandbox → tylko `stasiuklge@gmail.com`.
- **CI/CD**: `.github/workflows/{ci,deploy}.yml` — dołożymy `reminders.yml` (schedule co godzinę) wołający endpoint.

### Key Discoveries:
- Silnik pilności (`urgency.ts:computeCloseDate/daysUntil`) policzy termin i dni do zamknięcia dla treści maila — reuse.
- `datetime`/`hour` to „naiwny" czas Warszawy → konwersja do UTC musi uwzględniać DST (UTC+1/+2). Izolujemy w czystej funkcji z `Intl` (timeZone `Europe/Warsaw`).
- Astro `env.schema` (astro.config.mjs) deklaruje sekrety serwera — dodamy tam nowe pola (`access: "secret"`).

## Desired End State

Na dashboardzie przy pozycji bez przypomnienia jest „Ustaw przypomnienie" (data + godzina); po ustawieniu
widnieje „🔔 <data> <godz>" + „Usuń przypomnienie". Co godzinę cron wysyła maile dla należnych, aktywnych
pozycji (nazwa, termin, dni, kwota, link), po czym przypomnienie znika (`reminder_at=null`). Logika
konwersji strefy, wyboru należnych i treści maila pokryta unit-testami; realna wysyłka zweryfikowana
manualnie na `stasiuklge@gmail.com`.

## What We're NOT Doing

- Edycji przypomnienia (tylko usuń + ustaw od nowa) ani wielu przypomnień na pozycję (tylko 1).
- Flagi „wysłane" w bazie — po wysyłce zerujemy `reminder_at`.
- Przypomnień powtarzalnych / cyklicznych.
- Precyzji do minuty (dokładność do godziny, cron co godzinę).
- Wysyłki do obcych adresów — sandbox Resend (tylko własny mail) do czasu domeny (osobny temat).
- Podpowiadania domyślnej daty przypomnienia — pole opcjonalne, domyślnie puste.

## Implementation Approach

`reminder_at` (timestamptz) trzyma moment wysyłki w UTC. Ustawienie: front podaje datę + godzinę (Warszawa),
serwer konwertuje do UTC czystą funkcją (DST-aware) i zapisuje. Zerowanie/usuwanie ustawia null. Harmonogram:
GitHub Actions `schedule` co godzinę woła `POST /api/cron/send-reminders` z nagłówkiem `CRON_SECRET`; endpoint
klientem service-role czyta aktywne pozycje z `reminder_at <= now()`, wysyła Resend API i ustawia `reminder_at=null`.
Czyste funkcje (konwersja strefy, „czy należne", budowa maila) są testowane w CI; wysyłka manualnie.

## Critical Implementation Details

- **Strefa czasu (DST):** konwersja „data+godzina Warszawy → UTC" musi uwzględniać, że Polska jest UTC+1 zimą i UTC+2 latem. Wyznaczyć offset dla danej daty przez `Intl.DateTimeFormat(..., { timeZone: "Europe/Warsaw" })` i odjąć od wall-time. Izolowane w czystej funkcji z testami progów DST.
- **Bezpieczeństwo endpointu cron:** `/api/cron/send-reminders` nie może być publiczny — porównanie stałym `CRON_SECRET` z nagłówka; brak/niezgodny → 401. Endpoint używa service-role (RLS bypass), więc dostęp musi być ściśle bramkowany.

## Phase 1: Przypomnienia — dane + ustaw/usuń (UI)

### Overview
Użytkownik może ustawić i usunąć przypomnienie per pozycja; dane i konwersja strefy gotowe pod harmonogram.

### Changes Required:

#### 1. Migracja: pole przypomnienia
**File**: `supabase/migrations/<ts>_add_reminder_at.sql`
**Intent**: dodać opcjonalny moment przypomnienia do pozycji.
**Contract**: `alter table public.items add column reminder_at timestamptz;` (null = brak przypomnienia). RLS już pokrywa wiersz (existing policies). Zastosować lokalnie i na prod (Management API).

#### 2. Konwersja strefy (czysta funkcja)
**File**: `src/lib/reminders.ts`
**Intent**: zamienić „naiwną" datę+godzinę Warszawy na moment UTC (ISO), DST-aware.
**Contract**: `export function warsawWallTimeToUTC(dateISO: string, hour: number): string` — zwraca ISO UTC dla podanej daty (YYYY-MM-DD) i godziny 0–23 traktowanych jako Europe/Warsaw. Używa `Intl` do offsetu.

#### 3. Operacje serwisu
**File**: `src/lib/services/items.ts`
**Intent**: ustawić/wyczyścić `reminder_at` (RLS wymusza własność).
**Contract**: `setReminder(supabase, id, reminderAtUTC: string): Promise<{error?}>` (`update reminder_at`); `clearReminder(supabase, id): Promise<{error?}>` (`update reminder_at=null`). Oba `.eq("id", id)`.

#### 4. Akcje w endpointcie pozycji
**File**: `src/pages/api/items/[id].ts`
**Intent**: obsłużyć `set-reminder` i `clear-reminder` w istniejącym rozgałęzieniu `_action` (PRG).
**Contract**: `set-reminder` czyta `reminder_date` (YYYY-MM-DD) + `reminder_hour` (0–23), waliduje, konwertuje `warsawWallTimeToUTC`, woła `setReminder`; `clear-reminder` → `clearReminder`. Sukces → `/dashboard`; błąd → `/dashboard?error=`.

#### 5. UI stanu przypomnienia (bez edycji)
**File**: `src/pages/dashboard.astro`
**Intent**: per aktywna pozycja pokazać stan i akcje ustaw/usuń.
**Contract**: gdy `reminder_at` null → mały formularz „Ustaw przypomnienie" (input `date` + `select` godzina 0–23) POST `_action=set-reminder`; gdy ustawione → „🔔 <data> <godz> (czas polski)" + formularz „Usuń" `_action=clear-reminder`. Wyświetlaną datę/godzinę liczymy z `reminder_at` w strefie Warszawy.

### Success Criteria:

#### Automated Verification:
- Unit-testy przechodzą (w tym konwersja strefy, progi DST): `npm run test:unit`
- Integration RLS (setReminder/clearReminder tylko własne): `npm run test:integration`
- Typecheck: `npx astro check`
- Lint: `npm run lint`
- Build: `npm run build`

#### Manual Verification:
- Ustawienie przypomnienia na pozycji pokazuje „🔔 <data> <godz>"; „Usuń" wraca do „Ustaw przypomnienie".
- Wyświetlana godzina zgadza się z wpisaną (czas polski).

**Implementation Note**: zatrzymaj się na potwierdzenie po automatycznych checkach przed Fazą 2.

## Phase 2: Harmonogram wysyłki

### Overview
Cykliczna wysyłka należnych przypomnień i zerowanie po wysłaniu.

### Changes Required:

#### 1. Logika należności + treść maila (czyste funkcje)
**File**: `src/lib/reminders.ts`
**Intent**: zdecydować, które przypomnienia są należne, i zbudować treść maila.
**Contract**: `isReminderDue(reminderAt: string | null, statusZalatwione: boolean, now: Date): boolean` — true gdy `reminderAt` niepuste, `<= now` i pozycja aktywna. `buildReminderEmail(item, closeDateISO, daysLeft): { subject: string; html: string }` — nazwa, termin, dni do zamknięcia, kwota (PLN), link do `/dashboard`.

#### 2. Testy czystych funkcji
**File**: `tests/unit/reminders.test.ts`
**Intent**: pokryć konwersję strefy (zima/lato), należność (przyszłość/przeszłość/załatwione/null) i treść maila.
**Contract**: przypadki progów DST; `isReminderDue` warianty; `buildReminderEmail` zawiera kluczowe pola.

#### 3. Sekrety środowiska
**File**: `astro.config.mjs`
**Intent**: zadeklarować nowe sekrety serwera używane przez endpoint cron.
**Contract**: `env.schema` += `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `CRON_SECRET` (`context: "server", access: "secret", optional: true`). Ustawić jako sekrety Workera (`wrangler secret put`).

#### 4. Endpoint wysyłki (chroniony)
**File**: `src/pages/api/cron/send-reminders.ts`
**Intent**: znaleźć należne przypomnienia wszystkich userów, wysłać maile, wyzerować `reminder_at`.
**Contract**: `export const prerender = false;` `POST`. Sprawdza nagłówek `Authorization: Bearer <CRON_SECRET>` (niezgodny → 401). Klient **service-role** (`SUPABASE_SERVICE_KEY`, RLS bypass) czyta `items` z `reminder_at <= now()` i `status_zalatwione=false`. Dla każdej: pobiera e-mail usera (`auth.admin` / `profiles`), liczy termin/dni (`urgency`), buduje mail, wysyła Resend API (`onboarding@resend.dev`), po sukcesie `update reminder_at=null`. Zwraca JSON `{ sent, failed }`. Odporny na pojedyncze błędy wysyłki (nie blokuje reszty).

#### 5. GitHub Actions cron
**File**: `.github/workflows/reminders.yml`
**Intent**: co godzinę wołać endpoint wysyłki.
**Contract**: `on.schedule: cron "0 * * * *"` + `workflow_dispatch`; krok `curl -X POST` na `https://zwrotnik.zwrotnik-app.workers.dev/api/cron/send-reminders` z `Authorization: Bearer ${{ secrets.CRON_SECRET }}`. Sekret `CRON_SECRET` w repo.

### Success Criteria:

#### Automated Verification:
- Unit-testy (należność, strefa, treść maila): `npm run test:unit`
- Typecheck: `npx astro check`
- Lint: `npm run lint`
- Build: `npm run build`
- Endpoint bez/na złym `CRON_SECRET` → 401 (curl smoke)

#### Manual Verification:
- Ustaw przypomnienie na najbliższą pełną godzinę → po przebiegu (lub ręcznym `workflow_dispatch`) mail dochodzi na `stasiuklge@gmail.com`.
- Po wysłaniu przypomnienie znika z pozycji (`reminder_at=null`).
- Pozycja załatwiona z przypomnieniem → mail NIE wychodzi.

**Implementation Note**: zatrzymaj się na ręczne potwierdzenie przed zamknięciem planu.

## Testing Strategy

### Unit Tests:
- `warsawWallTimeToUTC`: dzień zimowy (UTC+1) i letni (UTC+2) → poprawny UTC.
- `isReminderDue`: przyszłość → false; przeszłość+aktywne → true; przeszłość+załatwione → false; null → false.
- `buildReminderEmail`: zawiera nazwę, datę zamknięcia, dni, kwotę, link.

### Integration Tests:
- RLS: `setReminder`/`clearReminder` działają tylko na własnych pozycjach (rozszerzenie `rls.items.test.ts`).

### Manual Testing Steps:
1. Ustaw przypomnienie na najbliższą godzinę dla pozycji; sprawdź wyświetlaną godzinę.
2. Odpal `reminders.yml` (workflow_dispatch) lub poczekaj na pełną godzinę → mail na `stasiuklge@gmail.com`.
3. Sprawdź, że pozycja nie ma już przypomnienia.
4. Ustaw przypomnienie, oznacz pozycję „Załatwione" → mail nie wychodzi.

## Migration Notes

- Migracja SQL: `add column reminder_at timestamptz` — zastosować lokalnie (`supabase migration up`) i na prod (Management API query).
- Sekrety Workera (`wrangler secret put`): `SUPABASE_SERVICE_KEY` (prod service_role), `RESEND_API_KEY`, `CRON_SECRET` (losowy). Sekret `CRON_SECRET` też w repo (dla Actions).
- Rollback: usunięcie `reminders.yml` zatrzymuje wysyłkę; kolumna może zostać (nieużywana).

## References
- Endpoint pozycji: `src/pages/api/items/[id].ts`
- Serwis/RLS: `src/lib/services/items.ts`, `tests/integration/rls.items.test.ts`
- Silnik terminu: `src/lib/urgency.ts`
- Wzorzec deploy/secrets: `.github/workflows/deploy.yml`, `wrangler.jsonc`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Przypomnienia — dane + ustaw/usuń (UI)

#### Automated
- [x] 1.1 Unit-testy przechodzą (konwersja strefy, progi DST): `npm run test:unit` — 8e4fe60
- [x] 1.2 Integration RLS (setReminder/clearReminder tylko własne): `npm run test:integration` — 8e4fe60
- [x] 1.3 Typecheck: `npx astro check` — 8e4fe60
- [x] 1.4 Lint: `npm run lint` — 8e4fe60
- [x] 1.5 Build: `npm run build` — 8e4fe60

#### Manual
- [x] 1.6 Ustaw/usuń przypomnienie na pozycji działa; wyświetlana godzina zgodna z wpisaną (czas polski) — zweryf. mechanicznie na prod

### Phase 2: Harmonogram wysyłki

#### Automated
- [x] 2.1 Unit-testy (należność, strefa, treść maila): `npm run test:unit`
- [x] 2.2 Typecheck: `npx astro check`
- [x] 2.3 Lint: `npm run lint`
- [x] 2.4 Build: `npm run build`
- [ ] 2.5 Endpoint bez/na złym `CRON_SECRET` → 401 (curl smoke)

#### Manual
- [ ] 2.6 Przypomnienie na najbliższą godzinę → mail dochodzi na `stasiuklge@gmail.com`
- [ ] 2.7 Po wysłaniu przypomnienie znika (`reminder_at=null`)
- [ ] 2.8 Pozycja załatwiona z przypomnieniem → mail nie wychodzi
