begin;
alter table public.bookings drop constraint bookings_credit_reservation_status_check;
alter table public.bookings add check (credit_reservation_status in ('not_integrated','held','released','settled'));
create table public.wallets (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 settled_units bigint not null default 0 check (settled_units >= 0),
 reserved_units bigint not null default 0 check (reserved_units between 0 and settled_units)
);
create table public.reservations (
 booking_id uuid primary key references public.bookings(id) on delete restrict,
 learner_id uuid not null references public.profiles(id) on delete restrict,
 units bigint not null check (units > 0), status text not null check (status in ('held','released','settled')),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create index reservations_owner_status on public.reservations(learner_id,status,created_at,booking_id);
create table private.ledger_events (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in('starter_grant','session_transfer')),
 booking_id uuid unique references public.bookings(id) on delete restrict,
 beneficiary_id uuid unique references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 check ((kind='starter_grant' and beneficiary_id is not null and booking_id is null)
  or (kind='session_transfer' and booking_id is not null and beneficiary_id is null))
);
create table public.ledger_entries (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references private.ledger_events(id) on delete restrict,
 user_id uuid references public.profiles(id) on delete restrict, delta_units bigint not null check(delta_units <> 0),
 created_at timestamptz not null default clock_timestamp(), unique nulls not distinct(event_id,user_id)
);
create index ledger_owner_created on public.ledger_entries(user_id,created_at,id);
create table public.booking_confirmations (
 booking_id uuid not null references public.bookings(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 confirmed_at timestamptz not null default clock_timestamp(), primary key(booking_id,user_id)
);
create table public.booking_disputes (
 booking_id uuid primary key references public.bookings(id) on delete restrict,
 opened_by uuid not null references public.profiles(id) on delete restrict,
 reason text not null check(char_length(btrim(reason)) between 10 and 500),
 opened_at timestamptz not null default clock_timestamp(), resolved_at timestamptz
);
create table public.booking_dispute_votes (
 booking_id uuid not null references public.booking_disputes(booking_id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 resolution text not null check(resolution in('complete','cancel')),
 updated_at timestamptz not null default clock_timestamp(),primary key(booking_id,user_id)
);
alter table public.wallets enable row level security;
alter table public.reservations enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.booking_confirmations enable row level security;
alter table public.booking_disputes enable row level security;
alter table public.booking_dispute_votes enable row level security;
revoke all on public.wallets,public.reservations,public.ledger_entries,public.booking_confirmations,public.booking_disputes,public.booking_dispute_votes,private.ledger_events from public,anon,authenticated;
grant select on public.wallets,public.reservations,public.ledger_entries,public.booking_confirmations,public.booking_disputes,public.booking_dispute_votes to authenticated;
create policy wallet_owner on public.wallets for select to authenticated using(user_id=(select auth.uid()));
create policy ledger_owner on public.ledger_entries for select to authenticated using(user_id=(select auth.uid()));
create policy reservation_participants on public.reservations for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and (select auth.uid()) in(b.teacher_id,b.learner_id)));
create policy confirmation_participants on public.booking_confirmations for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and (select auth.uid()) in(b.teacher_id,b.learner_id)));
create policy dispute_participants on public.booking_disputes for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and (select auth.uid()) in(b.teacher_id,b.learner_id)));
create policy vote_participants on public.booking_dispute_votes for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and (select auth.uid()) in(b.teacher_id,b.learner_id)));

-- Financial history is append-only, including for service-role writes.
create function private.reject_ledger_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Credit ledger is append-only' using errcode='23514';end;
$$;
create trigger ledger_immutable before update or delete on public.ledger_entries for each row execute function private.reject_ledger_mutation();
create trigger event_immutable before update or delete on private.ledger_events for each row execute function private.reject_ledger_mutation();

create function private.ensure_starter(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare event uuid;
begin
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_user and u.email_confirmed_at is not null) then return; end if;
 insert into public.wallets(user_id) values(p_user) on conflict do nothing;
 insert into private.ledger_events(kind,beneficiary_id) values('starter_grant',p_user) on conflict do nothing returning id into event;
 if event is null then return; end if;
 update public.wallets set settled_units=settled_units+180 where user_id=p_user;
 insert into public.ledger_entries(event_id,user_id,delta_units) values(event,p_user,180),(event,null,-180);
end;
$$;
create function private.profile_starter_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.ensure_starter(new.id);return new;end;
$$;
create trigger profile_starter after insert on public.profiles for each row execute function private.profile_starter_trigger();
-- Existing verified/onboarded members receive the same one-time issuance, never demo bonuses.
do $$ declare person uuid;begin for person in select id from public.profiles order by id loop perform private.ensure_starter(person);end loop;end;$$;

create function private.booking_json(p_booking public.bookings) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(p_booking) || jsonb_build_object(
 'teacher_confirmed',exists(select 1 from public.booking_confirmations where booking_id=p_booking.id and user_id=p_booking.teacher_id),
 'learner_confirmed',exists(select 1 from public.booking_confirmations where booking_id=p_booking.id and user_id=p_booking.learner_id),
 'dispute',(select jsonb_build_object('openedBy',d.opened_by,'reason',d.reason,'openedAt',d.opened_at,'resolvedAt',d.resolved_at,
 'teacherResolution',(select resolution from public.booking_dispute_votes where booking_id=d.booking_id and user_id=p_booking.teacher_id),
 'learnerResolution',(select resolution from public.booking_dispute_votes where booking_id=d.booking_id and user_id=p_booking.learner_id))
 from public.booking_disputes d where d.booking_id=p_booking.id));
$$;
create function private.release_booking_hold(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations;
begin
 select * into r from public.reservations where booking_id=p_id for update;
 if not found or r.status <> 'held' then return;end if;
 update public.wallets set reserved_units=reserved_units-r.units where user_id=r.learner_id;
 update public.reservations set status='released',updated_at=clock_timestamp() where booking_id=p_id;
 update public.bookings set credit_reservation_status='released',updated_at=clock_timestamp() where id=p_id;
end;
$$;
create or replace function private.expire_booking_requests(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare expired_id uuid;
begin
 for expired_id in update public.bookings set state='expired',updated_at=clock_timestamp()
  where state='pending' and request_expires_at<=clock_timestamp() and p_user in(teacher_id,learner_id) returning id
 loop
  perform private.release_booking_hold(expired_id);
  delete from private.booking_occupancy where booking_id=expired_id;
 end loop;
end;
$$;
create function private.settle_booking(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;r public.reservations;event uuid;
begin
 select * into b from public.bookings where id=p_id for update;
 select * into r from public.reservations where booking_id=p_id for update;
 if not found or b.credit_reservation_status<>'held' or r.status<>'held' or r.learner_id<>b.learner_id or r.units<>b.cost_units then
  raise exception 'Missing funding' using errcode='23514';end if;
 insert into private.ledger_events(kind,booking_id) values('session_transfer',p_id) returning id into event;
 update public.wallets set settled_units=settled_units-r.units,reserved_units=reserved_units-r.units where user_id=b.learner_id;
 update public.wallets set settled_units=settled_units+r.units where user_id=b.teacher_id;
 insert into public.ledger_entries(event_id,user_id,delta_units) values(event,b.learner_id,-r.units),(event,b.teacher_id,r.units);
 update public.reservations set status='settled',updated_at=clock_timestamp() where booking_id=p_id;
 update public.bookings set state='completed',credit_reservation_status='settled',updated_at=clock_timestamp() where id=p_id;
 update public.booking_disputes set resolved_at=clock_timestamp() where booking_id=p_id;
 delete from private.booking_occupancy where booking_id=p_id;
end;
$$;

-- Deferred checks verify committed wallet/ledger/reservation and booking consistency.
create function private.assert_wallet(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare w public.wallets;balance numeric;held numeric;
begin
 if p_user is null then return;end if;
 select * into w from public.wallets where user_id=p_user;
 select coalesce(sum(delta_units),0) into balance from public.ledger_entries where user_id=p_user;
 select coalesce(sum(units),0) into held from public.reservations where learner_id=p_user and status='held';
 if w.user_id is null or w.settled_units<>balance or w.reserved_units<>held then raise exception 'Wallet reconciliation failed' using errcode='23514';end if;
end;
$$;
create function private.assert_booking_funding(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;r public.reservations;
begin
 select * into b from public.bookings where id=p_id;
 select * into r from public.reservations where booking_id=p_id;
 if b.credit_reservation_status='not_integrated' then
  if found or b.state in('completed','disputed') then raise exception 'Preview cannot be funded' using errcode='23514';end if;
 else
  if not found or r.learner_id<>b.learner_id or r.units<>b.cost_units or r.status<>b.credit_reservation_status
   or (r.status='held' and b.state not in('pending','accepted','disputed'))
   or (r.status='released' and b.state not in('rejected','cancelled','expired'))
   or (r.status='settled' and b.state<>'completed') then
   raise exception 'Booking funding reconciliation failed' using errcode='23514';end if;
 end if;
end;
$$;
create function private.credit_constraint_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='wallets' then perform private.assert_wallet(new.user_id);
 elsif tg_table_name='ledger_entries' then
  perform private.assert_wallet(new.user_id);
  if (select sum(delta_units) from public.ledger_entries where event_id=new.event_id)<>0
   or (select count(*) from public.ledger_entries where event_id=new.event_id)<>2 then
   raise exception 'Unbalanced ledger event' using errcode='23514';end if;
 elsif tg_table_name='ledger_events' then
  if coalesce((select sum(delta_units) from public.ledger_entries where event_id=new.id),0)<>0
   or (select count(*) from public.ledger_entries where event_id=new.id)<>2 then
   raise exception 'Unbalanced ledger event' using errcode='23514';end if;
 elsif tg_table_name='reservations' then perform private.assert_wallet(new.learner_id);perform private.assert_booking_funding(new.booking_id);
 elsif tg_table_name='bookings' then perform private.assert_booking_funding(new.id);
 end if;
 return new;
end;
$$;
create constraint trigger wallet_reconcile after insert or update on public.wallets deferrable initially deferred for each row execute function private.credit_constraint_trigger();
create constraint trigger event_reconcile after insert on private.ledger_events deferrable initially deferred for each row execute function private.credit_constraint_trigger();
create constraint trigger ledger_reconcile after insert on public.ledger_entries deferrable initially deferred for each row execute function private.credit_constraint_trigger();
create constraint trigger reservation_reconcile after insert or update on public.reservations deferrable initially deferred for each row execute function private.credit_constraint_trigger();
create constraint trigger booking_funding_reconcile after insert or update on public.bookings deferrable initially deferred for each row execute function private.credit_constraint_trigger();

create function public.booking_financial_action(p_booking_id uuid,p_action text,p_key uuid,p_reason text default null,p_resolution text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.booking_actor();b public.bookings;old private.booking_idempotency;
 op text:=p_action||':'||p_booking_id::text;payload jsonb:=jsonb_build_object('reason',btrim(p_reason),'resolution',p_resolution);result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);perform private.expire_booking_requests(v_actor);
 select * into b from public.bookings where id=p_booking_id and v_actor in(teacher_id,learner_id);
 if not found then return jsonb_build_object('error','NOT_FOUND');end if;
 if p_key is null or p_action is null or p_action not in('confirm','dispute','resolve')
  or (p_action='confirm' and (p_reason is not null or p_resolution is not null))
  or (p_action='dispute' and (p_reason is null or char_length(btrim(p_reason)) not between 10 and 500 or p_resolution is not null))
  or (p_action='resolve' and (p_resolution is null or p_resolution not in('complete','cancel') or p_reason is not null)) then return jsonb_build_object('error','VALIDATION_ERROR');end if;
 perform id from public.profiles where id in(b.teacher_id,b.learner_id) order by id for update;
 perform user_id from public.wallets where user_id in(b.teacher_id,b.learner_id) order by user_id for update;
 select * into old from private.booking_idempotency i where i.actor=v_actor and i.operation=op and request_key=p_key;
 if found then
  if old.input<>payload then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');end if;return old.result;
 end if;
 if b.credit_reservation_status='not_integrated' then return jsonb_build_object('error','INVALID_STATE');end if;
 if p_action='confirm' and b.state='completed' and exists(select 1 from public.booking_confirmations where booking_id=b.id and user_id=v_actor) then
  result:=jsonb_build_object('booking',private.booking_json(b));
 elsif b.credit_reservation_status<>'held' then return jsonb_build_object('error','INVALID_STATE');
 elsif p_action='confirm' then
  if b.state<>'accepted' or b.ends_at>clock_timestamp() then return jsonb_build_object('error','INVALID_STATE');end if;
  insert into public.booking_confirmations(booking_id,user_id) values(b.id,v_actor) on conflict do nothing;
  if (select count(*) from public.booking_confirmations where booking_id=b.id)=2 then perform private.settle_booking(b.id);end if;
 elsif p_action='dispute' then
  if b.state<>'accepted' or b.starts_at>clock_timestamp() then return jsonb_build_object('error','INVALID_STATE');end if;
  insert into public.booking_disputes(booking_id,opened_by,reason) values(b.id,v_actor,btrim(p_reason));
  update public.bookings set state='disputed',updated_at=clock_timestamp() where id=b.id;
 elsif p_action='resolve' then
  if b.state<>'disputed' or (p_resolution='complete' and b.ends_at>clock_timestamp()) then return jsonb_build_object('error','INVALID_STATE');end if;
  insert into public.booking_dispute_votes(booking_id,user_id,resolution) values(b.id,v_actor,p_resolution)
   on conflict(booking_id,user_id) do update set resolution=excluded.resolution,updated_at=clock_timestamp();
  if (select count(*) from public.booking_dispute_votes where booking_id=b.id and resolution=p_resolution)=2 then
   if p_resolution='complete' then perform private.settle_booking(b.id);
   else
    update public.bookings set state='cancelled',updated_at=clock_timestamp() where id=b.id;
    perform private.release_booking_hold(b.id);delete from private.booking_occupancy where booking_id=b.id;
    update public.booking_disputes set resolved_at=clock_timestamp() where booking_id=b.id;
   end if;
  end if;
 end if;
 select * into b from public.bookings where id=p_booking_id;
 result:=jsonb_build_object('booking',private.booking_json(b));
 insert into private.booking_idempotency(actor,operation,request_key,input,result) values(v_actor,op,p_key,payload,result);
 return result;
end;
$$;

create function public.read_my_wallet(p_kind text default 'summary',p_limit integer default 21,p_after_created timestamptz default null,p_after_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.booking_actor();result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);perform private.ensure_starter(v_actor);perform private.expire_booking_requests(v_actor);
 if p_kind='summary' then
  select jsonb_build_object('settledUnits',settled_units::text,'reservedUnits',reserved_units::text,'availableUnits',(settled_units-reserved_units)::text) into result from public.wallets where user_id=v_actor;
  return result;
 end if;
 if p_kind is null or p_kind not in('transactions','reservations') or p_limit is null or p_limit not between 1 and 51
  or (p_after_created is null)<>(p_after_id is null) then return jsonb_build_object('error','VALIDATION_ERROR');end if;
 if p_kind='transactions' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb) into result from(
   select l.id,l.event_id,l.delta_units::text,to_char(l.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,e.kind,e.booking_id from public.ledger_entries l join private.ledger_events e on e.id=l.event_id
   where l.user_id=v_actor and (p_after_created is null or (l.created_at,l.id)<(p_after_created,p_after_id)) order by l.created_at desc,l.id desc limit p_limit
  ) t;
 else
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.booking_id desc),'[]'::jsonb) into result from(
   select r.booking_id,r.units::text,r.status,to_char(r.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,to_char(r.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at,b.state as booking_state from public.reservations r join public.bookings b on b.id=r.booking_id
   where r.learner_id=v_actor and r.status='held' and (p_after_created is null or (r.created_at,r.booking_id)<(p_after_created,p_after_id))
   order by r.created_at desc,r.booking_id desc limit p_limit
  ) t;
 end if;
 return jsonb_build_object('items',result);
end;
$$;
revoke all on function public.booking_financial_action(uuid,text,uuid,text,text),public.read_my_wallet(text,integer,timestamptz,uuid) from public,anon;
grant execute on function public.booking_financial_action(uuid,text,uuid,text,text),public.read_my_wallet(text,integer,timestamptz,uuid) to authenticated;
revoke all on function private.reject_ledger_mutation(),private.ensure_starter(uuid),private.profile_starter_trigger(),private.booking_json(public.bookings),private.release_booking_hold(uuid),private.settle_booking(uuid),private.assert_wallet(uuid),private.assert_booking_funding(uuid),private.credit_constraint_trigger() from public,anon,authenticated;

create or replace function public.create_booking_request(p_teacher_id uuid,p_skill_id uuid,p_starts_at timestamptz,p_duration integer,p_key uuid)
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

create or replace function public.booking_action(p_booking_id uuid,p_action text,p_key uuid)
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
 if p_action in('reject','cancel') then perform private.release_booking_hold(b.id);delete from private.booking_occupancy where booking_id=b.id;end if;
 select * into b from public.bookings where id=p_booking_id;
 result := jsonb_build_object('booking',private.booking_json(b));
 insert into private.booking_idempotency(actor,operation,request_key,input,result) values(v_actor,op,p_key,'{}',result);
 return result;
end;
$$;

create or replace function public.read_my_bookings(p_id uuid default null,p_after_start timestamptz default null,p_after_id uuid default null,
 p_state text default null,p_role text default null,p_limit integer default 21)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.booking_actor(); result jsonb; v_booking public.bookings; actions jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 perform private.expire_booking_requests(actor);
 if p_id is not null then
  select * into v_booking from public.bookings where id=p_id and actor in(teacher_id,learner_id);
  if not found then return jsonb_build_object('error','NOT_FOUND'); end if;
  select coalesce(jsonb_agg(a.name),'[]'::jsonb) into actions from (values ('accept'),('reject'),('cancel'),('confirm'),('dispute'),('resolve')) as a(name)
   where
    (v_booking.starts_at > clock_timestamp() and
     ((a.name in('accept','reject') and v_booking.state='pending' and v_booking.teacher_id=actor)
      or (a.name='cancel' and v_booking.state in('pending','accepted'))))
    or
    (v_booking.credit_reservation_status='held' and
     ((a.name='confirm' and v_booking.state='accepted' and v_booking.ends_at<=clock_timestamp() and not exists(select 1 from public.booking_confirmations where booking_id=v_booking.id and user_id=actor))
      or (a.name='dispute' and v_booking.state='accepted' and v_booking.starts_at<=clock_timestamp())
      or (a.name='resolve' and v_booking.state='disputed')));
  return jsonb_build_object('booking',private.booking_json(v_booking),'allowed_actions',actions,'can_resolve_complete',v_booking.state='disputed' and v_booking.ends_at<=clock_timestamp());
 end if;
 if p_limit is null or p_limit not between 1 and 51
  or (p_after_start is null) <> (p_after_id is null)
  or (p_state is not null and p_state not in('pending','accepted','rejected','cancelled','expired','completed','disputed'))
  or (p_role is not null and p_role not in('teacher','learner')) then
  return jsonb_build_object('error','VALIDATION_ERROR');
 end if;
 select coalesce(jsonb_agg(private.booking_json(b) order by b.starts_at,b.id),'[]'::jsonb) into result from (
  select * from public.bookings b where actor in(b.teacher_id,b.learner_id)
   and (p_role is null or (p_role='teacher' and b.teacher_id=actor) or (p_role='learner' and b.learner_id=actor))
   and (p_state is null or b.state=p_state)
   and (p_after_start is null or (b.starts_at,b.id) > (p_after_start,p_after_id))
  order by b.starts_at,b.id limit p_limit
 ) b;
 return jsonb_build_object('items',result);
end;
$$;

commit;
