# Raport architektoniczny — Zwrotnik (10xArchitect)

Zwięzły raport spinający cztery artefakty modułu 4. Szczegóły w plikach źródłowych (linki niżej).

> Artefakty: [Mapa repo](./repo-map.md) (L2) · [Research: cykliczne przypomnienia](./research-cykliczne-przypomnienia.md) (L3) · [Plan refaktoryzacji](./refactor-plan.md) (L4) · [Notatki domenowe (DDD)](../domain/domain-notes.md) (L5)

## 1. Co to jest
**Zwrotnik** — full-stack MVP (wdrożony na `https://mojzwrotnik.uk`), który pilnuje terminów zakupów
(zwrot, rękojmia, subskrypcja, własny termin), liczy dni do zamknięcia okna, grupuje pozycje wg pilności
i pokazuje sumę „Zagrożone", a także wysyła przypomnienia e-mail. Baza (10xBuilder) jest zaliczona;
ten raport patrzy na projekt **oczami architekta**.

## 2. Architektura w skrócie (z Mapy repo, L2)
Warstwy: `middleware` (auth guard) → strony/API (`src/pages/**`, SSR + PRG) → logika
(`src/lib/*` czysta + `services/items.ts`) → Supabase (Postgres + Auth + **RLS**). Cała warstwa
domenowa (`urgency.ts`, `reminders.ts`) jest **czysta i oddzielona od I/O** — stąd deterministyczne
testy jednostkowe. Przypomnienia jadą osobnym torem: endpoint cron + GitHub Actions (co godzinę).

**Kluczowa decyzja architektoniczna:** izolacja własności danych jest egzekwowana w **bazie (RLS)**,
nie w kodzie aplikacji — bezpieczeństwo nie zależy od poprawności warstwy aplikacyjnej. Potwierdzone
testem integracyjnym (IDOR/R2 z `test-plan.md`).

## 3. Domena (z Notatek DDD, L5)
Rdzeń: agregat **Pozycja** z niezmiennikami — data zamknięcia zależna od typu okna, progi pilności,
„Zagrożone" = Pilne + Wkrótce, przypomnienie tylko w przyszłości (model 2-stanowy). Wyodrębnione
konteksty: pilność, przypomnienia (czas/DST + harmonogram), tożsamość/dostęp (RLS), plan/monetyzacja.
Świadome uproszczenia (jedno przypomnienie, miękki limit, strefa PL) są spisane jako dług.

## 4. Kierunek rozwoju (z Researchu L3 + Planu refaktoryzacji L4)
- **Ficzer (L3):** cykliczne przypomnienia. Rekomendacja: pole `reminder_interval_days` + czysta funkcja
  `nextReminderAt` (zamiast zerowania po wysyłce) — minimalna zmiana spójna z modelem 2-stanowym; główne
  ryzyko (pętla wysyłki) domknięte progiem w funkcji + testem.
- **Refaktor (L4):** rozrastający się `switch` akcji w `api/items/[id].ts` → mapa handlerów
  (`_action → handler`) + testy jednostkowe walidacji przypomnienia. Zysk: łatwe dodawanie akcji
  (np. cyklicznych przypomnień) bez dotykania pozostałych; bez zmiany kontraktu HTTP/PRG.

Te dwa elementy się zazębiają: refaktor L4 jest naturalnym fundamentem pod ficzer z L3.

## 5. Mocne strony i ryzyka (ocena architekta)
**Mocne:** czysty rdzeń domeny oddzielony od I/O; bezpieczeństwo w bazie (RLS) a nie w kodzie;
mały, spójny stack; CI/CD i dokumenty kontekstowe utrzymywane wraz z kodem; przypomnienia jako osobny,
wymienialny tor (cron → endpoint).

**Ryzyka / dług:** sandbox → domena poczty (rozwiązane: `mojzwrotnik.uk`); rosnący dyspozytor akcji
(adresuje L4); brak observability/monitoringu; limit planu bez realnej płatności; strefa czasu przypięta do PL.

## 6. Jak to obronić (mapa dowodów)
- Architektura/granice → `repo-map.md`, kod w `src/lib/**` i `src/middleware.ts`.
- Bezpieczeństwo (RLS) → `supabase/migrations/*_init_items.sql`, `tests/integration/rls.items.test.ts`.
- Domena → `context/domain/domain-notes.md`, `src/lib/urgency.ts` / `reminders.ts`.
- Kierunek → `research-cykliczne-przypomnienia.md`, `refactor-plan.md`.
