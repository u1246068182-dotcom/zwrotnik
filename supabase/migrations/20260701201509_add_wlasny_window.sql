-- Dodaje typ okna 'wlasny' (użytkownik wpisuje dowolną datę zamknięcia — jak subskrypcja).
alter table public.items drop constraint items_typ_okna_check;
alter table public.items add constraint items_typ_okna_check
  check (typ_okna in ('zwrot', 'rekojmia', 'subskrypcja', 'wlasny'));
