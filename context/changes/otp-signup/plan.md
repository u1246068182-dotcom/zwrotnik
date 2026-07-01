# Rejestracja z kodem OTP — Implementation Plan

## Overview

Rejestracja wymaga potwierdzenia konta **6-cyfrowym kodem** wysłanym e-mailem. Używamy **natywnego OTP
Supabase** (kod w szablonie `{{ .Token }}`), z **Resend jako SMTP** Supabase. `signUp` tworzy konto
nieaktywne i wysyła kod → strona „wpisz kod" → `verifyOtp({ type: "signup" })` potwierdza konto →
przekierowanie na logowanie z komunikatem. Bez wpisania kodu konto jest bezużyteczne (nie zaloguje się).

## Current State Analysis

- `mailer_autoconfirm=true` (ustawione przy deployu) — konta są auto-potwierdzane, żaden mail nie idzie. To wyłączamy.
- `src/pages/api/auth/signup.ts`: `signUp({email,password})`; obecnie po sukcesie redirect `/dashboard` (sesja) / fallback `/auth/signin?registered=1`. Do zmiany: po `signUp` (bez sesji, bo wymaga potwierdzenia) → redirect na `/auth/verify`.
- `src/pages/auth/signup.astro` + `SignUpForm.tsx` (React island) → `POST /api/auth/signup` (PRG). Bez zmian w formularzu.
- `src/pages/auth/signin.astro`: pokazuje baner przy `?registered=1`. Dodamy `?confirmed=1`.
- `src/pages/auth/confirm-email.astro`: nieużywana po tej zmianie (rejestracja idzie na `/auth/verify`).
- `src/lib/supabase.ts`: `createServerClient` z `@supabase/ssr` — `verifyOtp`/`signOut` zapiszą/wyczyszczą cookie sesji.
- Konfiguracja auth (SMTP, szablon, autoconfirm) siedzi w Supabase, **nie w repo** — ustawiamy przez Management API (mamy access token).

### Key Discoveries:
- Supabase natywnie wspiera OTP: szablon „Confirm signup" z `{{ .Token }}` zamiast linku → `verifyOtp({ email, token, type: "signup" })`.
- Resend jako SMTP Supabase: host `smtp.resend.com`, port 465, user `resend`, pass = klucz Resend, nadawca `onboarding@resend.dev` (sandbox → tylko `stasiuklge@gmail.com`).
- `signUp` na istniejącym **niepotwierdzonym** mailu ponownie wysyła kod (Supabase) — obsługujemy jako kontynuację (redirect na verify).
- Top-level `return Astro.redirect` w `.astro` wywala regułę `no-misused-promises` (lekcja z S-03) → w `/auth/verify` guard braku e-maila robimy **renderem warunkowym**, nie top-level returnem.

## Desired End State

Użytkownik rejestruje się (email+hasło) → dostaje e-mailem 6-cyfrowy kod → wpisuje go na `/auth/verify` →
konto potwierdzone, przekierowanie na `/auth/signin?confirmed=1` („Konto potwierdzone — zaloguj się") →
loguje się hasłem → dashboard. Zły/wygasły kod → komunikat na stronie weryfikacji. Reguła formatu kodu
pokryta unit-testem; pełny przepływ zweryfikowany manualnie (mailem `stasiuklge@gmail.com`).

## What We're NOT Doing

- Przycisku „wyślij kod ponownie" — wygasły kod = rejestracja od nowa (Supabase i tak ponowi kod dla niepotwierdzonego maila).
- 6 osobnych kratek na cyfry — jedno pole (inputmode numeric).
- Auto-logowania po weryfikacji — świadomie przekierowujemy na logowanie (decyzja użytkownika).
- Weryfikowanej domeny Resend / wysyłki do obcych adresów — sandbox (tylko własny mail); domena to osobny, późniejszy temat.
- Integration-testów OTP — kod przychodzi mailem, nie da się w pełni zautomatyzować; weryfikacja manualna.

## Implementation Approach

Konfigurację auth (autoconfirm off, SMTP Resend, szablon z `{{ .Token }}`) ustawiam przez Supabase
Management API (udokumentowane w Migration Notes — nie ma migracji dla auth-config). Kod aplikacji:
`signup.ts` przekierowuje po rejestracji na `/auth/verify?email=…`; nowa strona `/auth/verify` z jednym
polem na kod POST-uje na `/api/auth/verify`, który woła `verifyOtp`, a po sukcesie `signOut()` (żeby lądować
na czystym logowaniu) i redirect `/auth/signin?confirmed=1`. Format kodu izolujemy w czystej funkcji
(`isValidOtpCode`) — unit-test, CI.

## Phase 1: Backend + konfiguracja Supabase

### Overview
Konfiguracja poczty/OTP w Supabase oraz logika serwera: rejestracja kieruje na weryfikację, endpoint weryfikacji potwierdza kod.

### Changes Required:

#### 1. Konfiguracja Supabase (Management API — ops, nie kod repo)
**Gdzie**: projekt `fznbmibpguvffztlvehe`, `PATCH /v1/projects/{ref}/config/auth`.
**Intent**: wyłączyć auto-confirm, podpiąć Resend jako SMTP, ustawić szablon „Confirm signup" na 6-cyfrowy kod (PL).
**Contract**: `mailer_autoconfirm=false`; `smtp_host=smtp.resend.com`, `smtp_port=465`, `smtp_user=resend`, `smtp_pass=<klucz Resend>`, `smtp_admin_email=onboarding@resend.dev`, `smtp_sender_name=Zwrotnik`; `mailer_subjects_confirmation` + `mailer_templates_confirmation_content` zawierające `{{ .Token }}` (kod) i PL treść. Klucz Resend NIE trafia do repo. Dokładne wartości w Migration Notes.

#### 2. Walidacja formatu kodu (czysta funkcja)
**File**: `src/lib/otp.ts`
**Intent**: izolowana, testowalna reguła formatu kodu OTP.
**Contract**: `export const OTP_LENGTH = 6;` oraz `export function isValidOtpCode(code: string): boolean` — `true` gdy dokładnie 6 cyfr (`/^\d{6}$/`).

#### 3. Unit-test reguły
**File**: `tests/unit/otp.test.ts`
**Intent**: zabezpieczyć walidację kodu (za krótki / za długi / nie-cyfry / puste / poprawny).
**Contract**: testy progów i formatu dla `isValidOtpCode`.

#### 4. Rejestracja kieruje na weryfikację
**File**: `src/pages/api/auth/signup.ts`
**Intent**: po `signUp` (konto nieaktywne, brak sesji) przekierować na stronę wpisania kodu z e-mailem w query.
**Contract**: po sukcesie `signUp` → `redirect('/auth/verify?email=' + encodeURIComponent(email))`. Błąd → jak teraz `/auth/signup?error=`. Usuwamy gałąź `data.session → /dashboard` (przy wyłączonym autoconfirm sesji nie ma).

#### 5. Endpoint weryfikacji kodu
**File**: `src/pages/api/auth/verify.ts`
**Intent**: potwierdzić kod i odesłać na logowanie.
**Contract**: `export const prerender = false;` + `POST`. Czyta `email` + `token` z formData; jeśli `!isValidOtpCode(token)` → redirect `/auth/verify?email=…&error=…`. `supabase.auth.verifyOtp({ email, token, type: 'signup' })`; błąd → `/auth/verify?email=…&error=<komunikat>`; sukces → `supabase.auth.signOut()` → redirect `/auth/signin?confirmed=1`.

### Success Criteria:

#### Automated Verification:
- Unit-testy przechodzą: `npm run test:unit`
- Typecheck przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:
- (pełny przepływ mailowy weryfikujemy w Fazie 2, gdy jest UI)

**Implementation Note**: zatrzymaj się na potwierdzenie po automatycznych checkach przed Fazą 2.

---

## Phase 2: UI weryfikacji + pełny przepływ

### Overview
Strona wpisania kodu i komunikat na logowaniu; weryfikacja całego przepływu na żywo.

### Changes Required:

#### 1. Strona wpisania kodu
**File**: `src/pages/auth/verify.astro`
**Intent**: formularz z jednym polem na 6-cyfrowy kod; pokazuje błędy; obsługuje brak e-maila renderem warunkowym.
**Contract**: `export const prerender = false;` Czyta `?email` i `?error`. Gdy brak `email` → render „wróć do rejestracji" (NIE top-level return). Gdy jest → formularz `POST /api/auth/verify` z ukrytym `email` i polem `token` (`inputmode="numeric"`, `maxlength=6`, `pattern="\d{6}"`, `autocomplete="one-time-code"`). Info, że kod wysłano na `email`. Styl spójny z `signin.astro` (bg-cosmic, karta).

#### 2. Komunikat po potwierdzeniu na logowaniu
**File**: `src/pages/auth/signin.astro`
**Intent**: pokazać zielony baner „Konto potwierdzone — zaloguj się" przy `?confirmed=1`.
**Contract**: analogicznie do istniejącego `registered`: `const confirmed = searchParams.get('confirmed') === '1'` + baner.

### Success Criteria:

#### Automated Verification:
- Typecheck przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:
- Rejestracja mailem `stasiuklge@gmail.com` → e-mail z 6-cyfrowym kodem dociera (skrzynka/spam).
- Wpisanie poprawnego kodu → redirect `/auth/signin?confirmed=1` z banerem; logowanie hasłem → dashboard.
- Zły kod → komunikat błędu na `/auth/verify`, konto niepotwierdzone.
- Wejście na `/auth/verify` bez `?email` → komunikat „wróć do rejestracji" (bez błędu 500).
- Ponowna rejestracja tym samym (niepotwierdzonym) mailem → przychodzi nowy kod, można dokończyć.

**Implementation Note**: zatrzymaj się na ręczne potwierdzenie przed zamknięciem planu.

---

## Testing Strategy

### Unit Tests:
- `isValidOtpCode`: 6 cyfr → true; 5/7 cyfr, litery, puste, spacje → false.

### Integration Tests:
- Brak — OTP przychodzi mailem, nie da się w pełni zautomatyzować (świadoma decyzja).

### Manual Testing Steps:
1. Zarejestruj się `stasiuklge@gmail.com` + hasło → sprawdź mail z kodem.
2. Wpisz kod na `/auth/verify` → redirect na logowanie z banerem „Konto potwierdzone".
3. Zaloguj się hasłem → dashboard.
4. Powtórz z błędnym kodem → komunikat błędu.
5. Wejdź na `/auth/verify` bez `?email` → komunikat powrotu, brak 500.

## Migration Notes

Konfiguracja auth (nie ma migracji SQL dla auth-config) — zastosować przez Management API
`PATCH /v1/projects/fznbmibpguvffztlvehe/config/auth`:
- `mailer_autoconfirm=false`
- SMTP: `smtp_host=smtp.resend.com`, `smtp_port=465`, `smtp_user=resend`, `smtp_pass=<klucz Resend>`, `smtp_admin_email=onboarding@resend.dev`, `smtp_sender_name=Zwrotnik`
- Szablon: `mailer_subjects_confirmation="Twój kod do Zwrotnika"`, `mailer_templates_confirmation_content` z treścią PL zawierającą `{{ .Token }}`.
Rollback: `mailer_autoconfirm=true` przywraca poprzednie zachowanie (rejestracja bez kodu).

## References
- Serwis auth: `src/pages/api/auth/{signup,signin}.ts`, `src/lib/supabase.ts`
- Wzorzec banera: `src/pages/auth/signin.astro` (`registered`)
- Lekcja o `.astro` redirect: archiwum `2026-06-30-manage-items`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend + konfiguracja Supabase

#### Automated
- [x] 1.1 Unit-testy przechodzą: `npm run test:unit`
- [x] 1.2 Typecheck przechodzi: `npx astro check`
- [x] 1.3 Linting przechodzi: `npm run lint`
- [x] 1.4 Build przechodzi: `npm run build`

### Phase 2: UI weryfikacji + pełny przepływ

#### Automated
- [ ] 2.1 Typecheck przechodzi: `npx astro check`
- [ ] 2.2 Linting przechodzi: `npm run lint`
- [ ] 2.3 Build przechodzi: `npm run build`

#### Manual
- [ ] 2.4 Rejestracja `stasiuklge@gmail.com` → e-mail z 6-cyfrowym kodem dociera
- [ ] 2.5 Poprawny kod → redirect `/auth/signin?confirmed=1` z banerem; logowanie hasłem → dashboard
- [ ] 2.6 Zły kod → komunikat błędu, konto niepotwierdzone
- [ ] 2.7 `/auth/verify` bez `?email` → komunikat „wróć do rejestracji", brak 500
