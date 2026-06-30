---
change_id: free-limit-upsell
title: Limit planu free (30 pozycji) + komunikat
status: implementing
created: 2026-06-30
updated: 2026-06-30
archived_at: null
---

## Notes

S-04 (FR-011). Plan `free` → limit 30 aktywnych pozycji; przy próbie dodania kolejnej komunikat (bez płatności — to wersja 2). Czysta funkcja `isOverFreeLimit` (unit-test, CI) + sprawdzenie w `createItem`. Prereq S-01 (done).
