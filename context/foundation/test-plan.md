# Test Plan — Zwrotnik

Strategia testów oparta na ryzyku (impact × likelihood). Cel MVP: chronić
najważniejszy przepływ wartości i dostęp do danych, bez przesadnej suity.

## 1. Mapa ryzyk

Skala: Wysoki / Średni / Niski (wpływ i prawdopodobieństwo).

| ID | Scenariusz awarii (z perspektywy użytkownika)                                              | Wpływ   | Prawdop. | Priorytet | Źródło          |
| -- | ------------------------------------------------------------------------------------------- | ------- | -------- | --------- | --------------- |
| R1 | Zła kolejność/status sprawia, że user przegapia termin i traci pieniądze                    | Wysoki  | Wysoki   | **P0**    | PRD US-01/US-02 |
| R2 | User A odczytuje lub modyfikuje pozycje usera B (podmiana identyfikatora — IDOR)            | Wysoki  | Średni   | **P0**    | wymóg auth      |
| R3 | Błędne wyliczenie daty zamknięcia okna (np. rękojmia 2 lata) → fałszywy status              | Wysoki  | Średni   | **P1**    | Business Logic  |
| R4 | Limit free egzekwowany źle (blokuje za wcześnie albo wpuszcza ponad limit)                  | Średni  | Średni   | **P2**    | PRD US-06       |
| R5 | Brak walidacji wejścia (ujemna kwota, brak daty) psuje wyliczenia                          | Średni  | Niski    | **P3**    | wywiad          |

## 2. Źródła ryzyk

- `prd.md` — north star (US-01/02), reguła limitu (US-06), wymóg prywatności
  (US-05).
- Wymóg certyfikacji: autentykacja powiązana z użytkownikiem → ryzyko IDOR (R2).
- Business Logic w PRD — wyliczenia dat i statusów (R1, R3).

## 3. Profil istniejących testów

Greenfield — brak testów. Plan buduje zestaw od zera, zaczynając od P0.

## 4. Fazy QA

- **Faza 1 (P0):** test jednostkowy silnika statusów (R1) + test autoryzacji/RLS
  (R2). To jest minimum wymagane do certyfikatu (co najmniej jeden zestaw testów
  adresujący konkretne ryzyko).
- **Faza 2 (P1):** testy wyliczeń dat per typ okna (R3).
- **Faza 3 (P2/P3):** reguła limitu (R4), walidacja wejścia (R5).

## 5. Typy testów i wyrocznia

- **Jednostkowe (silnik):** dla danych wejściowych oczekiwany status/kolejność
  pochodzi z reguł w PRD (`dni<0`→Minęło, `0–3`→Pilne, `4–14`→Wkrótce, `>14`→
  Spokojnie; sort w kubełku wg kwoty malejąco), a **nie z implementacji**
  (unikamy problemu wyroczni).
  - Przykłady wyroczni: zakup z `data_zamkniecia` jutro → **Pilne**; rękojmia
    kupiona 1,5 roku temu → **Spokojnie**; okno minęło wczoraj → **Minęło**;
    w kubełku Pilne pozycja 299 zł nad pozycją 43 zł.
- **Integracyjne/autoryzacja (RLS):** zalogowany jako user B nie pobiera ani nie
  edytuje rekordu należącego do usera A (oczekiwany wynik: brak dostępu).
- **Limit (R4):** plan `free` z 30 pozycjami — 31. dodanie zwraca komunikat
  limitu; plan `premium` — przechodzi.

## 6. Quality Gates (CI)

- `lint` + `typecheck`
- testy jednostkowe (silnik statusów) — **must pass**
- test autoryzacji (IDOR/RLS) — **must pass**
- `build` PWA
Zmiana nie idzie do main, jeśli którakolwiek bramka świeci na czerwono.

## 7. Cookbook Patterns

TBD — uzupełnić po Fazie 1 (lokalizacja testów, polityka mockowania granicy
Supabase, komenda lokalna).

## Wykluczenia (świadomie nie testujemy w MVP)

- Wygląd/responsywność landing page (brak w MVP).
- Płatności (poza MVP).
- Auto-parsowanie maili (poza MVP).
