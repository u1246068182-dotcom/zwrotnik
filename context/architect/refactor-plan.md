# Plan refaktoryzacji — dyspozytor akcji pozycji (10xArchitect L4)

## Co i dlaczego
`src/pages/api/items/[id].ts` urósł: jeden `switch (action)` obsługuje **6 akcji**
(`update`, `delete`, `done`, `undone`, `set-reminder`, `clear-reminder`), miesza parsowanie formularza,
walidację (data/godzina przypomnienia), wywołania serwisu i decyzje o przekierowaniu. Każda nowa akcja
(np. cykliczne przypomnienia z researchu) puchnie ten plik i utrudnia testowanie pojedynczej gałęzi.

**Cel:** wydzielić akcje do małych, testowalnych handlerów wpiętych w prostą mapę, bez zmiany zachowania
(PRG, komunikaty, RLS) i bez zmiany kontraktu HTTP.

## Stan obecny (fakty)
- Endpoint: `POST /api/items/[id]`, gałęzie po `_action`; sukces → redirect `/dashboard`, błąd → `?error=`.
- Walidacja daty/godziny przypomnienia + „musi być w przyszłości" siedzi inline w gałęzi `set-reminder`.
- Serwis (`src/lib/services/items.ts`) już cienki i dobrze rozdzielony — to warstwa nad nim wymaga porządku.

## Docelowy kształt
- Typ handlera: `(ctx: { supabase, id, form }) => Promise<{ error?: string; redirect?: string }>`.
- `const ACTIONS: Record<string, Handler>` — mapa `_action → handler`; endpoint tylko: auth → wybór handlera → PRG.
- Handlery: `updateAction`, `deleteAction`, `doneAction`, `undoneAction`, `setReminderAction`, `clearReminderAction`
  (np. w `src/lib/actions/items.ts`). Logika parsowania/walidacji przypomnienia ląduje w `setReminderAction`.
- Nieznane `_action` → jednolity błąd „Nieznana operacja".

## Fazy (bezpiecznie, przyrostowo)
1. **Wydzielenie bez zmiany zachowania** — przenieść treść każdej gałęzi do funkcji-handlera; endpoint deleguje do mapy. Zero zmian kontraktu.
2. **Testy jednostkowe handlerów** — szczególnie `setReminderAction` (poprawna data → sukces; przeszła/niepoprawna → błąd; format). Dziś ta logika nie jest testowana wprost.
3. **(Opcjonalnie) współdzielony helper `opt()` i typ wyniku** — ujednolicić parsowanie pól formularza.

## Kryteria sukcesu
- Zachowane: te same redirecty i komunikaty (smoke jak dotychczas), izolacja RLS bez zmian.
- `npm run lint`, `npx astro check`, `npm run build`, testy — zielone.
- Nowe testy jednostkowe dla `setReminderAction` (walidacja „w przyszłości" i format).
- Dodanie kolejnej akcji = nowy handler + wpis w mapie (bez dotykania pozostałych).

## Ryzyko i mitigacja
- **Regresja PRG/komunikatów** → refaktor „mechaniczny" (kopiuj-wklej do handlera), potwierdzony smoke'em i tymi samymi testami.
- **Nadmierna abstrakcja** → celowo płaska mapa + prosty typ wyniku; bez frameworka.
- **Zakres** → tylko `[id].ts`; `index.ts` (create) i serwis bez zmian.
