---
change_id: email-reminders
title: Przypomnienia mailowe (data+godzina, 1 na pozycję)
status: archived
created: 2026-07-01
updated: 2026-07-02
archived_at: 2026-07-02T04:08:03Z
---

## Notes

Per pozycja opcjonalne przypomnienie (data+godzina, czas polski→UTC). Model 2-stanowy: po wysłaniu maila
reminder_at wraca do null. GitHub Actions cron co godzinę → chroniony endpoint /api/cron/send-reminders
(service-role, Resend, zerowanie). Front: ustaw/usuń per pozycja, bez edycji. Sandbox Resend: maile tylko
na stasiuklge@gmail.com do czasu domeny.
