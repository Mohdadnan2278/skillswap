begin;

create table public.member_availability (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 available_until timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.member_availability enable row level security;
revoke all on public.member_availability from public,anon,authenticated;
grant select on public.member_availability to authenticated;
create policy availability_read on public.member_availability for select to authenticated
 using(public.account_is_active() and public.member_is_visible(user_id));
create function public.set_my_availability(p_minutes integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.booking_actor();until_at timestamptz;begin
 if p_minutes is null or p_minutes not in(0,15,30,60) then raise exception 'Invalid availability' using errcode='22023';end if;
 until_at:=case when p_minutes=0 then null else clock_timestamp()+p_minutes*interval '1 minute' end;
 insert into public.member_availability(user_id,available_until) values(actor,until_at)
 on conflict(user_id) do update set available_until=excluded.available_until,updated_at=clock_timestamp();
 return jsonb_build_object('availableUntil',until_at,'serverNow',clock_timestamp());
end;$$;

create function public.discover_members_v2(p_after uuid default null,p_skill_id uuid default null,p_limit integer default 21,p_available_only boolean default false)
returns table(id uuid,display_name text,bio text,college text,matched_skills jsonb,available_until timestamptz)
language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.account_is_active() then raise exception 'Active account required' using errcode='42501';end if;
 if not exists(select 1 from public.profiles where profiles.id=auth.uid()) then raise exception 'Onboarding required' using errcode='P0001';end if;
 if p_limit is null or p_limit not between 1 and 51 or p_available_only is null
  or (p_skill_id is not null and not exists(select 1 from public.user_skills w join public.skills s on s.id=w.skill_id where w.user_id=auth.uid() and w.direction='wanted' and w.skill_id=p_skill_id and s.enabled))
 then raise exception 'Invalid discovery filter' using errcode='22023';end if;
 return query select p.id,p.display_name,p.bio,p.college,
  jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'name',s.name,'category',s.category) order by s.slug),
  case when a.available_until>now() then a.available_until else null end
 from public.profiles p
 join public.user_skills o on o.user_id=p.id and o.direction='offered'
 join public.skills s on s.id=o.skill_id and s.enabled
 join public.user_skills w on w.user_id=auth.uid() and w.direction='wanted' and w.skill_id=s.id
 left join public.member_availability a on a.user_id=p.id
 where p.id<>auth.uid() and (p_after is null or p.id>p_after) and (p_skill_id is null or s.id=p_skill_id)
  and (not p_available_only or a.available_until>now())
 group by p.id,p.display_name,p.bio,p.college,a.available_until order by p.id limit p_limit;
end;$$;

create table public.booking_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete restrict,
 booking_id uuid not null references public.bookings(id) on delete restrict,
 kind text not null check(kind in('pending','accepted','rejected','cancelled','expired','completed','disputed','confirmation')),
 created_at timestamptz not null default clock_timestamp(),read_at timestamptz
);
create index booking_notifications_inbox on public.booking_notifications(user_id,created_at desc,id desc);
create index booking_notifications_unread on public.booking_notifications(user_id) where read_at is null;
alter table public.booking_notifications enable row level security;
revoke all on public.booking_notifications from public,anon,authenticated;
grant select on public.booking_notifications to authenticated;
create policy notification_owner on public.booking_notifications for select to authenticated
 using(user_id=(select auth.uid()) and public.account_is_active());
create function private.notify_booking_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare b public.bookings;person uuid;event_kind text;begin
 if tg_table_name='booking_confirmations' then
  select * into b from public.bookings where id=new.booking_id;
  event_kind:='confirmation';
  person:=case when new.user_id=b.teacher_id then b.learner_id else b.teacher_id end;
  insert into public.booking_notifications(user_id,booking_id,kind) values(person,b.id,event_kind);
 elsif tg_op='INSERT' then
  insert into public.booking_notifications(user_id,booking_id,kind) values(new.teacher_id,new.id,'pending');
 elsif old.state is distinct from new.state then
  foreach person in array array[new.teacher_id,new.learner_id] loop
   if person is distinct from auth.uid() then
    insert into public.booking_notifications(user_id,booking_id,kind) values(person,new.id,new.state);
   end if;
  end loop;
 end if;
 return new;
end;$$;
create trigger booking_notify after insert or update on public.bookings for each row execute function private.notify_booking_change();
create trigger confirmation_notify after insert on public.booking_confirmations for each row execute function private.notify_booking_change();

create function public.read_my_notifications(p_limit integer default 20,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.booking_actor();items jsonb;begin
 if p_limit is null or p_limit not between 1 and 51 or (p_before is null)<>(p_before_id is null) then raise exception 'Invalid inbox page' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb) into items from(
  select n.id,n.booking_id,n.kind,n.created_at,n.read_at,s.name as skill_name
  from public.booking_notifications n join public.bookings b on b.id=n.booking_id join public.skills s on s.id=b.skill_id
  where n.user_id=actor and (p_before is null or (n.created_at,n.id)<(p_before,p_before_id))
  order by n.created_at desc,n.id desc limit p_limit
 )r;
 return jsonb_build_object('items',items,'unreadCount',(select count(*) from public.booking_notifications where user_id=actor and read_at is null));
end;$$;
create function public.mark_my_notifications_read(p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.booking_actor();begin
 if p_ids is null or cardinality(p_ids)>50 or array_position(p_ids,null) is not null then raise exception 'Invalid notifications' using errcode='22023';end if;
 update public.booking_notifications set read_at=clock_timestamp() where user_id=actor and id=any(p_ids) and read_at is null;
end;$$;

create function public.admin_cancel_booking(p_booking_id uuid,p_reason text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;b public.bookings;prior private.admin_audit;before_data jsonb;after_data jsonb;
 payload jsonb:=jsonb_build_object('action','cancel_stuck_booking','target',p_booking_id,'reason',btrim(p_reason));audit_id uuid:=gen_random_uuid();result jsonb;begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 v_actor:=private.require_admin();
 if p_reason is null or length(btrim(p_reason)) not between 10 and 500 or p_key is null or p_booking_id is null then raise exception 'Invalid support cancellation' using errcode='22023';end if;
 select * into prior from private.admin_audit where admin_audit.actor=v_actor and request_key=p_key;
 if found then
  if prior.input<>payload then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');end if;
  return prior.result;
 end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then return jsonb_build_object('error','NOT_FOUND');end if;
 if v_actor in(b.teacher_id,b.learner_id) or b.state not in('accepted','disputed') or b.credit_reservation_status<>'held'
  or (b.ends_at>clock_timestamp()-interval '24 hours' and not exists(select 1 from private.member_suspensions where user_id in(b.teacher_id,b.learner_id) and suspended))
 then return jsonb_build_object('error','INVALID_STATE');end if;
 before_data:=private.booking_json(b);
 update public.bookings set state='cancelled',updated_at=clock_timestamp() where id=b.id;
 perform private.release_booking_hold(b.id);
 delete from private.booking_occupancy where booking_id=b.id;
 update public.booking_disputes set resolved_at=clock_timestamp() where booking_id=b.id;
 select private.booking_json(bookings) into after_data from public.bookings where id=b.id;
 result:=jsonb_build_object('auditId',audit_id,'targetId',b.id);
 insert into private.admin_audit(id,actor,action,target,reason,before_value,after_value,request_key,input,result)
 values(audit_id,v_actor,'cancel_stuck_booking',b.id,btrim(p_reason),before_data,after_data,p_key,payload,result);
 return result;
end;$$;

create function private.sweep_booking_requests() returns integer
language plpgsql security definer set search_path='' as $$
declare learner uuid;total integer;begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 select count(*) into total from public.bookings where state='pending' and request_expires_at<=clock_timestamp();
 for learner in select distinct learner_id from public.bookings where state='pending' and request_expires_at<=clock_timestamp() loop
  perform private.expire_booking_requests(learner);
 end loop;
 return total;
end;$$;
revoke all on function private.notify_booking_change(),private.sweep_booking_requests() from public,anon,authenticated;
revoke all on function public.set_my_availability(integer),public.discover_members_v2(uuid,uuid,integer,boolean),public.read_my_notifications(integer,timestamptz,uuid),public.mark_my_notifications_read(uuid[]),public.admin_cancel_booking(uuid,text,uuid) from public,anon;
grant execute on function public.set_my_availability(integer),public.discover_members_v2(uuid,uuid,integer,boolean),public.read_my_notifications(integer,timestamptz,uuid),public.mark_my_notifications_read(uuid[]),public.admin_cancel_booking(uuid,text,uuid) to authenticated;
commit;
