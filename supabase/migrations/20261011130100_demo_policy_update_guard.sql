-- Target the singleton explicitly for PostgREST safe-update enforcement.
begin;

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
   cost_units=(p_value->>'costUnits')::integer,version=version+1,updated_at=clock_timestamp() where id=target_id;
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

commit;
