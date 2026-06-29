# Tech Stack — Zwrotnik

Techniczny hand-off dla MVP (blok 10xBuilder). Zasada przewodnia: **znany,
dobrze udokumentowany, "agent-friendly" stack o najniższym koszcie czasu i
pieniędzy**, z architekturą otwartą na przyszłą rozbudowę (natywne klienty,
płatności, GCP).

## Wybór stacku

| Warstwa        | Wybór                              | Uzasadnienie                                                        |
| -------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Frontend       | **React (web) jako PWA**           | jeden kod → web + iOS + Android (przez przeglądarkę), instalowalne   |
| Backend / API  | **Supabase**                       | auth + Postgres + auto-API od ręki, minimalny ops                   |
| Baza danych    | **Supabase Postgres**              | RLS daje autoryzację per użytkownik bez własnego kodu               |
| Auth           | **Supabase Auth (JWT)**            | tokenowe → ten sam login zadziała w przyszłych natywnych klientach   |
| Hosting (front)| **Vercel** lub **Cloudflare Pages**| deploy w minuty, publiczny URL, free tier                          |
| Testy          | **Vitest** (jednostkowe/logika)    | szybkie, dobrze wspierane; silnik statusów testowany jednostkowo    |
| CI/CD          | **GitHub Actions**                 | lint + typecheck + testy + build na każdy push/PR                  |
| Analityka      | **Plausible** (lekka, prywatna)    | dane o użyciu pod przyszłe decyzje premium                          |

## Architektura

- **API-first + auth tokenowe (JWT).** Backend (Supabase) jest klient-agnostyczny.
  Dziś konsumuje go jeden klient (PWA), w przyszłości te same endpointy i ten sam
  login obsłużą natywne apki — bez przepisywania.
- **Autoryzacja w bazie (RLS).** Polityki Row Level Security wymuszają, że
  użytkownik czyta/pisze tylko własne rekordy. To zarazem fundament testu IDOR.
- **Logika pilności po stronie aplikacji/serwera**, deterministyczna i czysto
  funkcyjna → łatwa do testów jednostkowych (patrz `test-plan.md`).

## Model danych (szkic)

`profiles` (rozszerzenie usera): `id`, `email`, `plan` (`free`|`premium`, default
`free`).

`items`: `id`, `user_id` (FK), `nazwa`, `sklep?`, `kwota`, `data_odniesienia`,
`typ_okna` (`zwrot`|`rekojmia`|`subskrypcja`), `dlugosc_okna_dni?` (override dla
zwrotu), `status_zalatwione` (bool), `created_at`.

Stałe konfiguracyjne: `FREE_ITEM_LIMIT = 30`, domyślne okna: zwrot 14 dni,
rękojmia 730 dni.

## Koszt

- **MVP:** ~0 zł (free tiery Supabase + Vercel/Cloudflare). Domena ~10–15 $/rok
  (opcjonalnie).
- Świadomie **odrzucone na teraz:** surowe AWS/GCP — przy złej konfiguracji
  (always-on VM + managed SQL + load balancer + NAT) koszt ~500–1000 $/rok mimo
  zera użytkowników; dodatkowo wysoki koszt czasu na konfigurację.

## Decyzje odłożone (wersja 2, po certyfikacie)

- Migracja/rozbudowa backendu na **GCP** (gdy pojawi się realny ruch).
- **Realne płatności** (jednorazowe odblokowanie 9,99 zł powyżej 30 pozycji).
- **Natywne aplikacje** (Expo / React Native) na ten sam backend.
- Auto-parsowanie maili (AI), powiadomienia push/e-mail, presety polskich sklepów.
