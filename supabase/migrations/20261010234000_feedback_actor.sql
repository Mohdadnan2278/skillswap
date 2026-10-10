begin;
-- Qualify the actor variable independently of the idempotency table column.
create or replace function public.create_feedback(p_booking_id uuid,p_rating integer,p_comment text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.booking_actor();b public.bookings;f public.feedback;old private.booking_idempotency;
 op text:='feedback:'||p_booking_id::text;payload jsonb;result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(552041005);
 select * into b from public.bookings where id=p_booking_id and v_actor in(teacher_id,learner_id);
 if not found then return jsonb_build_object('error','NOT_FOUND');end if;
 if p_key is null or p_rating is null or p_rating not between 1 and 5 or p_comment is null or char_length(p_comment)>500 then
  return jsonb_build_object('error','VALIDATION_ERROR');end if;
 payload:=jsonb_build_object('rating',p_rating,'comment',btrim(p_comment));
 select * into old from private.booking_idempotency where booking_idempotency.actor=v_actor and operation=op and request_key=p_key;
 if found then
  if old.input<>payload then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');end if;
  return old.result;
 end if;
 if b.state<>'completed' or b.credit_reservation_status<>'settled' or b.ends_at>clock_timestamp() then return jsonb_build_object('error','INVALID_STATE');end if;
 if exists(select 1 from public.feedback where booking_id=b.id and reviewer_id=v_actor) then return jsonb_build_object('error','ALREADY_REVIEWED');end if;
 insert into public.feedback(booking_id,reviewer_id,reviewee_id,rating,comment)
 values(b.id,v_actor,case when v_actor=b.teacher_id then b.learner_id else b.teacher_id end,p_rating,btrim(p_comment)) returning * into f;
 result:=jsonb_build_object('feedback',to_jsonb(f));
 insert into private.booking_idempotency(actor,operation,request_key,input,result) values(v_actor,op,p_key,payload,result);
 return result;
end;
$$;
commit;
