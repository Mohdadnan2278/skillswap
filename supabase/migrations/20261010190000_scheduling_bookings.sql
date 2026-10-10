-- Phase 5 scheduling only. Credits are deliberately not integrated yet.
begin;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;
create table public.bookings (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references public.profiles(id) on delete restrict,
 learner_id uuid not null references public.profiles(id) on delete restrict,
 skill_id uuid not null references public.skills(id) on delete restrict,
 starts_at timestamptz not null, ends_at timestamptz not null,
 duration_minutes integer not null check (duration_minutes in (30,60,90)),
 cost_units integer not null check (cost_units = duration_minutes),
 state text not null default 'pending' check (state in ('pending','accepted','rejected','cancelled','expired','completed','disputed')),
 request_expires_at timestamptz not null,
 credit_reservation_status text not null default 'not_integrated' check (credit_reservation_status = 'not_integrated'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (teacher_id <> learner_id),
 check (ends_at = starts_at + duration_minutes * interval '1 minute'),
 check (request_expires_at <= starts_at)
);
create index bookings_teacher_start on public.bookings(teacher_id, starts_at, id);
create index bookings_learner_start on public.bookings(learner_id, starts_at, id);
create index bookings_pending_expiry on public.bookings(request_expires_at) where state = 'pending';
create table private.booking_occupancy (
 booking_id uuid not null references public.bookings(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 during tstzrange not null,
 primary key (booking_id,user_id),
 exclude using gist (user_id with =, during with &&)
);
create table private.booking_idempotency (
 actor uuid not null references public.profiles(id) on delete restrict,
 operation text not null, request_key uuid not null,
 input jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key (actor,operation,request_key)
);
alter table public.bookings enable row level security;
revoke all on public.bookings from public, anon, authenticated;
grant select on public.bookings to authenticated;
create policy booking_participant_read on public.bookings for select to authenticated
 using ((select auth.uid()) in (teacher_id,learner_id));
revoke all on private.booking_occupancy,private.booking_idempotency from public,anon,authenticated;

create function private.booking_actor() returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode='42501';
 end if;
 if not exists(select 1 from public.profiles where id=actor) then
  raise exception 'Onboarding required' using errcode='P0001';
 end if;
 return actor;
end;
$$;
create function private.expire_booking_requests(p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 with expired as (
  update public.bookings set state='expired',updated_at=clock_timestamp()
  where state='pending' and request_expires_at <= clock_timestamp() and p_user in (teacher_id,learner_id)
  returning id
 ) delete from private.booking_occupancy where booking_id in (select id from expired);
end;
$$;
revoke all on function private.booking_actor(),private.expire_booking_requests(uuid) from public,anon,authenticated;

create function public.create_booking_request(p_teacher_id uuid,p_skill_id uuid,p_starts_at timestamptz,p_duration integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.booking_actor(); b public.bookings; old private.booking_idempotency;
 payload jsonb := jsonb_build_object('teacher',p_teacher_id,'skill',p_skill_id,'start',p_starts_at,'duration',p_duration);
 result jsonb; at_time timestamptz;
begin
 -- MVP serializes booking operations, then locks participant rows in UUID order.
 -- The exclusion constraint independently prevents both-role overlap.
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 perform private.expire_booking_requests(v_actor);
 if p_key is null then return jsonb_build_object('error','VALIDATION_ERROR'); end if;
 select * into old from private.booking_idempotency i where i.actor=v_actor and i.operation='create' and request_key=p_key;
 if found then
  if old.input <> payload then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT'); end if;
  return old.result;
 end if;
 at_time := clock_timestamp();
 if p_teacher_id is null or p_teacher_id=v_actor or p_skill_id is null or p_starts_at is null
  or p_duration is null or p_duration not in (30,60,90)
  or p_starts_at < at_time + interval '15 minutes' or p_starts_at > at_time + interval '30 days' then
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
 if p_starts_at < at_time + interval '15 minutes' or p_starts_at > at_time + interval '30 days' then
  return jsonb_build_object('error','VALIDATION_ERROR');
 end if;
 if exists(select 1 from private.booking_occupancy where user_id in(v_actor,p_teacher_id)
   and during && tstzrange(p_starts_at,p_starts_at+p_duration*interval '1 minute','[)')) then
  return jsonb_build_object('error','SCHEDULE_CONFLICT');
 end if;
 begin
  insert into public.bookings(teacher_id,learner_id,skill_id,starts_at,ends_at,duration_minutes,cost_units,request_expires_at,created_at,updated_at)
   values(p_teacher_id,v_actor,p_skill_id,p_starts_at,p_starts_at+p_duration*interval '1 minute',p_duration,p_duration,
    least(at_time+interval '24 hours',p_starts_at),at_time,at_time) returning * into b;
  insert into private.booking_occupancy(booking_id,user_id,during)
   values(b.id,v_actor,tstzrange(b.starts_at,b.ends_at,'[)')),(b.id,p_teacher_id,tstzrange(b.starts_at,b.ends_at,'[)'));
 exception when exclusion_violation then
  return jsonb_build_object('error','SCHEDULE_CONFLICT');
 end;
 result := jsonb_build_object('booking',to_jsonb(b));
 insert into private.booking_idempotency(actor,operation,request_key,input,result) values(v_actor,'create',p_key,payload,result);
 return result;
end;
$$;

create function public.booking_action(p_booking_id uuid,p_action text,p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.booking_actor(); b public.bookings; old private.booking_idempotency;
 op text := p_action || ':' || p_booking_id::text; result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 perform private.expire_booking_requests(v_actor);
 select * into b from public.bookings where id=p_booking_id and v_actor in(teacher_id,learner_id);
 if not found then return jsonb_build_object('error','NOT_FOUND'); end if;
 if p_key is null or p_action is null or p_action not in('accept','reject','cancel') then return jsonb_build_object('error','VALIDATION_ERROR'); end if;
 if p_action in('accept','reject') and v_actor <> b.teacher_id then return jsonb_build_object('error','FORBIDDEN'); end if;
 perform id from public.profiles where id in(b.teacher_id,b.learner_id) order by id for update;
 select * into old from private.booking_idempotency i where i.actor=v_actor and i.operation=op and request_key=p_key;
 if found then return old.result; end if;
 if b.state='expired' then return jsonb_build_object('error','REQUEST_EXPIRED'); end if;
 if (p_action in('accept','reject') and b.state <> 'pending')
  or (p_action='cancel' and b.state not in('pending','accepted'))
  or b.starts_at <= clock_timestamp() then return jsonb_build_object('error','INVALID_STATE'); end if;
 update public.bookings set state=case p_action when 'accept' then 'accepted' when 'reject' then 'rejected' else 'cancelled' end,
  updated_at=clock_timestamp() where id=b.id returning * into b;
 if p_action in('reject','cancel') then delete from private.booking_occupancy where booking_id=b.id; end if;
 result := jsonb_build_object('booking',to_jsonb(b));
 insert into private.booking_idempotency(actor,operation,request_key,input,result) values(v_actor,op,p_key,'{}',result);
 return result;
end;
$$;

create function public.read_my_bookings(p_id uuid default null,p_after_start timestamptz default null,p_after_id uuid default null,
 p_state text default null,p_role text default null,p_limit integer default 21)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.booking_actor(); result jsonb; v_booking public.bookings; actions jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 perform private.expire_booking_requests(actor);
 if p_id is not null then
  select * into v_booking from public.bookings where id=p_id and actor in(teacher_id,learner_id);
  if not found then return jsonb_build_object('error','NOT_FOUND'); end if;
  select coalesce(jsonb_agg(a.name),'[]'::jsonb) into actions from (values ('accept'),('reject'),('cancel')) as a(name)
   where v_booking.starts_at > clock_timestamp() and
    ((a.name in('accept','reject') and v_booking.state='pending' and v_booking.teacher_id=actor)
     or (a.name='cancel' and v_booking.state in('pending','accepted')));
  return jsonb_build_object('booking',to_jsonb(v_booking),'allowed_actions',actions);
 end if;
 if p_limit is null or p_limit not between 1 and 51
  or (p_after_start is null) <> (p_after_id is null)
  or (p_state is not null and p_state not in('pending','accepted','rejected','cancelled','expired','completed','disputed'))
  or (p_role is not null and p_role not in('teacher','learner')) then
  return jsonb_build_object('error','VALIDATION_ERROR');
 end if;
 select coalesce(jsonb_agg(to_jsonb(b) order by b.starts_at,b.id),'[]'::jsonb) into result from (
  select * from public.bookings b where actor in(b.teacher_id,b.learner_id)
   and (p_role is null or (p_role='teacher' and b.teacher_id=actor) or (p_role='learner' and b.learner_id=actor))
   and (p_state is null or b.state=p_state)
   and (p_after_start is null or (b.starts_at,b.id) > (p_after_start,p_after_id))
  order by b.starts_at,b.id limit p_limit
 ) b;
 return jsonb_build_object('items',result);
end;
$$;
revoke all on function public.create_booking_request(uuid,uuid,timestamptz,integer,uuid),public.booking_action(uuid,text,uuid),
 public.read_my_bookings(uuid,timestamptz,uuid,text,text,integer) from public,anon;
grant execute on function public.create_booking_request(uuid,uuid,timestamptz,integer,uuid),public.booking_action(uuid,text,uuid),
 public.read_my_bookings(uuid,timestamptz,uuid,text,text,integer) to authenticated;
commit;
