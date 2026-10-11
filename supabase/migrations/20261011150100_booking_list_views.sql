begin;
create function public.read_my_booking_list(p_view text default 'all',p_after_start timestamptz default null,p_after_id uuid default null,p_state text default null,p_role text default null,p_limit integer default 21)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.booking_actor();result jsonb;begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);perform private.expire_booking_requests(actor);
 if p_view is null or p_view not in('all','upcoming','history') or p_limit is null or p_limit not between 1 and 51
  or (p_after_start is null)<>(p_after_id is null)
  or (p_state is not null and p_state not in('pending','accepted','rejected','cancelled','expired','completed','disputed'))
  or (p_role is not null and p_role not in('teacher','learner')) then return jsonb_build_object('error','VALIDATION_ERROR');end if;
 select coalesce(jsonb_agg(private.booking_json(b)
  order by case when p_view='history' then b.starts_at end desc,case when p_view<>'history' then b.starts_at end asc,
  case when p_view='history' then b.id end desc,case when p_view<>'history' then b.id end asc),'[]'::jsonb) into result from(
  select * from public.bookings b where actor in(b.teacher_id,b.learner_id)
   and (p_view='all' or (p_view='upcoming' and b.state in('pending','accepted','disputed')) or (p_view='history' and b.state in('completed','rejected','cancelled','expired')))
   and (p_state is null or b.state=p_state) and (p_role is null or(p_role='teacher' and b.teacher_id=actor)or(p_role='learner' and b.learner_id=actor))
   and (p_after_start is null or (p_view='history' and (b.starts_at,b.id)<(p_after_start,p_after_id)) or(p_view<>'history' and(b.starts_at,b.id)>(p_after_start,p_after_id)))
  order by case when p_view='history' then b.starts_at end desc,case when p_view<>'history' then b.starts_at end asc,
   case when p_view='history' then b.id end desc,case when p_view<>'history' then b.id end asc limit p_limit
 )b;
 return jsonb_build_object('items',result);
end;$$;
revoke all on function public.read_my_booking_list(text,timestamptz,uuid,text,text,integer) from public,anon;
grant execute on function public.read_my_booking_list(text,timestamptz,uuid,text,text,integer) to authenticated;
commit;
