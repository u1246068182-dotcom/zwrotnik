-- F-01: schemat danych Zwrotnika — profiles (z planem) + items (pozycje silnika pilności) + RLS.
-- RLS: każdy użytkownik operuje wyłącznie na własnych rekordach (guardrail prywatności / IDOR).

-- profiles: 1 wiersz na użytkownika, pole planu pod przyszły limit/monetyzację
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  created_at timestamptz not null default now()
);

-- items: pozycje, na których działa silnik pilności (S-01)
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nazwa text not null,
  sklep text,
  kwota numeric(12, 2) not null,
  data_odniesienia date not null,
  typ_okna text not null check (typ_okna in ('zwrot', 'rekojmia', 'subskrypcja')),
  dlugosc_okna_dni integer,
  status_zalatwione boolean not null default false,
  created_at timestamptz not null default now()
);

create index items_user_id_idx on public.items (user_id);

-- włącz RLS
alter table public.profiles enable row level security;
alter table public.items enable row level security;

-- RLS dla items: granularnie per operacja, tylko własne (auth.uid() = user_id)
create policy items_select on public.items
  for select to authenticated using (auth.uid() = user_id);
create policy items_insert on public.items
  for insert to authenticated with check (auth.uid() = user_id);
create policy items_update on public.items
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy items_delete on public.items
  for delete to authenticated using (auth.uid() = user_id);

-- RLS dla profiles: tylko własny profil
create policy profiles_select on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy profiles_update on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- uprawnienia tabelaryczne: RLS bramkuje wiersze, ale rola authenticated potrzebuje też GRANT
-- (bez tego ani aplikacja przez supabase-js, ani zapytania nie sięgną tabel)
grant select, insert, update, delete on public.items to authenticated;
grant select, update on public.profiles to authenticated;

-- trigger: utwórz profil przy rejestracji.
-- security definer + pinned search_path — inaczej trigger cicho zawodzi (brak uprawnień do public).
create function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
