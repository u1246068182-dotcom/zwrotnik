# Przypomnienia mailowe — Plan Brief

> Full plan: `context/changes/email-reminders/plan.md`

## What & Why

Zwrotnik jest dziś pasywny — pokazuje pilność, ale sam nie przypomina. Dodajemy **przypomnienie mailowe
per pozycja** (data + godzina): użytkownik ustawia, kiedy chce dostać maila, a aplikacja go wysyła. To
domyka rdzeń produktu („pilnuje terminów") i daje mocny element pod certyfikat (harmonogram + logika).

## Starting Point

Pozycje mają silnik pilności (termin, dni, kwota) i akcje per pozycja (edytuj/załatwione/usuń). Resend
działa jako SMTP (sandbox → tylko `stasiuklge@gmail.com`). Worker ma tylko klucz anon Supabase.

## Desired End State

Przy pozycji bez przypomnienia jest „Ustaw przypomnienie" (data+godzina); po ustawieniu „🔔 <data> <godz>"
+ „Usuń". Co godzinę harmonogram wysyła maile dla należnych aktywnych pozycji (nazwa, termin, dni, kwota,
link), po czym przypomnienie znika. Bez edycji, 1 na pozycję.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego |
| --- | --- | --- |
| Dokładność | Data + godzina (co do godziny) | Cron co godzinę wystarcza; prostsze niż minuty |
| Model stanu | 2-stanowy: `reminder_at` lub null | Po wysyłce zerujemy — user widzi „brak", bez flagi „wysłane" |
| Liczba | 1 przypomnienie na pozycję | Prostota MVP |
| Front | Ustaw/usuń per pozycja, bez edycji | Zgodne z modelem 2-stanowym |
| Harmonogram | GitHub Actions cron → chroniony endpoint | Najchudsze, istniejąca infra, endpoint testowalny |
| Strefa | Czas polski → zapis UTC (DST-aware) | Zgodne z oczekiwaniem użytkownika |
| Domyślnie | Puste (opcjonalne) | Zero niespodziewanych maili |
| Mail | Bogaty: nazwa+termin+dni+kwota+link | Od razu wiadomo o co chodzi |
| Testy | Czyste funkcje (strefa/należność/mail) + manual | Logika w CI, wysyłka ręcznie |

## Scope

**In scope:** migracja `reminder_at`; konwersja Warsaw→UTC; set/clear w serwisie + `/api/items/[id]`; UI ustaw/usuń;
endpoint `/api/cron/send-reminders` (service-role, Resend, zerowanie); GitHub Actions cron co godzinę; sekrety Workera; testy.

**Out of scope:** edycja przypomnienia, wiele/powtarzalne przypomnienia, precyzja do minuty, wysyłka do obcych (domena), podpowiadana data.

## Architecture / Approach

`reminder_at` (UTC) na pozycji. Ustawienie: front (data+godzina Warszawy) → serwer konwertuje do UTC → zapis.
Harmonogram: Actions `schedule` co godzinę → `POST /api/cron/send-reminders` z `CRON_SECRET` → klient
service-role czyta należne aktywne, wysyła Resend, zeruje `reminder_at`. Czyste funkcje (strefa, należność,
mail) testowane w CI.

## Phases at a Glance

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Dane + ustaw/usuń (UI) | Kolumna, konwersja strefy, akcje, UI per pozycja | Poprawność konwersji DST |
| 2. Harmonogram wysyłki | Endpoint cron + Actions co godzinę + sekrety + maile | Bezpieczeństwo endpointu (service-role), dostarczalność |

**Prerequisites:** Resend key (jest), prod service_role (do pobrania), Supabase access token (jest).
**Estimated effort:** ~1 sesja, 2 fazy.

## Open Risks & Assumptions

- **Sandbox Resend**: maile realnie tylko na `stasiuklge@gmail.com` do czasu domeny.
- **GitHub Actions cron bywa opóźniony** (kilka–kilkanaście min) — akceptowalne przy dokładności do godziny.
- Endpoint cron ma service-role → musi być ściśle bramkowany `CRON_SECRET`.

## Success Criteria (Summary)

- Ustawienie/usunięcie przypomnienia działa; wyświetlana godzina zgodna z wpisaną (czas polski).
- Po pełnej godzinie mail z przypomnieniem dochodzi, a `reminder_at` się zeruje.
- Załatwiona pozycja nie wysyła przypomnienia; endpoint bez sekretu → 401.
