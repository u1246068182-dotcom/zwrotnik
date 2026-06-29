# Roadmap — Zwrotnik

Sekwencja pracy nad MVP. Strategia: **vertical-first** — north star tak wcześnie,
jak pozwalają fundamenty. `main_goal: speed`, `top_blocker: time`.

## Vision recap

Dodaję zakup → widzę, ile dni i ile złotych jest zagrożonych, zanim okno się
zamknie. Jedna lista wg pilności (zwroty, rękojmia, subskrypcje).

## North star

**S-01** — użytkownik dodaje zakup i natychmiast widzi go na liście z poprawnym
statusem pilności, liczbą dni i kwotą. To moment, w którym teza produktu działa
end-to-end.

## At a glance

| ID   | Change ID                  | Outcome                                                     | Prereq        | Status   |
| ---- | -------------------------- | ---------------------------------------------------------- | ------------- | -------- |
| F-01 | supabase-auth-and-gating   | Ścieżki produktowe chronione logowaniem (Supabase Auth)    | —             | ready    |
| F-02 | first-prod-deploy          | Pierwszy deploy PWA na publiczny URL                       | —             | ready    |
| F-03 | data-model-and-rls         | Tabela `items` + RLS per użytkownik                        | F-01          | ready    |
| S-01 | first-urgency-loop         | Dodany zakup pojawia się na liście z policzonym statusem    | F-01,F-03     | proposed |
| S-02 | all-window-types           | Obsługa rękojmi i subskrypcji obok zwrotu                  | S-01          | proposed |
| S-03 | manage-items               | Edycja, usuwanie i oznaczanie "Załatwione"                 | S-01          | proposed |
| S-04 | free-limit-upsell          | Limit 30 pozycji dla planu free + komunikat upsell         | S-01          | proposed |

## Baseline

Greenfield — projekt od zera. Wszystkie warstwy (frontend, backend, data, auth,
deploy) jako `absent` → uzasadniają fundamenty F-01..F-03.

## Foundations

### F-01: supabase-auth-and-gating
- **Unlocks:** S-01
- Projekt Supabase, logowanie e-mail+hasło, ochrona ścieżek produktowych.

### F-02: first-prod-deploy
- **Unlocks:** S-01
- Pusty szkielet PWA wypchnięty na Vercel/Cloudflare — publiczny URL działa.

### F-03: data-model-and-rls
- **Unlocks:** S-01
- Tabela `items` + `profiles.plan`; polityki RLS: user czyta/pisze tylko swoje.

## Slices

### S-01: First urgency loop (north star)
- **Outcome:** User can dodać pozycję typu `zwrot` i zobaczyć ją na liście z
  policzonym statusem, liczbą dni i kwotą oraz sumą "Zagrożone".
- **Change ID:** first-urgency-loop
- **PRD refs:** US-01, US-02, FR-003, FR-004, FR-005, FR-006, FR-007
- **Prerequisites:** F-01, F-03
- **Risk:** To jest klin produktu — jeśli pętla pilności nie działa, reszta nie
  ma znaczenia. Sekwencjonowane pierwsze.
- **Status:** proposed

### S-02: All window types
- **Outcome:** User can dodać pozycję typu `rekojmia` (2 lata) i `subskrypcja`
  (data odnowienia), a status liczy się poprawnie dla każdego typu.
- **Change ID:** all-window-types
- **PRD refs:** FR-003, FR-004
- **Prerequisites:** S-01
- **Status:** proposed

### S-03: Manage items
- **Outcome:** User can edytować, usunąć i oznaczyć pozycję jako "Załatwione";
  lista i suma od razu się aktualizują.
- **Change ID:** manage-items
- **PRD refs:** US-03, US-04, FR-008, FR-009, FR-010
- **Prerequisites:** S-01
- **Status:** proposed

### S-04: Free limit + upsell
- **Outcome:** User na planie free z 30 pozycjami widzi komunikat o limicie przy
  próbie dodania kolejnej (bez realnej płatności).
- **Change ID:** free-limit-upsell
- **PRD refs:** US-06, FR-011
- **Prerequisites:** S-01
- **Status:** proposed

## Backlog Handoff

Po S-01 dorzucić quality gate: test jednostkowy silnika statusów (progi + sort) i
test autoryzacji (IDOR) — patrz `test-plan.md`. CI uruchamia je na każdy PR.

## Open Roadmap Questions

- Czy długość okna zwrotu (14 dni) ma być edytowalna już w MVP (FR-012, could)?
- Czy "Załatwione" archiwizuje, czy trwale usuwa? (MVP: ukrywa z aktywnej listy.)

## Parked (wersja 2, po certyfikacie)

- Realne płatności: jednorazowe odblokowanie 9,99 zł powyżej 30 pozycji.
- Migracja/rozbudowa na GCP.
- Auto-parsowanie maili (AI) + presety polskich sklepów (Allegro, Zalando, x-kom).
- Powiadomienia push/e-mail + tygodniowy digest "uratowaliśmy Ci X zł".
- Natywne aplikacje (Expo/React Native) na ten sam backend.
- Landing page + SEO pod frazy "termin zwrotu", "rękojmia".

## Done

—
