begin;
create table public.feedback (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete restrict,
 reviewer_id uuid not null references public.profiles(id) on delete restrict,
 reviewee_id uuid not null references public.profiles(id) on delete restrict,
 rating integer not null check(rating between 1 and 5),
 comment text not null default '' check(char_length(comment)<=500),
 created_at timestamptz not null default clock_timestamp(),
 check(reviewer_id<>reviewee_id), unique(booking_id,reviewer_id)
);
create index feedback_received on public.feedback(reviewee_id,created_at desc,id desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from public,anon,authenticated;
grant select on public.feedback to authenticated;
create policy feedback_member_read on public.feedback for select to authenticated using((select auth.uid()) is not null);
create function private.guard_feedback() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 if tg_op<>'INSERT' then raise exception 'Feedback is immutable' using errcode='42501';end if;
 select * into b from public.bookings where id=new.booking_id for share;
 if not found or b.state<>'completed' or b.credit_reservation_status<>'settled' or b.ends_at>clock_timestamp()
  or not ((new.reviewer_id=b.teacher_id and new.reviewee_id=b.learner_id) or (new.reviewer_id=b.learner_id and new.reviewee_id=b.teacher_id)) then
  raise exception 'Feedback requires eligible completed participants' using errcode='23514';end if;
 return new;
end;
$$;
revoke all on function private.guard_feedback() from public,anon,authenticated;
create trigger feedback_guard before insert or update or delete on public.feedback for each row execute function private.guard_feedback();
create function public.create_feedback(p_booking_id uuid,p_rating integer,p_comment text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.booking_actor();b public.bookings;f public.feedback;old private.booking_idempotency;
 op text:='feedback:'||p_booking_id::text;payload jsonb;result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 select * into b from public.bookings where id=p_booking_id and actor in(teacher_id,learner_id);
 if not found then return jsonb_build_object('error','NOT_FOUND');end if;
 if p_key is null or p_rating is null or p_rating not between 1 and 5 or p_comment is null or char_length(p_comment)>500 then
  return jsonb_build_object('error','VALIDATION_ERROR');end if;
 payload:=jsonb_build_object('rating',p_rating,'comment',btrim(p_comment));
 select * into old from private.booking_idempotency where booking_idempotency.actor=actor and operation=op and request_key=p_key;
 if found then
  if old.input<>payload then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');end if;
  return old.result;
 end if;
 if b.state<>'completed' or b.credit_reservation_status<>'settled' or b.ends_at>clock_timestamp() then return jsonb_build_object('error','INVALID_STATE');end if;
 if exists(select 1 from public.feedback where booking_id=b.id and reviewer_id=actor) then return jsonb_build_object('error','ALREADY_REVIEWED');end if;
 insert into public.feedback(booking_id,reviewer_id,reviewee_id,rating,comment)
 values(b.id,actor,case when actor=b.teacher_id then b.learner_id else b.teacher_id end,p_rating,btrim(p_comment)) returning * into f;
 result:=jsonb_build_object('feedback',to_jsonb(f));
 insert into private.booking_idempotency(actor,operation,request_key,input,result) values(actor,op,p_key,payload,result);
 return result;
end;
$$;
revoke all on function public.create_feedback(uuid,integer,text,uuid) from public,anon;
grant execute on function public.create_feedback(uuid,integer,text,uuid) to authenticated;
-- Invoker view preserves the underlying member-read policy; no writable score columns.
create view public.profile_reputation with(security_invoker=true) as
 select reviewee_id as user_id,avg(rating)::numeric as average_rating,count(*)::integer as rating_count from public.feedback group by reviewee_id;
revoke all on public.profile_reputation from public,anon,authenticated;
grant select on public.profile_reputation to authenticated;
create function public.community_leaderboard(p_limit integer default 21,p_after_average numeric default null,p_after_count integer default null,p_after_id uuid default null)
returns table(id uuid,display_name text,bio text,college text,average_rating text,rating_count integer,rank bigint)
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_limit is null or p_limit<1 or p_limit>51 or
  (not (p_after_average is null and p_after_count is null and p_after_id is null) and
   (p_after_average is null or p_after_average<1 or p_after_average>5 or p_after_count is null or p_after_count<3 or p_after_id is null)) then
  raise exception 'Invalid leaderboard cursor' using errcode='22023';end if;
 return query with ranked as (
  select p.id,p.display_name,p.bio,p.college,r.average_rating,r.rating_count,
   row_number() over(order by r.average_rating desc,r.rating_count desc,p.id) as rank
  from public.profile_reputation r join public.profiles p on p.id=r.user_id where r.rating_count>=3
 ) select r.id,r.display_name,r.bio,r.college,r.average_rating::text,r.rating_count,r.rank from ranked r
 where p_after_id is null or r.average_rating<p_after_average
  or(r.average_rating=p_after_average and r.rating_count<p_after_count)
  or(r.average_rating=p_after_average and r.rating_count=p_after_count and r.id>p_after_id)
 order by r.average_rating desc,r.rating_count desc,r.id limit p_limit;
end;
$$;
revoke all on function public.community_leaderboard(integer,numeric,integer,uuid) from public,anon;
grant execute on function public.community_leaderboard(integer,numeric,integer,uuid) to authenticated;
commit;
