# Items Schema + RLS — Implementation Plan

## Overview

Fundament danych dla Zwrotnika (F-01). Tworzymy migrację Supabase z dwiema tabelami —
`profiles` (z polem `plan` pod przyszły limit/monetyzację) i `items` (pozycje, na których
działa silnik pilności) — wraz z politykami RLS, które dopuszczają operacje wyłącznie na
własnych rekordach użytkownika. Stawiamy lokalne środowisko Supabase do powtarzalnej
weryfikacji RLS i generujemy typy TS dla kodu aplikacji. To odblokowuje north star S-01.

## Current State Analysis

- Starter `10x-astro-starter`: Supabase SSR, klient w `src/lib/supabase.ts` (`createServerClient`,
  cookie-based), `src/middleware.ts` ustawia `context.locals.user`, env `SUPABASE_URL`/`SUPABASE_KEY`.
- `supabase/` zawiera tylko `config.toml` i `.gitignore` — **brak migracji**.
- Brak wygenerowanych typów bazy (`src/db/` nie istnieje).
- `package.json` ma `dev/build/preview/lint/format`; **brak skryptów db i typecheck**, brak runnera testów.
- Auth (rejestracja/logowanie e-mail+hasło) jest już zaimplementowane w starterze — tu go nie dotykamy.

### Key Discoveries:
- Klient Supabase: `src/lib/supabase.ts:5` (`createServerClient`) — podepniemy do niego typ `Database`.
- Middleware czyta usera: `src/middleware.ts:8` (`supabase.auth.getUser()`) — RLS oprze się o `auth.uid()`.
- Tożsamość użytkownika żyje w `auth.users` (Supabase) — `profiles.id` i `items.user_id` referują do niej.

## Desired End State

Po wykonaniu planu: lokalny Supabase stosuje migrację czysto (`supabase db reset`), w bazie istnieją
`profiles` i `items` z włączonym RLS; nowy użytkownik dostaje automatycznie wiersz w `profiles`
(plan `free`); typy `Database` są wygenerowane i podpięte do klienta; ręczna weryfikacja dwoma
użytkownikami potwierdza, że użytkownik A nie widzi ani nie zmienia pozycji użytkownika B.

## What We're NOT Doing

- Brak UI, formularzy i ścieżek API dla pozycji — to S-01.
- Brak silnika pilności (wyliczeń statusu/dni/kwoty) — to S-01.
- Brak egzekwowania limitu 30 pozycji i płatności — to S-04 / wersja 2.
- Brak wdrożenia migracji na hostowany/produkcyjny Supabase — robione później przy deployu.
- Brak konfiguracji runnera testów jednostkowych — pierwsze testy logiki wchodzą w S-01 / `/10x-test-plan`.

## Implementation Approach

Idziemy schematem „dane najpierw": jedna migracja SQL definiuje obie tabele, RLS i trigger
rejestracji; lokalny Supabase służy do zastosowania i weryfikacji; na końcu generujemy typy i
podpinamy je do istniejącego klienta. RLS jest sednem — to ono realizuje guardrail prywatności,
więc weryfikujemy je realnie dwoma użytkownikami, nie „na oko".

## Critical Implementation Details

- **Trigger rejestracji musi być `security definer`.** Funkcja wstawiająca wiersz do `profiles`
  po insertcie w `auth.users` działa w kontekście, który nie ma uprawnień do `auth`/RLS — bez
  `security definer` (i właściwego `search_path`) trigger cicho zawiedzie i nowi użytkownicy nie
  dostaną profilu.

## Phase 1: Lokalny Supabase + migracja schematu

### Overview
Skrypty db w `package.json`, jedna migracja SQL tworząca `profiles` i `items` z RLS i triggerem,
stosująca się czysto przez lokalny Supabase.

### Changes Required:

#### 1. Skrypty bazy danych
**File**: `package.json`
**Intent**: wygodne, powtarzalne komendy do lokalnego Supabase i generacji typów.
**Contract**: dodać do `scripts`: `db:start` (`supabase start`), `db:stop` (`supabase stop`),
`db:reset` (`supabase db reset`), `db:types` (`supabase gen types typescript --local > src/db/database.types.ts`).

#### 2. Migracja schematu + RLS
**File**: `supabase/migrations/<timestamp>_init_items.sql`
**Intent**: utworzyć obie tabele, włączyć RLS, dodać polityki „tylko własne" i trigger rejestracji.
**Contract**: kształt schematu i RLS, na którym oprą się kolejne slice'y:

```sql
-- profiles: 1 wiersz na użytkownika, pole planu pod przyszły limit
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium')),
  created_at timestamptz not null default now()
);

-- items: pozycje, na których działa silnik pilności (S-01)
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nazwa text not null,
  sklep text,
  kwota numeric(12,2) not null,
  data_odniesienia date not null,
  typ_okna text not null check (typ_okna in ('zwrot','rekojmia','subskrypcja')),
  dlugosc_okna_dni int,                 -- override długości okna zwrotu (domyślnie 14 w logice)
  status_zalatwione boolean not null default false,
  created_at timestamptz not null default now()
);
create index items_user_id_idx on public.items(user_id);

alter table public.profiles enable row level security;
alter table public.items enable row level security;

-- RLS: tylko własne rekordy (auth.uid())
create policy items_select on public.items for select using (auth.uid() = user_id);
create policy items_insert on public.items for insert with check (auth.uid() = user_id);
create policy items_update on public.items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy items_delete on public.items for delete using (auth.uid() = user_id);
create policy profiles_select on public.profiles for select using (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- trigger: utwórz profil przy rejestracji (security definer — patrz Critical Implementation Details)
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id) values (new.id); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
```

### Success Criteria:

#### Automated Verification:
- Migracja stosuje się czysto: `npm run db:reset`
- Linting przechodzi: `npm run lint`

#### Manual Verification:
- `npm run db:start` podnosi lokalny stack Supabase (Docker)
- Tabele `profiles` i `items` istnieją w lokalnej bazie (Supabase Studio lub psql)
- Po rejestracji testowego użytkownika pojawia się wiersz w `profiles` z `plan = 'free'`

**Implementation Note**: po przejściu automatycznej weryfikacji zatrzymaj się na ręczne potwierdzenie
przed Fazą 2.

---

## Phase 2: Typy TS + weryfikacja RLS

### Overview
Generacja typów `Database` z lokalnej bazy, podpięcie ich do klienta Supabase, realna weryfikacja
izolacji danych dwoma użytkownikami.

### Changes Required:

#### 1. Wygenerowane typy bazy
**File**: `src/db/database.types.ts`
**Intent**: typy `Database` (w tym `items`, `profiles`) dla bezpiecznego typowo kodu w kolejnych slice'ach.
**Contract**: plik generowany komendą `npm run db:types`; eksportuje typ `Database`.

#### 2. Otypowany klient Supabase
**File**: `src/lib/supabase.ts`
**Intent**: związać klient z typem `Database`, żeby zapytania o `items`/`profiles` były typowane.
**Contract**: `createServerClient<Database>(...)`; import `import type { Database } from "@/db/database.types"`.

### Success Criteria:

#### Automated Verification:
- Typy generują się bez błędu: `npm run db:types`
- Typecheck przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:
- Weryfikacja RLS: w lokalnym Supabase utwórz użytkowników A i B; jako A wstaw pozycję; potwierdź,
  że sesja B **nie** widzi (`select` → 0 wierszy) ani nie może zmienić/usunąć pozycji A.
- Próba wstawienia pozycji z cudzym `user_id` jest odrzucana przez politykę `insert`.

**Implementation Note**: zatrzymaj się na ręczne potwierdzenie weryfikacji RLS przed zamknięciem planu.

---

## Testing Strategy

### Unit Tests:
- Brak w tej fazie — nie ma jeszcze logiki domenowej (silnik pilności testujemy w S-01).

### Integration Tests:
- Weryfikacja RLS realizowana ręcznie dwoma użytkownikami (runner testów dojdzie w S-01 / `/10x-test-plan`).

### Manual Testing Steps:
1. `npm run db:start`, `npm run db:reset` — migracja stosuje się czysto.
2. Zarejestruj użytkownika A i B (przez istniejące ekrany auth startera).
3. Jako A dodaj wiersz do `items` (Studio/psql w kontekście sesji A).
4. Jako B wykonaj `select * from items` — oczekiwane 0 wierszy; `update`/`delete` na pozycji A — odrzucone.

## Migration Notes

Migracja jest lokalna; na hostowany Supabase trafi później przez `supabase db push` (poza zakresem F-01).

## References

- Roadmap: `context/foundation/roadmap.md` (F-01)
- Klient Supabase do otypowania: `src/lib/supabase.ts:5`
- Middleware (źródło `auth.uid()`): `src/middleware.ts:8`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Lokalny Supabase + migracja schematu

#### Automated
- [x] 1.1 Migracja stosuje się czysto: `npm run db:reset` — 6babd17
- [x] 1.2 Linting przechodzi: `npm run lint` — 6babd17

#### Manual
- [x] 1.3 `npm run db:start` podnosi lokalny stack Supabase (Docker) — 6babd17
- [x] 1.4 Tabele `profiles` i `items` istnieją w lokalnej bazie — 6babd17
- [x] 1.5 Po rejestracji użytkownika pojawia się wiersz w `profiles` z `plan = 'free'` — 6babd17

### Phase 2: Typy TS + weryfikacja RLS

#### Automated
- [x] 2.1 Typy generują się bez błędu: `npm run db:types` — 9ad40b6
- [x] 2.2 Typecheck przechodzi: `npx astro check` — 9ad40b6
- [x] 2.3 Linting przechodzi: `npm run lint` — 9ad40b6
- [x] 2.4 Build przechodzi: `npm run build` — 9ad40b6

#### Manual
- [x] 2.5 RLS: użytkownik B nie widzi ani nie zmienia pozycji użytkownika A — 9ad40b6
- [x] 2.6 Wstawienie pozycji z cudzym `user_id` jest odrzucane — 9ad40b6
