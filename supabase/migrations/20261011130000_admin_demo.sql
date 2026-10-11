-- Explicit admin-configured demonstrations use real reserved credits and actual short time.
begin;
create table private.demo_policy (
 id uuid primary key check(id='d3000000-0000-4000-8000-000000000001'),
 enabled boolean not null default false,
 duration_minutes integer not null default 1 check(duration_minutes between 1 and 10),
 cost_units integer not null default 30 check(cost_units in(30,60,90,120,150,180)),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default clock_timestamp()
);
insert into private.demo_policy(id) values('d3000000-0000-4000-8000-000000000001');
revoke all on private.demo_policy from public,anon,authenticated;
alter table public.bookings add column is_demo boolean not null default false;
alter table public.bookings add column demo_policy_version integer;
alter table public.bookings drop constraint bookings_duration_minutes_check;
alter table public.bookings drop constraint bookings_check;
alter table public.bookings add constraint booking_mode_terms check (
 (not is_demo and duration_minutes in(30,60,90) and cost_units=duration_minutes and demo_policy_version is null)
 or (is_demo and duration_minutes between 1 and 10 and cost_units in(30,60,90,120,150,180) and demo_policy_version is not null and demo_policy_version>0)
);
create function public.read_demo_policy() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.booking_actor();
 return (select jsonb_build_object('enabled',enabled,'durationMinutes',duration_minutes,'costUnits',cost_units,'version',version) from private.demo_policy);
end;$$;


create or replace function private.create_booking_with_mode(p_teacher_id uuid,p_skill_id uuid,p_starts_at timestamptz,p_duration integer,p_key uuid,p_demo_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.booking_actor(); b public.bookings; old private.booking_idempotency;
 payload jsonb := jsonb_build_object('teacher',p_teacher_id,'skill',p_skill_id,'start',p_starts_at,'duration',p_duration);
 result jsonb; at_time timestamptz; quick_call boolean := p_starts_at is null; policy private.demo_policy; cost integer; demo boolean := p_demo_version is not null;
begin
 -- MVP serializes booking operations, then locks participant rows in UUID order.
 -- The exclusion constraint independently prevents both-role overlap.
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 if demo then payload := payload || jsonb_build_object('demoVersion',p_demo_version); end if;
 perform private.expire_booking_requests(v_actor);
 if p_key is null then return jsonb_build_object('error','VALIDATION_ERROR'); end if;
 select * into old from private.booking_idempotency i where i.actor=v_actor and i.operation='create' and request_key=p_key;
 if found then
  if old.input <> payload then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT'); end if;
  return old.result;
 end if;
 if demo then
  select * into policy from private.demo_policy;
  if not policy.enabled or policy.version<>p_demo_version then return jsonb_build_object('error','INVALID_STATE');end if;
  p_duration:=policy.duration_minutes;cost:=policy.cost_units;
 else cost:=p_duration;end if;
 at_time := clock_timestamp();
 if p_teacher_id is null or p_teacher_id=v_actor or p_skill_id is null
  or p_duration is null or (not demo and p_duration not in (30,60,90))
  or (not quick_call and (p_starts_at < at_time + interval '15 minutes' or p_starts_at > at_time + interval '30 days')) then
  return jsonb_build_object('error','VALIDATION_ERROR');
 end if;
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_teacher_id and u.email_confirmed_at is not null) then
  return jsonb_build_object('error','NOT_FOUND');
 end if;
 perform id from public.profiles where id in(v_actor,p_teacher_id) order by id for update;
 perform private.expire_booking_requests(p_teacher_id);
 if not exists(select 1 from public.user_skills u join public.skills s on s.id=u.skill_id
   where u.user_id=p_teacher_id and u.skill_id=p_skill_id and u.direction='offered' and s.enabled) then
  return jsonb_build_object('error','VALIDATION_ERROR');
 end if;
 at_time := clock_timestamp();
 -- Derive immediate-call time only after replay lookup and participant locks.
 -- Keep the original null in payload so retries return the original booking.
 if quick_call then p_starts_at := at_time + case when demo then interval '1 minute' else interval '5 minutes' end; end if;
 if not quick_call and (p_starts_at < at_time + interval '15 minutes' or p_starts_at > at_time + interval '30 days') then
  return jsonb_build_object('error','VALIDATION_ERROR');
 end if;
 if exists(select 1 from private.booking_occupancy where user_id in(v_actor,p_teacher_id)
   and during && tstzrange(p_starts_at,p_starts_at+p_duration*interval '1 minute','[)')) then
  return jsonb_build_object('error','SCHEDULE_CONFLICT');
 end if;
 perform private.ensure_starter(v_actor);perform private.ensure_starter(p_teacher_id);
 perform user_id from public.wallets where user_id in(v_actor,p_teacher_id) order by user_id for update;
 if (select settled_units-reserved_units from public.wallets where user_id=v_actor)<cost then return jsonb_build_object('error','INSUFFICIENT_CREDITS');end if;
 begin
  insert into public.bookings(teacher_id,learner_id,skill_id,starts_at,ends_at,duration_minutes,cost_units,request_expires_at,created_at,updated_at,credit_reservation_status,is_demo,demo_policy_version)
   values(p_teacher_id,v_actor,p_skill_id,p_starts_at,p_starts_at+p_duration*interval '1 minute',p_duration,cost,
    least(at_time+interval '24 hours',p_starts_at),at_time,at_time,'held',demo,p_demo_version) returning * into b;
  insert into private.booking_occupancy(booking_id,user_id,during)
   values(b.id,v_actor,tstzrange(b.starts_at,b.ends_at,'[)')),(b.id,p_teacher_id,tstzrange(b.starts_at,b.ends_at,'[)'));
  insert into public.reservations(booking_id,learner_id,units,status) values(b.id,v_actor,cost,'held');
  update public.wallets set reserved_units=reserved_units+cost where user_id=v_actor;
 exception when exclusion_violation then
  return jsonb_build_object('error','SCHEDULE_CONFLICT');
 end;
 result := jsonb_build_object('booking',private.booking_json(b));
 insert into private.booking_idempotency(actor,operation,request_key,input,result) values(v_actor,'create',p_key,payload,result);
 return result;
end;
$$;


create or replace function public.create_booking_request(p_teacher_id uuid,p_skill_id uuid,p_starts_at timestamptz,p_duration integer,p_key uuid)
returns jsonb language sql security definer set search_path='' as $$
 select private.create_booking_with_mode(p_teacher_id,p_skill_id,p_starts_at,p_duration,p_key,null);
$$;
create function public.create_demo_booking(p_teacher_id uuid,p_skill_id uuid,p_policy_version integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_policy_version is null or p_policy_version<=0 then return jsonb_build_object('error','VALIDATION_ERROR');end if;
 return private.create_booking_with_mode(p_teacher_id,p_skill_id,null,null,p_key,p_policy_version);
end;$$;
revoke all on function private.create_booking_with_mode(uuid,uuid,timestamptz,integer,uuid,integer) from public,anon,authenticated;
revoke all on function public.read_demo_policy(),public.create_demo_booking(uuid,uuid,integer,uuid) from public,anon;
grant execute on function public.read_demo_policy(),public.create_demo_booking(uuid,uuid,integer,uuid) to authenticated;


create or replace function public.admin_read(p_section text default 'overview',p_page integer default 0,p_search text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_admin();rows jsonb;total bigint;pattern text:='%'||btrim(p_search)||'%';begin
 if p_page is null or p_page<0 or p_page>4000 or p_search is null or length(p_search)>100 then raise exception 'Invalid page' using errcode='22023';end if;
 if p_section='demo' then
  return jsonb_build_object('rows',(select jsonb_agg(to_jsonb(d)) from private.demo_policy d),'total',1,'counts','{}'::jsonb);
 elsif p_section='overview' then
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
  with r as(select b.id,b.starts_at,b.ends_at,b.state,b.is_demo,b.duration_minutes,b.cost_units,b.credit_reservation_status,
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

create or replace function public.admin_manage(p_action text,p_target uuid,p_value jsonb,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;prior private.admin_audit;before_data jsonb;after_data jsonb;result jsonb;target_id uuid:=p_target;
 payload jsonb:=jsonb_build_object('action',p_action,'target',p_target,'value',p_value,'reason',btrim(p_reason));audit_id uuid:=gen_random_uuid();flag boolean;begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 v_actor:=private.require_admin();
 if p_key is null or p_reason is null or length(btrim(p_reason)) not between 10 and 500 or p_value is null or jsonb_typeof(p_value)<>'object' then
  raise exception 'Invalid admin action' using errcode='22023';end if;
 select * into prior from private.admin_audit a where a.actor=v_actor and a.request_key=p_key;
 if found then if prior.input<>payload then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');end if;return prior.result;end if;
 if p_action not in('create_skill','configure_demo') and (p_target is null or p_value<>'{}'::jsonb) then raise exception 'Invalid action input' using errcode='22023';end if;
 if p_action='configure_demo' then
  if p_target is not null or p_value-array['enabled','durationMinutes','costUnits','version']<>'{}'::jsonb
   or jsonb_typeof(p_value->'enabled') is distinct from 'boolean'
   or jsonb_typeof(p_value->'durationMinutes') is distinct from 'number'
   or jsonb_typeof(p_value->'costUnits') is distinct from 'number'
   or jsonb_typeof(p_value->'version') is distinct from 'number'
   or (p_value->>'durationMinutes')!~'^[0-9]{1,2}$' or (p_value->>'costUnits')!~'^[0-9]{1,3}$'
   or (p_value->>'version')!~'^[0-9]{1,9}$'
   or (p_value->>'durationMinutes')::integer not between 1 and 10
   or (p_value->>'costUnits')::integer not in(30,60,90,120,150,180) then raise exception 'Invalid demo policy' using errcode='22023';end if;
  select to_jsonb(d) into before_data from private.demo_policy d for update;
  if (before_data->>'version')::integer<>(p_value->>'version')::integer then return jsonb_build_object('error','INVALID_STATE');end if;
  target_id:='d3000000-0000-4000-8000-000000000001';
  update private.demo_policy set enabled=(p_value->>'enabled')::boolean,duration_minutes=(p_value->>'durationMinutes')::integer,
   cost_units=(p_value->>'costUnits')::integer,version=version+1,updated_at=clock_timestamp();
  select to_jsonb(d) into after_data from private.demo_policy d;
 elsif p_action in('suspend_member','restore_member','grant_admin','revoke_admin') then
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

create or replace function public.create_feedback(p_booking_id uuid,p_rating integer,p_comment text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.booking_actor();b public.bookings;f public.feedback;old private.booking_idempotency;
 op text:='feedback:'||p_booking_id::text;payload jsonb;result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 select * into b from public.bookings where id=p_booking_id and v_actor in(teacher_id,learner_id);
 if not found then return jsonb_build_object('error','NOT_FOUND');end if;
 if p_key is null or p_rating is null or p_rating not between 1 and 5 or p_comment is null or char_length(p_comment)>500 then
  return jsonb_build_object('error','VALIDATION_ERROR');end if;
 payload:=jsonb_build_object('rating',p_rating,'comment',btrim(p_comment));
 select * into old from private.booking_idempotency where booking_idempotency.actor=v_actor and operation=op and request_key=p_key;
 if found then
  if old.input<>payload then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');end if;
  return old.result;
 end if;
 if b.is_demo or b.state<>'completed' or b.credit_reservation_status<>'settled' or b.ends_at>clock_timestamp() then return jsonb_build_object('error','INVALID_STATE');end if;
 if exists(select 1 from public.feedback where booking_id=b.id and reviewer_id=v_actor) then return jsonb_build_object('error','ALREADY_REVIEWED');end if;
 insert into public.feedback(booking_id,reviewer_id,reviewee_id,rating,comment)
 values(b.id,v_actor,case when v_actor=b.teacher_id then b.learner_id else b.teacher_id end,p_rating,btrim(p_comment)) returning * into f;
 result:=jsonb_build_object('feedback',to_jsonb(f));
 insert into private.booking_idempotency(actor,operation,request_key,input,result) values(v_actor,op,p_key,payload,result);
 return result;
end;
$$;

create or replace function private.guard_feedback() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 if tg_op<>'INSERT' then raise exception 'Feedback is immutable' using errcode='42501';end if;
 select * into b from public.bookings where id=new.booking_id for share;
 if not found or b.is_demo or b.state<>'completed' or b.credit_reservation_status<>'settled' or b.ends_at>clock_timestamp()
  or not ((new.reviewer_id=b.teacher_id and new.reviewee_id=b.learner_id) or (new.reviewer_id=b.learner_id and new.reviewee_id=b.teacher_id)) then
  raise exception 'Feedback requires eligible completed participants' using errcode='23514';end if;
 return new;
end;
$$;

commit;
