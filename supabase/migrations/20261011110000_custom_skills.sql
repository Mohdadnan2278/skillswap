begin;
-- A shared identity lets custom skills work with existing discovery and booking rules.
create unique index skills_normalized_name on public.skills
 (lower(regexp_replace(btrim(normalize(name,NFKC)), '[[:space:]]+', ' ', 'g')));

create table private.skill_submissions (
 user_id uuid not null references public.profiles(id) on delete restrict,
 skill_id uuid primary key references public.skills(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp()
);
create index skill_submissions_actor_time on private.skill_submissions(user_id,created_at);
revoke all on private.skill_submissions from public,anon,authenticated;

create function public.create_custom_skill(p_name text,p_category text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; skill public.skills; clean_name text; name_key text;
begin
 -- Match the existing admin lock so suspension and catalogue moderation serialize.
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 actor:=private.booking_actor();
 clean_name:=btrim(regexp_replace(normalize(p_name,NFKC),'[[:space:]]+',' ','g'));
 if clean_name is null or length(p_name)>200 or length(clean_name) not between 2 and 60
  or clean_name !~ '[[:alnum:]]' or clean_name ~ '[[:cntrl:]<>]'
  or p_category is null or p_category not in ('Programming','Creative','Music','Communication','Academic','Productivity','Languages','Lifestyle','Other') then
  raise exception 'Invalid custom skill' using errcode='22023';
 end if;
 name_key:=lower(clean_name);
 select * into skill from public.skills s
  where lower(regexp_replace(btrim(normalize(s.name,NFKC)),'[[:space:]]+',' ','g'))=name_key;
 if found then
  if not skill.enabled then return jsonb_build_object('error','SKILL_UNAVAILABLE');end if;
  return jsonb_build_object('skill',jsonb_build_object('id',skill.id,'slug',skill.slug,'name',skill.name,'category',skill.category),'created',false);
 end if;
 if (select count(*) from private.skill_submissions where user_id=actor and created_at>clock_timestamp()-interval '24 hours')>=10 then
  return jsonb_build_object('error','RATE_LIMITED');
 end if;
 skill.id:=gen_random_uuid();
 insert into public.skills(id,slug,name,category)
  values(skill.id,'custom-'||skill.id::text,clean_name,p_category) returning * into skill;
 insert into private.skill_submissions(user_id,skill_id) values(actor,skill.id);
 return jsonb_build_object('skill',jsonb_build_object('id',skill.id,'slug',skill.slug,'name',skill.name,'category',skill.category),'created',true);
end;$$;
revoke all on function public.create_custom_skill(text,text) from public,anon;
grant execute on function public.create_custom_skill(text,text) to authenticated;
commit;
