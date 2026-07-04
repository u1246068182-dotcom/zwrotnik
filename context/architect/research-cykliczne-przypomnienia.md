---
topic: Cykliczne (powtarzalne) przypomnienia
researcher: Zwrotnik / 10xArchitect L3
---

# Research: cykliczne przypomnienia

## Cel
Dziś przypomnienie jest **jednorazowe** (model 2-stanowy: po wysłaniu `reminder_at → null`).
Zbadać, jak dodać **przypomnienia powtarzalne** (np. „przypominaj co 7 dni aż do zamknięcia okna"),
minimalnie ruszając istniejącą architekturę.

## Stan obecny (kod)
- Dane: `items.reminder_at timestamptz` (jedno, nullowalne). Brak informacji o powtarzalności.
- Ustawianie: `src/pages/api/items/[id].ts` (`set-reminder` → `warsawWallTimeToUTC` → `setReminder`), UI w `dashboard.astro`.
- Wysyłka: `src/pages/api/cron/send-reminders.ts` — co godzinę: znajduje `reminder_at <= now()` aktywne, wysyła (Resend), ustawia `reminder_at = null`.
- Logika należności: `isReminderDue` (`src/lib/reminders.ts`) — czysta funkcja, testowana.

## Architecture Insights
- Wysyłka i „należność" są oddzielone od I/O — łatwo rozszerzyć regułę bez dotykania endpointu.
- Cron już istnieje (GitHub Actions co godzinę) — powtarzalność to kwestia **przeliczenia następnego `reminder_at`** zamiast zerowania.
- Zerowanie po wysłaniu jest jedynym miejscem, które trzeba zmienić w endpointcie.

## Opcje rozwiązania
| Opcja | Na czym polega | Plus | Minus |
| --- | --- | --- | --- |
| A. Pole `reminder_interval_days` | Po wysyłce: jeśli interwał ustawiony i przed datą zamknięcia → `reminder_at += interval`, inaczej null | Mała zmiana (1 kolumna + 1 gałąź w cronie); spójne z 2-stanowym modelem | Tylko stały interwał |
| B. Tabela `reminders` (1..n na pozycję) | Osobne rekordy przypomnień | Pełna elastyczność, wiele przypomnień | Duża zmiana modelu, UI, RLS; przerost jak na MVP |
| C. Reguła „X dni przed zamknięciem" | Auto-generowanie z daty zamknięcia | Zero ręcznego ustawiania | Inny UX niż obecny (konkretna data/godzina) |

## Rekomendacja
**Opcja A** — najlepszy stosunek wartości do ryzyka: dokłada `reminder_interval_days` (nullable) i zmienia
tylko krok „po wysłaniu" w endpointcie (zamiast `null` → policz następny termin przez czystą funkcję
`nextReminderAt(reminderAt, intervalDays, closeDate)` w `reminders.ts`, testowaną jednostkowo).

## Ryzyka i pytania
- **Pętla wysyłki** przy złej dacie zamknięcia → funkcja musi zwrócić `null`, gdy następny termin ≥ data zamknięcia (test progu).
- **Strefa/DST** przy dodawaniu dni — trzymać w UTC, dni kalendarzowe liczyć spójnie z `warsawWallTimeToUTC`.
- **UX**: dodać wybór interwału obok daty+godziny; „Usuń przypomnienie" czyści też interwał.

## Punkty styku (pliki do zmiany)
- Migracja: `items` += `reminder_interval_days int`.
- `src/lib/reminders.ts`: `nextReminderAt(...)` (czysta) + testy.
- `src/pages/api/cron/send-reminders.ts`: po sukcesie — `update({ reminder_at: nextReminderAt(...) })`.
- `src/pages/api/items/[id].ts` + `dashboard.astro`: pole interwału.
