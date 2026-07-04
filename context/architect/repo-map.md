# Mapa repozytorium — Zwrotnik (10xArchitect L2)

Cel: szybka orientacja w kodzie — gdzie co żyje, jak płyną dane, gdzie są granice.

## Warstwy (od żądania do bazy)

```
Przeglądarka
   │  HTTP (formularze PRG / nawigacja)
   ▼
src/middleware.ts            ── auth na każde żądanie: rozpoznaje usera (Supabase), chroni /dashboard
   ▼
src/pages/**                 ── strony .astro (SSR) + API routes (.ts, prerender=false)
   │
   ├─ src/lib/services/**    ── logika dostępu do danych (items.ts) — cienka, polega na RLS
   ├─ src/lib/*.ts           ── logika czysta i domenowa (urgency, reminders, plan, otp)
   ▼
src/lib/supabase.ts          ── klient Supabase (SSR, cookies)
   ▼
Supabase (Postgres + Auth + RLS)   ── źródło prawdy; migracje w supabase/migrations/
```

## Kluczowe pliki wg odpowiedzialności

### Rdzeń domeny (czysty, testowany — serce aplikacji)
| Plik | Odpowiedzialność |
| --- | --- |
| `src/lib/urgency.ts` | Silnik pilności: `computeCloseDate` (data zamknięcia wg typu okna), `daysUntil`, `statusForDays` (progi kubełków), `buildUrgencyView` (grupowanie + sortowanie + suma „Zagrożone"). Deterministyczny — `today` wstrzykiwane. |
| `src/lib/reminders.ts` | Przypomnienia: `warsawWallTimeToUTC` (strefa + DST), `formatReminderWarsaw`, `isReminderDue`, `buildReminderEmail`. |
| `src/lib/plan.ts` | Reguła limitu planu free (`isOverFreeLimit`). |
| `src/lib/otp.ts` | Walidacja formatu kodu OTP. |
| `src/types.ts` | Typy domenowe (Item, WindowType, UrgencyStatus, ItemView, UrgencyView). |

### Dostęp do danych
| Plik | Odpowiedzialność |
| --- | --- |
| `src/lib/services/items.ts` | Operacje na pozycjach: list/create/update/delete/setDone/setReminder/clearReminder + `itemInputSchema` (zod). Izolacja per user przez RLS. |
| `src/lib/supabase.ts` | Fabryka klienta SSR (`@supabase/ssr`, cookies, `astro:env/server`). |
| `src/db/database.types.ts` | Typy wygenerowane z Supabase (nie edytować ręcznie). |

### Wejścia HTTP
| Ścieżka | Rola |
| --- | --- |
| `src/pages/index.astro` → `components/Welcome.astro` | Landing (marketing + CTA). |
| `src/pages/dashboard.astro` | Panel: lista wg pilności, suma, formularz, akcje, przypomnienia. |
| `src/pages/items/[id]/edit.astro` | Edycja pozycji (SSR). |
| `src/pages/api/items/index.ts` | `POST` — tworzenie pozycji (PRG). |
| `src/pages/api/items/[id].ts` | `POST` — mutacje pojedynczej pozycji (`_action`: update/delete/done/undone/set-reminder/clear-reminder). |
| `src/pages/api/auth/{signup,signin,signout,verify}.ts` | Rejestracja (OTP), logowanie, wylogowanie, weryfikacja kodu. |
| `src/pages/api/cron/send-reminders.ts` | Chroniony (`CRON_SECRET`) endpoint wysyłki przypomnień (klient service-role). |
| `src/middleware.ts` | Auth guard + `context.locals.user`. |

### UI
- `src/layouts/Layout.astro` — szkielet + skrypt motywu (jasny/ciemny).
- `src/components/**` — Welcome, Topbar, ThemeToggle, `auth/*` (React: formularze), `ui/*` (shadcn).
- `src/styles/global.css` — Tailwind 4 + tokeny motywu (`.dark`), `bg-cosmic`.

### Dane / migracje
- `supabase/migrations/` — `init_items` (profiles+items+RLS+trigger), `add_wlasny_window`, `add_reminder_at`.
- `supabase/tests/` — SQL test RLS.

### Testy
- `tests/unit/**` — urgency, reminders, plan, otp, walidacja (CI, bez zależności).
- `tests/integration/rls.items.test.ts` — izolacja RLS (wymaga lokalnego Supabase).

### CI/CD i konfiguracja
- `.github/workflows/` — `ci.yml` (lint+test+build), `deploy.yml` (deploy Cloudflare), `reminders.yml` (cron co godzinę).
- `astro.config.mjs` (adapter Cloudflare, `env.schema` sekretów), `wrangler.jsonc` (worker `zwrotnik`, custom domain).
- `context/foundation/` — PRD, roadmap, tech-stack, test-plan, infrastructure. `context/archive/` — zamknięte zmiany.

## Główne przepływy

- **Dodanie pozycji:** dashboard `<form>` → `POST /api/items` → `createItem` (walidacja zod + limit planu) → insert (RLS) → redirect → `listActiveForUser` → `buildUrgencyView` renderuje kubełki i sumę.
- **Przypomnienie:** dashboard „Ustaw" → `POST /api/items/[id]` (`set-reminder`, konwersja Warsaw→UTC) → `reminder_at`. Cron (GitHub Actions co godzinę) → `POST /api/cron/send-reminders` → service-role znajduje należne → Resend → zeruje `reminder_at`.
- **Auth:** `signup` → OTP e-mail → `verify` → `signin` → cookie sesji → middleware wpuszcza na `/dashboard`.

## Granice i zasady
- **Izolacja danych = RLS** (nie kod aplikacji): polityki `auth.uid() = user_id` + granty; testowana integracyjnie.
- **Logika czysta oddzielona od I/O:** `urgency`/`reminders` nie znają Supabase — stąd łatwe testy jednostkowe.
- **Sekrety poza repo:** `.env`/`.dev.vars` w `.gitignore`; klucze w sekretach Workera/repo/Supabase.
