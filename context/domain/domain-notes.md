# Notatki o domenie (DDD) — Zwrotnik (10xArchitect L5)

Notatki inspirowane Domain-Driven Design: język, model, reguły i granice domeny.

## Problem domenowy
Ludzie tracą pieniądze, bo **przegapiają terminy** związane z zakupami: okno zwrotu, okres rękojmi,
koniec subskrypcji, ważność vouchera itp. Zwrotnik pilnuje tych terminów i uwidacznia **kwotę zagrożoną**.

## Język wszechobecny (ubiquitous language)
| Termin | Znaczenie w domenie |
| --- | --- |
| **Pozycja** (Item) | Pojedyncza rzecz z terminem: nazwa, sklep, kwota, data odniesienia, typ okna. |
| **Okno** (typ_okna) | Rodzaj terminu: `zwrot`, `rekojmia`, `subskrypcja`, `wlasny`. Determinuje sposób liczenia daty zamknięcia. |
| **Data odniesienia** | Data wejściowa (zakupu / odnowienia / dowolna) — podstawa obliczeń. |
| **Data zamknięcia** | Wyliczony dzień, w którym okno się zamyka (deadline). |
| **Pilność** (status) | `Pilne` / `Wkrótce` / `Spokojnie` / `Minęło` — wg liczby dni do zamknięcia. |
| **Zagrożone** | Suma kwot pozycji `Pilne` + `Wkrótce` — pieniądze realnie zagrożone. |
| **Załatwione** | Pozycja obsłużona — znika z aktywnej listy (soft-hide), można przywrócić. |
| **Przypomnienie** | Jednorazowy alert e-mail na konkretny moment; po wysłaniu znika. |
| **Plan** | `free` / `premium` — reguła limitu liczby aktywnych pozycji. |

## Model i agregaty
- **Agregat `Pozycja`** — korzeń domeny. Zawiera swoje dane + stan (`status_zalatwione`, `reminder_at`).
  Wszystkie zmiany idą przez operacje serwisu; niezmienniki pilnowane w warstwie logiki + bazie.
- **`Profil`** (`profiles.plan`) — trzyma plan użytkownika; wejście do reguły limitu.
- **`Użytkownik`** (auth.users, Supabase) — właściciel pozycji; granica własności.

## Reguły domenowe (niezmienniki)
1. **Data zamknięcia zależy od typu okna** (funkcja czysta `computeCloseDate`):
   - `zwrot` → data + 14 dni (lub własna długość),
   - `rekojmia` → data + 730 dni,
   - `subskrypcja` / `wlasny` → sama wpisana data.
2. **Pilność wg progów dni** (`statusForDays`): `<0` Minęło · `0–3` Pilne · `4–14` Wkrótce · `>14` Spokojnie.
3. **„Zagrożone" = Pilne + Wkrótce** (suma kwot); pozycje `Załatwione` nie liczą się.
4. **Sortowanie w kubełku** malejąco wg kwoty (najpierw największe ryzyko finansowe).
5. **Kwota dodatnia**, data w formacie `YYYY-MM-DD`, typ okna z dozwolonego zbioru (walidacja zod + CHECK w bazie).
6. **Przypomnienie tylko w przyszłości**; po wysłaniu `reminder_at → null` (model 2-stanowy: jest / nie ma).
7. **Limit planu free** ogranicza liczbę aktywnych pozycji (miękkie egzekwowanie z komunikatem).
8. **Własność danych** — użytkownik operuje wyłącznie na swoich pozycjach.

## Granice (bounded contexts) i miejsce egzekwowania reguł
- **Kontekst pilności** — czysta domena (`urgency.ts`), bez I/O; łatwo testowalna, deterministyczna (`today` wstrzykiwane).
- **Kontekst przypomnień** — czas/strefa + harmonogram (`reminders.ts` + endpoint cron); reguła należności oddzielona od wysyłki.
- **Kontekst tożsamości/dostępu** — Supabase Auth + **RLS** jako twarda granica własności (reguła 8 egzekwowana w bazie, nie w kodzie aplikacji — kluczowa decyzja: bezpieczeństwo nie zależy od poprawności warstwy aplikacji).
- **Kontekst planu/monetyzacji** — reguła limitu (`plan.ts`), na razie miękka.

## Świadome uproszczenia (dług / rozszerzenia)
- Jedno przypomnienie na pozycję (bez powtarzalnych) — model 2-stanowy.
- Limit planu egzekwowany komunikatem, bez realnej płatności (wersja 2).
- Strefa czasu przypięta do Europe/Warsaw (z DST) — brak per-user TZ.
- Długość okna zwrotu domyślnie 14 dni (edytowalna per pozycja polem, ale bez dedykowanego UX).
