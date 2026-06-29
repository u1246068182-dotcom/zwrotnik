# Items Schema + RLS — Plan Brief

> Full plan: `context/changes/items-schema-rls/plan.md`

## What & Why

Fundament danych Zwrotnika (F-01): migracja Supabase tworząca `profiles` (z polem `plan`) i `items`
(pozycje silnika pilności) z politykami RLS „tylko własne rekordy". RLS realizuje twardy guardrail
prywatności (użytkownik nigdy nie widzi cudzych pozycji) i odblokowuje north star S-01.

## Starting Point

Starter `10x-astro-starter` ma już Supabase SSR, auth (e-mail+hasło) i middleware ustawiające usera,
ale `supabase/` zawiera tylko `config.toml` — żadnych migracji, żadnych tabel domenowych, żadnych typów DB.

## Desired End State

Lokalny Supabase stosuje migrację czysto; w bazie są `profiles` i `items` z włączonym RLS; nowy
użytkownik dostaje automatycznie profil (`plan = 'free'`); typy `Database` są wygenerowane i podpięte
do klienta; ręczna weryfikacja dwoma użytkownikami potwierdza izolację danych.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego |
| --- | --- | --- |
| Plan użytkownika | Tabela `profiles` + trigger rejestracji | Pole `plan` gotowe pod limit S-04; trigger niezawodny na poziomie bazy |
| Typ okna | `text` + `CHECK` | Łatwo rozszerzyć, prostsze migracje, dobrze gra z typami TS |
| Kwota | `numeric(12,2)` w złotych | Dokładny typ dziesiętny (nie float), proste wyświetlanie |
| Weryfikacja RLS | Lokalny Supabase (CLI/Docker) | Pełna, powtarzalna weryfikacja bez ruszania produkcji |

## Scope

**In scope:** migracja `profiles` + `items`, RLS „tylko własne", trigger rejestracji, lokalne env Supabase, typy TS, otypowany klient, ręczna weryfikacja RLS.

**Out of scope:** UI/API/silnik pilności (S-01), limit 30 i płatności (S-04/v2), deploy migracji na hosting, runner testów jednostkowych.

## Architecture / Approach

„Dane najpierw": jedna migracja SQL definiuje obie tabele + RLS + trigger; lokalny Supabase stosuje i
weryfikuje; na końcu generujemy typy i podpinamy do istniejącego klienta `src/lib/supabase.ts`. RLS
opiera się o `auth.uid()` z sesji ustawianej przez middleware startera.

## Phases at a Glance

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Lokalny Supabase + migracja | Tabele + RLS + trigger; `db:reset` stosuje czysto | Trigger bez `security definer` cicho zawodzi → brak profilu |
| 2. Typy + weryfikacja RLS | Typy `Database`, otypowany klient, realna weryfikacja izolacji | RLS przepuszcza cudze rekordy = luka prywatności |

**Prerequisites:** lokalny Supabase CLI + Docker; `.env` z lokalnymi `SUPABASE_URL`/`SUPABASE_KEY`.
**Estimated effort:** ~1 sesja, 2 fazy.

## Open Risks & Assumptions

- Wymaga zainstalowanego Supabase CLI i Dockera (pierwszy `supabase start` pobiera obrazy).
- Trigger rejestracji to typowe źródło cichych błędów — stąd osobny punkt w „Critical Implementation Details".

## Success Criteria (Summary)

- `npm run db:reset` stosuje migrację czysto; typy generują się; `astro check`, `lint`, `build` przechodzą.
- Użytkownik B nie widzi ani nie zmienia pozycji użytkownika A; wstawienie z cudzym `user_id` odrzucone.
