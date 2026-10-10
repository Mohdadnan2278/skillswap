-- Phase 3 only: no wallet, catalogue, booking or financial operations.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  bio text not null default '' check (char_length(bio) <= 500),
  college text not null default '' check (char_length(college) <= 120),
  onboarded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.account_preferences (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  timezone text not null,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.account_preferences enable row level security;
revoke all on public.profiles, public.account_preferences from public, anon, authenticated;
grant select on public.profiles, public.account_preferences to authenticated;
create policy profiles_member_read on public.profiles for select to authenticated using ((select auth.uid()) is not null);
create policy preferences_owner_read on public.account_preferences for select to authenticated using (user_id = (select auth.uid()));

-- Read identity from the signed JWT and authoritative Auth row; never an actor parameter.
-- Restricted function is the sole ordinary-member write path, and saves both rows atomically.
create function public.save_my_profile(p_display_name text, p_bio text, p_college text, p_timezone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = actor and email_confirmed_at is not null) then
    raise exception 'Verified email required' using errcode = '42501';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 60
     or p_bio is null or char_length(p_bio) > 500
     or p_college is null or char_length(p_college) > 120
     or p_timezone is null
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid profile fields' using errcode = '22023';
  end if;
  insert into public.profiles (id, display_name, bio, college)
    values (actor, btrim(p_display_name), btrim(p_bio), btrim(p_college))
  on conflict (id) do update set display_name = excluded.display_name,
    bio = excluded.bio, college = excluded.college, updated_at = now();
  insert into public.account_preferences (user_id, timezone)
    values (actor, p_timezone)
  on conflict (user_id) do update set timezone = excluded.timezone, updated_at = now();
end;
$$;
revoke all on function public.save_my_profile(text, text, text, text) from public, anon;
grant execute on function public.save_my_profile(text, text, text, text) to authenticated;
comment on function public.save_my_profile(text, text, text, text) is 'Phase 3 atomic owner-only profile save. Does not grant credits.';
commit;
