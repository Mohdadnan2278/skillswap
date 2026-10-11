-- Explicit quick calls join immediately after acceptance, with five minutes to accept.
-- Normal advance scheduling and all funding/authorization invariants are preserved.
begin;

create or replace function public.create_booking_request(p_teacher_id uuid,p_skill_id uuid,p_starts_at timestamptz,p_duration integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.booking_actor(); b public.bookings; old private.booking_idempotency;
 payload jsonb := jsonb_build_object('teacher',p_teacher_id,'skill',p_skill_id,'start',p_starts_at,'duration',p_duration);
 result jsonb; at_time timestamptz; quick_call boolean := p_starts_at is null;
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
 if p_teacher_id is null or p_teacher_id=v_actor or p_skill_id is null
  or p_duration is null or p_duration not in (30,60,90)
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
 if quick_call then p_starts_at := at_time + interval '5 minutes'; end if;
 if not quick_call and (p_starts_at < at_time + interval '15 minutes' or p_starts_at > at_time + interval '30 days') then
  return jsonb_build_object('error','VALIDATION_ERROR');
 end if;
 if exists(select 1 from private.booking_occupancy where user_id in(v_actor,p_teacher_id)
   and during && tstzrange(p_starts_at,p_starts_at+p_duration*interval '1 minute','[)')) then
  return jsonb_build_object('error','SCHEDULE_CONFLICT');
 end if;
 perform private.ensure_starter(v_actor);perform private.ensure_starter(p_teacher_id);
 perform user_id from public.wallets where user_id in(v_actor,p_teacher_id) order by user_id for update;
 if (select settled_units-reserved_units from public.wallets where user_id=v_actor)<p_duration then return jsonb_build_object('error','INSUFFICIENT_CREDITS');end if;
 begin
  insert into public.bookings(teacher_id,learner_id,skill_id,starts_at,ends_at,duration_minutes,cost_units,request_expires_at,created_at,updated_at,credit_reservation_status)
   values(p_teacher_id,v_actor,p_skill_id,p_starts_at,p_starts_at+p_duration*interval '1 minute',p_duration,p_duration,
    least(at_time+interval '24 hours',p_starts_at),at_time,at_time,'held') returning * into b;
  insert into private.booking_occupancy(booking_id,user_id,during)
   values(b.id,v_actor,tstzrange(b.starts_at,b.ends_at,'[)')),(b.id,p_teacher_id,tstzrange(b.starts_at,b.ends_at,'[)'));
  insert into public.reservations(booking_id,learner_id,units,status) values(b.id,v_actor,p_duration,'held');
  update public.wallets set reserved_units=reserved_units+p_duration where user_id=v_actor;
 exception when exclusion_violation then
  return jsonb_build_object('error','SCHEDULE_CONFLICT');
 end;
 result := jsonb_build_object('booking',private.booking_json(b));
 insert into private.booking_idempotency(actor,operation,request_key,input,result) values(v_actor,'create',p_key,payload,result);
 return result;
end;
$$;

commit;
