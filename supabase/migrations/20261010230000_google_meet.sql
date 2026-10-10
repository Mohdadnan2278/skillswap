begin;
-- Separate storage preserves the existing Jitsi room and applied migration history.
create table private.google_meet_links (
 booking_id uuid primary key references public.bookings(id) on delete restrict,
 url text not null check(url ~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$'),
 updated_at timestamptz not null default clock_timestamp()
);
revoke all on private.google_meet_links from public,anon,authenticated;
create function public.booking_meet_link(p_booking_id uuid,p_write boolean default false,p_url text default null,p_join boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.booking_actor(); b public.bookings; clock timestamptz; link text;
begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 clock:=clock_timestamp();
 select * into b from public.bookings where id=p_booking_id and actor in(teacher_id,learner_id);
 if not found then return jsonb_build_object('error','NOT_FOUND');end if;
 if p_write is null or p_join is null or (p_write and p_join) or (not p_write and p_url is not null)
  or (p_url is not null and p_url !~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$') then
  return jsonb_build_object('error','VALIDATION_ERROR');end if;
 if b.state<>'accepted' or b.credit_reservation_status<>'held' or clock>=b.ends_at+interval '15 minutes' then
  return jsonb_build_object('error','INVALID_STATE');end if;
 if p_join and clock<b.starts_at-interval '10 minutes' then return jsonb_build_object('error','INVALID_STATE');end if;
 if p_write then
  if actor<>b.teacher_id then return jsonb_build_object('error','FORBIDDEN');end if;
  if p_url is null then delete from private.google_meet_links where booking_id=b.id;
  else insert into private.google_meet_links(booking_id,url) values(b.id,p_url)
   on conflict(booking_id) do update set url=excluded.url,updated_at=clock;end if;
 end if;
 select url into link from private.google_meet_links where booking_id=b.id;
 if p_join and link is null then return jsonb_build_object('error','INVALID_STATE');end if;
 return jsonb_build_object('url',link,'canEdit',actor=b.teacher_id,'serverNow',clock,'closesAt',b.ends_at+interval '15 minutes');
end;
$$;
revoke all on function public.booking_meet_link(uuid,boolean,text,boolean) from public,anon;
grant execute on function public.booking_meet_link(uuid,boolean,text,boolean) to authenticated;
commit;
