begin;
-- Owner chose a server-free classroom demonstration rather than managed/private video.
-- Preserve the already-applied Phase 7 migration; change provider with this follow-up.
alter table private.meeting_rooms drop constraint meeting_rooms_provider_check;
alter table private.meeting_rooms alter column provider set default 'jitsi_demo';
update private.meeting_rooms set provider='jitsi_demo',room_name='skillswap-'||replace(gen_random_uuid()::text,'-','');
alter table private.meeting_rooms add check(provider='jitsi_demo');
create or replace function public.meeting_access_context(p_booking_id uuid,p_consume boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.booking_actor(); b public.bookings;clock timestamptz:=clock_timestamp();limits private.meeting_rate_limits;room text;
begin
 -- Short database transaction; never hold these locks during provider HTTPS calls.
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 select * into b from public.bookings where id=p_booking_id and actor in(teacher_id,learner_id);
 if not found then return jsonb_build_object('error','NOT_FOUND');end if;
 if b.state<>'accepted' or b.credit_reservation_status<>'held' then return jsonb_build_object('error','INVALID_STATE');end if;
 if clock<b.starts_at-interval '10 minutes' or clock>=b.ends_at+interval '15 minutes' then return jsonb_build_object('error','INVALID_STATE');end if;
 if p_consume is null then return jsonb_build_object('error','VALIDATION_ERROR');end if;
 if p_consume then
  select * into limits from private.meeting_rate_limits where user_id=actor for update;
  if found and limits.window_start>clock-interval '1 minute' and limits.attempts>=8 then return jsonb_build_object('error','RATE_LIMITED');end if;
  insert into private.meeting_rate_limits(user_id,window_start,attempts) values(actor,clock,1)
   on conflict(user_id) do update set window_start=case when meeting_rate_limits.window_start<=clock-interval '1 minute' then clock else meeting_rate_limits.window_start end,
    attempts=case when meeting_rate_limits.window_start<=clock-interval '1 minute' then 1 else meeting_rate_limits.attempts+1 end;
  insert into private.meeting_rooms(booking_id,room_name) values(b.id,'skillswap-'||replace(gen_random_uuid()::text,'-','')) on conflict do nothing;
 end if;
 select room_name into room from private.meeting_rooms where booking_id=b.id;
 return jsonb_build_object('roomName',room,'actorId',actor,'displayName',(select display_name from public.profiles where id=actor),
  'teacherId',b.teacher_id,'learnerId',b.learner_id,
  'opensAt',b.starts_at-interval '10 minutes','closesAt',b.ends_at+interval '15 minutes','serverNow',clock);
end;
$$;
commit;
