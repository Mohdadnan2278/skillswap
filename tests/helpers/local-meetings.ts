import {localSql} from './local-credits';
/** Local-only timing fixture: moves a session boundary; never claims an elapsed real call. */
export function meetingClockFixture(id:string,startOffsetMinutes=-5){
 if(!/^[0-9a-f-]{36}$/.test(id)||!Number.isInteger(startOffsetMinutes)||Math.abs(startOffsetMinutes)>120)throw Error('Invalid local fixture');
 localSql(`begin;update public.bookings set starts_at=now()+make_interval(mins=>${startOffsetMinutes}),ends_at=now()+make_interval(mins=>${startOffsetMinutes}+duration_minutes),request_expires_at=now()+make_interval(mins=>${startOffsetMinutes}) where id='${id}';update private.booking_occupancy o set during=tstzrange(b.starts_at,b.ends_at,'[)') from public.bookings b where b.id=o.booking_id and b.id='${id}';commit;`);
}
