# Rejestracja z kodem OTP — Plan Brief

> Full plan: `context/changes/otp-signup/plan.md`

## What & Why

Rejestracja wymaga potwierdzenia konta **6-cyfrowym kodem** z e-maila. Dziś konta są auto-potwierdzane
(żaden mail nie idzie) — to niespójne dla realnego produktu i nie chroni przed śmieciowymi kontami.
Kod OTP daje prawdziwą weryfikację e-maila i mocniejszą historię pod certyfikat (logika auth + poczta).

## Starting Point

Rejestracja (`signUp`) tworzy i od razu loguje użytkownika (autoconfirm on). Poczta niepodpięta.
Klucz Resend przetestowany — wysyłka na `stasiuklge@gmail.com` działa (sandbox, bez domeny).

## Desired End State

Email+hasło → e-mail z 6-cyfrowym kodem → strona „wpisz kod" → `verifyOtp` potwierdza konto →
przekierowanie na logowanie („Konto potwierdzone — zaloguj się") → login hasłem → dashboard.
Bez kodu konto się nie zaloguje.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego |
| --- | --- | --- |
| Mechanizm | Natywny OTP Supabase (`{{ .Token }}`) | Zero własnego generatora kodów; Supabase pilnuje wygaśnięcia/prób |
| Transport | Resend jako SMTP Supabase | Lepsza dostarczalność niż wbudowana poczta; klucz w Supabase, nie w repo |
| UX kodu | Jedno pole na 6 cyfr | Najmniej kodu, łatwe wklejenie, `autocomplete=one-time-code` |
| Ponowny kod | Bez przycisku resend | Wygasły kod = rejestracja od nowa (Supabase i tak ponawia dla niepotwierdzonych) |
| Duplikat niepotwierdzony | Ponowny kod, prowadzimy dalej | User nie utyka |
| Po weryfikacji | Redirect na logowanie | Decyzja użytkownika — świadome zalogowanie |
| Testy | Unit (format kodu) + manual | OTP z maila nie da się w pełni zautomatyzować |

## Scope

**In scope:** konfiguracja Supabase (autoconfirm off, SMTP Resend, szablon z kodem); `signup` → `/auth/verify`;
`/api/auth/verify` (`verifyOtp` → signOut → `/auth/signin?confirmed=1`); strona `/auth/verify`; baner na logowaniu;
`isValidOtpCode` + unit-test.

**Out of scope:** przycisk resend, 6 kratek, auto-login po weryfikacji, weryfikacja domeny Resend / wysyłka do obcych, integration-testy OTP.

## Architecture / Approach

Config auth przez Management API (udokumentowany w Migration Notes — brak migracji dla auth-config).
Kod: `signup.ts` kieruje na verify; `/api/auth/verify` woła `verifyOtp({type:'signup'})`, po sukcesie
`signOut()` i redirect na logowanie. Format kodu w czystej funkcji `isValidOtpCode` (unit, CI).

## Phases at a Glance

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Backend + config | Supabase config, signup→verify, endpoint verify, walidacja kodu + testy | Dostarczalność/konfiguracja SMTP; format kodu |
| 2. UI + E2E | Strona verify, baner na logowaniu, pełny przepływ manualnie | Spójność stanu, edge bez `?email` (bez 500) |

**Prerequisites:** klucz Resend (jest), Supabase access token (jest), poczta dochodzi (potwierdzone).
**Estimated effort:** ~1 sesja, 2 fazy.

## Open Risks & Assumptions

- **Sandbox Resend**: kod dojdzie tylko na `stasiuklge@gmail.com`; obcy user wymaga domeny (osobny temat).
- Wyłączenie autoconfirm dotyczy wszystkich nowych rejestracji — zamierzone.

## Success Criteria (Summary)

- Rejestracja Twoim mailem → kod dociera → wpisanie → potwierdzenie → login → dashboard.
- Zły kod → komunikat, konto niepotwierdzone; `/auth/verify` bez `?email` → brak 500.
- `isValidOtpCode` pokryte unit-testem w CI.
