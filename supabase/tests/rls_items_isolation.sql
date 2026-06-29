-- Test izolacji RLS dla public.items (ryzyko R2 / IDOR z test-planu).
-- Dowodzi: użytkownik A widzi wyłącznie własną pozycję; użytkownik B nie może jej
-- zobaczyć, edytować ani usunąć. Symuluje sesje obu userów przez request.jwt.claims.
--
-- Wymaga: lokalnego Supabase z zastosowaną migracją oraz dwóch zarejestrowanych userów.
-- Uruchomienie:
--   npm run db:start && npm run db:reset
--   # zarejestruj test-a@zwrotnik.local i test-b@zwrotnik.local (POST /auth/v1/signup)
--   docker exec -i supabase_db_10x-astro-starter psql -U postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/rls_items_isolation.sql
-- Sukces = NOTICE "RLS PASS"; każda asercja rzuca wyjątek przy naruszeniu izolacji.

begin;
do $$
declare a uuid; b uuid; item uuid; cnt int;
begin
  select id into a from auth.users where email = 'test-a@zwrotnik.local';
  select id into b from auth.users where email = 'test-b@zwrotnik.local';
  assert a is not null and b is not null,
    'Najpierw zarejestruj test-a@zwrotnik.local i test-b@zwrotnik.local';

  -- jako A: wstaw pozycję, zobacz własną
  perform set_config('request.jwt.claims', json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.items (user_id, nazwa, kwota, data_odniesienia, typ_okna)
    values (a, 'Test A', 100, current_date, 'zwrot')
    returning id into item;
  select count(*) into cnt from public.items;
  assert cnt = 1, 'A powinien widziec 1 pozycje, widzi ' || cnt;
  reset role;

  -- jako B: nie widzi, nie edytuje, nie usuwa pozycji A
  perform set_config('request.jwt.claims', json_build_object('sub', b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from public.items;
  assert cnt = 0, 'B NIE powinien widziec pozycji A, widzi ' || cnt;
  update public.items set nazwa = 'HACK' where id = item;
  get diagnostics cnt = row_count;
  assert cnt = 0, 'B NIE powinien edytowac pozycji A, zmienil ' || cnt;
  delete from public.items where id = item;
  get diagnostics cnt = row_count;
  assert cnt = 0, 'B NIE powinien usunac pozycji A, usunal ' || cnt;
  reset role;

  -- jako A: pozycja nadal istnieje, nietknieta
  perform set_config('request.jwt.claims', json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from public.items where nazwa = 'Test A';
  assert cnt = 1, 'A powinien nadal widziec swoja pozycje nietknieta, widzi ' || cnt;
  reset role;

  raise notice 'RLS PASS: A=1, B=0, B bez edycji/usuwania, dane A nietkniete';
end $$;
rollback;
