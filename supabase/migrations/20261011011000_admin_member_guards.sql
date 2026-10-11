begin;
-- Preserve the applied admin migration and tighten creation/author visibility separately.
create or replace function private.guard_member_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not public.account_is_active() then raise exception 'Account unavailable' using errcode='42501';end if;
 if tg_table_name='bookings' and tg_op='INSERT' then
  if not public.member_is_visible(new.teacher_id) or not public.member_is_visible(new.learner_id) then raise exception 'Participant unavailable' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
create function public.read_my_feedback(p_booking_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.booking_actor();result jsonb;begin
 select to_jsonb(f)||jsonb_build_object('hidden',not public.feedback_is_visible(f.id)) into result from public.feedback f where f.booking_id=p_booking_id and f.reviewer_id=v_actor;
 return result;
end;$$;
revoke all on function public.read_my_feedback(uuid) from public,anon;
grant execute on function public.read_my_feedback(uuid) to authenticated;
commit;
