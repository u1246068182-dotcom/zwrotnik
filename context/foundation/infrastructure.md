# Infrastructure — Zwrotnik

Dokument opisuje, gdzie i jak Zwrotnik jest zbudowany, wdrożony i utrzymywany.

## Przegląd

| Warstwa | Rozwiązanie |
| --- | --- |
| Aplikacja | Astro 6 (SSR, `output: "server"`) + React 19 (wyspy) + TypeScript + Tailwind 4 |
| Hosting | Cloudflare Workers (adapter `@astrojs/cloudflare`) |
| Baza + Auth | Supabase (Postgres + Auth + RLS), region eu-west-1 |
| Poczta | Resend (SMTP dla Supabase Auth + API dla przypomnień) |
| Repozytorium | GitHub (publiczne) |
| CI/CD | GitHub Actions |

- **Produkcja (publiczny URL):** https://zwrotnik.zwrotnik-app.workers.dev
- **Worker:** `zwrotnik` (subdomena konta `zwrotnik-app.workers.dev`)
- **Projekt Supabase:** `fznbmibpguvffztlvehe` (eu-west-1)

## Aplikacja i rendering

Pełny SSR — każda strona renderowana serwerowo w Workerze; API routes mają `export const prerender = false`.
Sesje auth przez `@supabase/ssr` (cookies). Middleware (`src/middleware.ts`) rozpoznaje użytkownika i
chroni trasy (`/dashboard`).

## Baza danych i bezpieczeństwo

- Postgres w Supabase; migracje w `supabase/migrations/` (stosowane lokalnie przez CLI i na prod przez Management API).
- **RLS włączony** na wszystkich tabelach — każdy użytkownik operuje wyłącznie na własnych rekordach
  (`auth.uid() = user_id`), granularne polityki per operacja + GRANT-y dla roli `authenticated`.
- Trigger `on_auth_user_created` zakłada profil przy rejestracji (security definer, pinned search_path).

## Autentykacja

- Rejestracja e-mail + hasło z **potwierdzeniem 6–8-cyfrowym kodem OTP** (natywny OTP Supabase, szablon z `{{ .Token }}`).
- Poczta auth wychodzi przez **Resend jako SMTP** Supabase (`smtp.resend.com`).
- Kontrola dostępu: middleware + RLS.

## Wysyłka e-maili

- **Auth** (kody OTP): Supabase → SMTP Resend.
- **Przypomnienia**: endpoint `/api/cron/send-reminders` woła **Resend API** bezpośrednio (klient service-role omija RLS, by wysłać do wszystkich należnych).
- **Ograniczenie sandbox**: bez zweryfikowanej domeny Resend dostarcza tylko na adres właściciela konta; produkcyjna wysyłka do dowolnych użytkowników wymaga dodania własnej domeny (DNS) — planowane.

## Harmonogram (przypomnienia)

GitHub Actions (`.github/workflows/reminders.yml`, `schedule: "0 * * * *"`) co godzinę woła chroniony
endpoint `/api/cron/send-reminders` z nagłówkiem `Authorization: Bearer <CRON_SECRET>`. Endpoint znajduje
należne, aktywne przypomnienia (`reminder_at <= now()`), wysyła maile i zeruje `reminder_at`.

## CI/CD

- **`.github/workflows/ci.yml`** — na push/PR: `npm ci` → `astro sync` → `lint` → `test:unit` → `build`.
- **`.github/workflows/deploy.yml`** — na push do `master`: `lint` → `test:unit` → `build` → `wrangler deploy` (Cloudflare).
- **`.github/workflows/reminders.yml`** — cron co godzinę (patrz wyżej).

## Zarządzanie sekretami

Sekrety **nigdy nie trafiają do repo** (`.env`, `.dev.vars` w `.gitignore`).

| Sekret | Gdzie |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_KEY` (anon) | sekrety Workera + sekrety repo (build) |
| `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `CRON_SECRET` | sekrety Workera (endpoint cron) |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | sekrety repo (deploy) |
| `CRON_SECRET` | sekret repo (wywołanie crona) |
| Konfiguracja Auth (SMTP, szablony, autoconfirm=off) | ustawienia projektu Supabase (nie w repo) |

## Środowisko lokalne

- Node 22 (`.nvmrc`), `npm run dev` (runtime workerd).
- Lokalny Supabase: `npx supabase start` (Docker) + Mailpit (`:54324`) do podglądu maili.
- Testy: `npm run test:unit` (CI) oraz `npm run test:integration` (wymaga lokalnego Supabase).

## Koszty (rząd wielkości)

Cloudflare Workers, Supabase, Resend i GitHub Actions — w ramach darmowych progów na obecnej skali MVP.

## Do zrobienia (produkcyjne utwardzenie)

- Zweryfikowana **domena** w Resend (wysyłka maili do dowolnych użytkowników; dziś sandbox = tylko adres właściciela).
- Rotacja sekretów użytych podczas budowy.
- Monitoring błędów / observability.
