---
change_id: items-schema-rls
title: Schemat danych pozycji + RLS per użytkownik
status: implementing
created: 2026-06-29
updated: 2026-06-29
archived_at: null
---

## Notes

Fundament F-01 z roadmapy. Tabela `items` (+ `profiles.plan`) z politykami RLS „tylko własne rekordy". Realizuje guardrail prywatności (IDOR) i odblokowuje north star S-01.
