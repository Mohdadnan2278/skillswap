begin;

create table private.admin_members (
 user_id uuid primary key references auth.users(id) on delete restrict,
 granted_by uuid references auth.users(id) on delete restrict,
 granted_at timestamptz not null default clock_timestamp()
);
create table private.member_suspensions (
 user_id uuid primary key references auth.users(id) on delete restrict,
 suspended boolean not null, reason text not null,
 changed_by uuid not null references auth.users(id) on delete restrict,
 changed_at timestamptz not null default clock_timestamp()
);
create table private.feedback_moderation (
 feedback_id uuid primary key references public.feedback(id) on delete restrict,
 hidden boolean not null, reason text not null,
 changed_by uuid not null references auth.users(id) on delete restrict,
 changed_at timestamptz not null default clock_timestamp()
);
create table private.dispute_reviews (
 booking_id uuid primary key references public.booking_disputes(booking_id) on delete restrict,
 reason text not null, reviewed_by uuid not null references auth.users(id) on delete restrict,
 reviewed_at timestamptz not null default clock_timestamp()
);
create table private.admin_audit (
 id uuid primary key default gen_random_uuid(),
 actor uuid not null references auth.users(id) on delete restrict,
 action text not null, target uuid not null, reason text not null,
 before_value jsonb, after_value jsonb, request_key uuid not null,
 input jsonb not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp(), unique(actor,request_key)
);
create index admin_audit_time on private.admin_audit(created_at desc,id desc);
revoke all on private.admin_members,private.member_suspensions,private.feedback_moderation,private.dispute_reviews,private.admin_audit from public,anon,authenticated;
create trigger admin_audit_immutable before update or delete on private.admin_audit
 for each row execute function private.reject_ledger_mutation();

create function public.account_access() returns jsonb language sql volatile security definer set search_path='' as $$
 select jsonb_build_object('suspended',exists(select 1 from private.member_suspensions s where s.user_id=auth.uid() and s.suspended),
 'isAdmin',exists(select 1 from private.admin_members a where a.user_id=auth.uid())
 and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null)
 and not exists(select 1 from private.member_suspensions s where s.user_id=auth.uid() and s.suspended));
$$;
create function public.account_is_active() returns boolean language sql volatile security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null)
 and not exists(select 1 from private.member_suspensions s where s.user_id=auth.uid() and s.suspended);
$$;
create function public.member_is_visible(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.member_suspensions s where s.user_id=p_user and s.suspended);
$$;
create function public.feedback_is_visible(p_feedback uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.feedback_moderation m where m.feedback_id=p_feedback and m.hidden);
$$;
revoke all on function public.account_access(),public.account_is_active(),public.member_is_visible(uuid),public.feedback_is_visible(uuid) from public,anon;
grant execute on function public.account_access(),public.account_is_active(),public.member_is_visible(uuid),public.feedback_is_visible(uuid) to authenticated;

create function private.guard_member_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not public.account_is_active() then raise exception 'Account unavailable' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
revoke all on function private.guard_member_access() from public,anon,authenticated;
do $$ declare t text;begin
 foreach t in array array['profiles','account_preferences','user_skills','bookings','wallets','reservations','ledger_entries','booking_confirmations','booking_disputes','booking_dispute_votes','feedback'] loop
  execute format('create trigger member_access_guard before insert or update or delete on public.%I for each row execute function private.guard_member_access()',t);
 end loop;
 foreach t in array array['profiles','account_preferences','skills','user_skills','bookings','wallets','reservations','ledger_entries','booking_confirmations','booking_disputes','booking_dispute_votes','feedback'] loop
  execute format('create policy active_member_read on public.%I as restrictive for select to authenticated using ((select public.account_is_active()))',t);
 end loop;
end;$$;
create policy visible_profiles on public.profiles as restrictive for select to authenticated using(public.member_is_visible(id));
create policy visible_feedback on public.feedback as restrictive for select to authenticated using(public.feedback_is_visible(id));

create or replace function private.booking_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();begin
 if not public.account_is_active() then raise exception 'Verified active account required' using errcode='42501';end if;
 if not exists(select 1 from public.profiles where id=v_actor) then raise exception 'Onboarding required' using errcode='P0001';end if;
 return v_actor;
end;$$;

create function private.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();begin
 if not public.account_is_active() or not exists(select 1 from private.admin_members a where a.user_id=v_actor) then
  raise exception 'Administrator required' using errcode='42501';end if;
 return v_actor;
end;$$;
revoke all on function private.require_admin() from public,anon,authenticated;

create function public.admin_read(p_section text default 'overview',p_page integer default 0,p_search text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_admin();rows jsonb;total bigint;pattern text:='%'||btrim(p_search)||'%';begin
 if p_page is null or p_page<0 or p_page>4000 or p_search is null or length(p_search)>100 then raise exception 'Invalid page' using errcode='22023';end if;
 if p_section='overview' then
  return jsonb_build_object('rows','[]'::jsonb,'total',0,'counts',jsonb_build_object(
   'members',(select count(*) from public.profiles),'admins',(select count(*) from private.admin_members),
   'suspended',(select count(*) from private.member_suspensions where suspended),
   'bookings',(select count(*) from public.bookings),'openDisputes',(select count(*) from public.booking_disputes where resolved_at is null),
   'skills',(select count(*) from public.skills),'hiddenFeedback',(select count(*) from private.feedback_moderation where hidden)));
 elsif p_section='members' then
  with r as(select p.id,p.display_name,u.email,p.college,p.created_at,
   exists(select 1 from private.admin_members a where a.user_id=p.id) as is_admin,
   coalesce(s.suspended,false) as suspended,w.settled_units,w.reserved_units
   from public.profiles p join auth.users u on u.id=p.id left join private.member_suspensions s on s.user_id=p.id
   left join public.wallets w on w.user_id=p.id where p.display_name ilike pattern or u.email ilike pattern),
   page as(select * from r order by created_at desc,id desc limit 25 offset p_page*25)
  select (select count(*) from r),(select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id desc),'[]') from page) into total,rows;
 elsif p_section='skills' then
  with r as(select * from public.skills where name ilike pattern or slug ilike pattern),
   page as(select * from r order by name,id limit 25 offset p_page*25)
  select (select count(*) from r),(select coalesce(jsonb_agg(to_jsonb(page) order by name,id),'[]') from page) into total,rows;
 elsif p_section in('bookings','disputes') then
  with r as(select b.id,b.starts_at,b.ends_at,b.state,b.cost_units,b.credit_reservation_status,
   t.display_name as teacher,l.display_name as learner,s.name as skill,d.reason as dispute_reason,d.resolved_at,
   rev.reason as review_note,rev.reviewed_at
   from public.bookings b join public.profiles t on t.id=b.teacher_id join public.profiles l on l.id=b.learner_id
   join public.skills s on s.id=b.skill_id left join public.booking_disputes d on d.booking_id=b.id
   left join private.dispute_reviews rev on rev.booking_id=b.id
   where (p_section='bookings' or d.booking_id is not null) and (b.id::text ilike pattern or t.display_name ilike pattern or l.display_name ilike pattern)),
   page as(select * from r order by starts_at desc,id desc limit 25 offset p_page*25)
  select (select count(*) from r),(select coalesce(jsonb_agg(to_jsonb(page) order by starts_at desc,id desc),'[]') from page) into total,rows;
 elsif p_section='feedback' then
  with r as(select f.id,f.rating,f.comment,f.created_at,a.display_name as reviewer,b.display_name as reviewee,
   coalesce(m.hidden,false) as hidden,m.reason as moderation_reason
   from public.feedback f join public.profiles a on a.id=f.reviewer_id join public.profiles b on b.id=f.reviewee_id
   left join private.feedback_moderation m on m.feedback_id=f.id
   where f.comment ilike pattern or a.display_name ilike pattern or b.display_name ilike pattern),
   page as(select * from r order by created_at desc,id desc limit 25 offset p_page*25)
  select (select count(*) from r),(select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id desc),'[]') from page) into total,rows;
 elsif p_section='audit' then
  with r as(select a.id,a.actor,p.display_name as administrator,a.action,a.target,a.reason,a.before_value,a.after_value,a.created_at
   from private.admin_audit a join public.profiles p on p.id=a.actor where a.action ilike pattern or a.reason ilike pattern),
   page as(select * from r order by created_at desc,id desc limit 25 offset p_page*25)
  select (select count(*) from r),(select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id desc),'[]') from page) into total,rows;
 else raise exception 'Unknown section' using errcode='22023';end if;
 return jsonb_build_object('rows',rows,'total',total,'counts','{}'::jsonb);
end;$$;

create function public.admin_manage(p_action text,p_target uuid,p_value jsonb,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;prior private.admin_audit;before_data jsonb;after_data jsonb;result jsonb;target_id uuid:=p_target;
 payload jsonb:=jsonb_build_object('action',p_action,'target',p_target,'value',p_value,'reason',btrim(p_reason));audit_id uuid:=gen_random_uuid();flag boolean;begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 v_actor:=private.require_admin();
 if p_key is null or p_reason is null or length(btrim(p_reason)) not between 10 and 500 or p_value is null or jsonb_typeof(p_value)<>'object' then
  raise exception 'Invalid admin action' using errcode='22023';end if;
 select * into prior from private.admin_audit a where a.actor=v_actor and a.request_key=p_key;
 if found then if prior.input<>payload then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');end if;return prior.result;end if;
 if p_action<>'create_skill' and (p_target is null or p_value<>'{}'::jsonb) then raise exception 'Invalid action input' using errcode='22023';end if;
 if p_action in('suspend_member','restore_member','grant_admin','revoke_admin') then
  if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_target and u.email_confirmed_at is not null) then return jsonb_build_object('error','NOT_FOUND');end if;
  select jsonb_build_object('isAdmin',exists(select 1 from private.admin_members where user_id=p_target),'suspended',coalesce((select suspended from private.member_suspensions where user_id=p_target),false)) into before_data;
  if p_action='suspend_member' and (p_target=v_actor or exists(select 1 from private.admin_members where user_id=p_target)) then return jsonb_build_object('error','INVALID_STATE');end if;
  if p_action='grant_admin' and coalesce((select suspended from private.member_suspensions where user_id=p_target),false) then return jsonb_build_object('error','INVALID_STATE');end if;
  if p_action='revoke_admin' and exists(select 1 from private.admin_members where user_id=p_target) and (select count(*) from private.admin_members)<=1 then return jsonb_build_object('error','INVALID_STATE');end if;
  if p_action in('suspend_member','restore_member') then
   insert into private.member_suspensions(user_id,suspended,reason,changed_by) values(p_target,p_action='suspend_member',btrim(p_reason),v_actor)
   on conflict(user_id) do update set suspended=excluded.suspended,reason=excluded.reason,changed_by=excluded.changed_by,changed_at=clock_timestamp();
  elsif p_action='grant_admin' then insert into private.admin_members(user_id,granted_by) values(p_target,v_actor) on conflict do nothing;
  else delete from private.admin_members where user_id=p_target;end if;
  select jsonb_build_object('isAdmin',exists(select 1 from private.admin_members where user_id=p_target),'suspended',coalesce((select suspended from private.member_suspensions where user_id=p_target),false)) into after_data;
 elsif p_action='create_skill' then
  if p_target is not null or p_value-array['slug','name','category']<>'{}'::jsonb
   or jsonb_typeof(p_value->'slug') is distinct from 'string' or jsonb_typeof(p_value->'name') is distinct from 'string' or jsonb_typeof(p_value->'category') is distinct from 'string'
   or length(p_value->>'slug') not between 2 and 60 or (p_value->>'slug')!~'^[a-z0-9]+(-[a-z0-9]+)*$'
   or length(btrim(p_value->>'name')) not between 2 and 80 or length(btrim(p_value->>'category')) not between 2 and 60 then raise exception 'Invalid skill' using errcode='22023';end if;
  if exists(select 1 from public.skills where slug=p_value->>'slug') then return jsonb_build_object('error','INVALID_STATE');end if;
  target_id:=gen_random_uuid();insert into public.skills(id,slug,name,category) values(target_id,p_value->>'slug',btrim(p_value->>'name'),btrim(p_value->>'category'));
  select to_jsonb(s) into after_data from public.skills s where s.id=target_id;
 elsif p_action in('enable_skill','disable_skill') then
  select to_jsonb(s) into before_data from public.skills s where s.id=p_target;
  if not found then return jsonb_build_object('error','NOT_FOUND');end if;
  update public.skills set enabled=p_action='enable_skill' where id=p_target;
  select to_jsonb(s) into after_data from public.skills s where s.id=p_target;
 elsif p_action in('hide_feedback','restore_feedback') then
  if not exists(select 1 from public.feedback where id=p_target) then return jsonb_build_object('error','NOT_FOUND');end if;
  flag:=coalesce((select hidden from private.feedback_moderation where feedback_id=p_target),false);before_data:=jsonb_build_object('hidden',flag);
  insert into private.feedback_moderation(feedback_id,hidden,reason,changed_by) values(p_target,p_action='hide_feedback',btrim(p_reason),v_actor)
  on conflict(feedback_id) do update set hidden=excluded.hidden,reason=excluded.reason,changed_by=excluded.changed_by,changed_at=clock_timestamp();
  after_data:=jsonb_build_object('hidden',p_action='hide_feedback');
 elsif p_action='review_dispute' then
  if not exists(select 1 from public.booking_disputes where booking_id=p_target and resolved_at is null) then return jsonb_build_object('error','INVALID_STATE');end if;
  select to_jsonb(r) into before_data from private.dispute_reviews r where r.booking_id=p_target;
  insert into private.dispute_reviews(booking_id,reason,reviewed_by) values(p_target,btrim(p_reason),v_actor)
  on conflict(booking_id) do update set reason=excluded.reason,reviewed_by=excluded.reviewed_by,reviewed_at=clock_timestamp();
  select to_jsonb(r) into after_data from private.dispute_reviews r where r.booking_id=p_target;
 else raise exception 'Unknown action' using errcode='22023';end if;
 result:=jsonb_build_object('auditId',audit_id,'targetId',target_id);
 insert into private.admin_audit(id,actor,action,target,reason,before_value,after_value,request_key,input,result)
 values(audit_id,v_actor,p_action,target_id,btrim(p_reason),before_data,after_data,p_key,payload,result);
 return result;
end;$$;
revoke all on function public.admin_read(text,integer,text),public.admin_manage(text,uuid,jsonb,text,uuid) from public,anon;
grant execute on function public.admin_read(text,integer,text),public.admin_manage(text,uuid,jsonb,text,uuid) to authenticated;
commit;
