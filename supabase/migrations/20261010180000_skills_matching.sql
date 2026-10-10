begin;
create table public.skills (
 id uuid primary key, slug text not null unique, name text not null,
 category text not null, enabled boolean not null default true
);
create table public.user_skills (
 user_id uuid not null references public.profiles(id) on delete restrict,
 skill_id uuid not null references public.skills(id) on delete restrict,
 direction text not null check (direction in ('offered','wanted')),
 primary key (user_id, skill_id, direction)
);
create index user_skills_discovery on public.user_skills(direction, skill_id, user_id);
alter table public.skills enable row level security;
alter table public.user_skills enable row level security;
revoke all on public.skills, public.user_skills from public, anon, authenticated;
grant select on public.skills, public.user_skills to authenticated;
create policy skills_member_read on public.skills for select to authenticated using (enabled);
create policy user_skills_member_read on public.user_skills for select to authenticated using ((select auth.uid()) is not null);
insert into public.skills (id, slug, name, category) values
 ('41000000-0000-4000-8000-000000000001','python','Python','Programming'),
 ('41000000-0000-4000-8000-000000000002','web-development','Web development','Programming'),
 ('41000000-0000-4000-8000-000000000003','java','Java','Programming'),
 ('41000000-0000-4000-8000-000000000004','sql','SQL','Programming'),
 ('41000000-0000-4000-8000-000000000005','graphic-design','Graphic design','Creative'),
 ('41000000-0000-4000-8000-000000000006','photography','Photography','Creative'),
 ('41000000-0000-4000-8000-000000000007','video-editing','Video editing','Creative'),
 ('41000000-0000-4000-8000-000000000008','guitar','Guitar','Music'),
 ('41000000-0000-4000-8000-000000000009','public-speaking','Public speaking','Communication'),
 ('41000000-0000-4000-8000-000000000010','english-conversation','English conversation','Communication'),
 ('41000000-0000-4000-8000-000000000011','mathematics','Mathematics','Academic'),
 ('41000000-0000-4000-8000-000000000012','excel','Excel','Productivity');

create function public.replace_my_skills(p_offered uuid[], p_wanted uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
 if actor is null or not exists (select 1 from auth.users where id = actor and email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode = '42501';
 end if;
 -- Serialize replacement requests for the same account, including an empty selection.
 perform 1 from public.profiles where id = actor for update;
 if not found then raise exception 'Onboarding required' using errcode = 'P0001'; end if;
 if p_offered is null or p_wanted is null or cardinality(p_offered) > 20 or cardinality(p_wanted) > 20
  or exists (select 1 from unnest(p_offered || p_wanted) as x(id) where id is null)
  or (select count(distinct id) from unnest(p_offered) as x(id)) <> cardinality(p_offered)
  or (select count(distinct id) from unnest(p_wanted) as x(id)) <> cardinality(p_wanted)
  or exists (select 1 from unnest(p_offered || p_wanted) as x(id)
    where not exists (select 1 from public.skills s where s.id = x.id and s.enabled)) then
  raise exception 'Invalid skill selections' using errcode = '22023';
 end if;
 delete from public.user_skills where user_id = actor;
 insert into public.user_skills(user_id,skill_id,direction)
 select actor,id,'offered' from unnest(p_offered) as x(id)
 union all select actor,id,'wanted' from unnest(p_wanted) as x(id);
end;
$$;
revoke all on function public.replace_my_skills(uuid[],uuid[]) from public, anon;
grant execute on function public.replace_my_skills(uuid[],uuid[]) to authenticated;

-- One database statement keeps page membership and explanations consistent.
create function public.discover_members(p_after uuid default null, p_skill_id uuid default null, p_limit integer default 21)
returns table (id uuid, display_name text, bio text, college text, matched_skills jsonb)
language plpgsql stable security invoker set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if not exists (select 1 from public.profiles p where p.id = auth.uid()) then
  raise exception 'Onboarding required' using errcode = 'P0001';
 end if;
 if p_limit < 1 or p_limit > 51 or p_limit is null
  or (p_skill_id is not null and not exists (
   select 1 from public.user_skills w join public.skills s on s.id = w.skill_id
   where w.user_id = auth.uid() and w.direction = 'wanted' and w.skill_id = p_skill_id and s.enabled)) then
  raise exception 'Invalid discovery filter' using errcode = '22023';
 end if;
 return query
 select p.id,p.display_name,p.bio,p.college,
  jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'name',s.name,'category',s.category) order by s.slug)
 from public.profiles p
 join public.user_skills o on o.user_id = p.id and o.direction = 'offered'
 join public.skills s on s.id = o.skill_id and s.enabled
 join public.user_skills w on w.user_id = auth.uid() and w.direction = 'wanted' and w.skill_id = s.id
 where p.id <> auth.uid() and (p_after is null or p.id > p_after)
  and (p_skill_id is null or s.id = p_skill_id)
 group by p.id,p.display_name,p.bio,p.college
 order by p.id limit p_limit;
end;
$$;
revoke all on function public.discover_members(uuid,uuid,integer) from public, anon;
grant execute on function public.discover_members(uuid,uuid,integer) to authenticated;
commit;
