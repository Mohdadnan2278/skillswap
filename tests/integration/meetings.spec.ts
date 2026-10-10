import {test,expect,type APIRequestContext} from '@playwright/test';
import {origin} from '../helpers/local-auth';
import {bookingAccount,requestBooking,bookingAction,startsAfter,cleanupBookings} from '../helpers/local-bookings';
import {meetingClockFixture} from '../helpers/local-meetings';
import {localSql} from '../helpers/local-credits';
function access(c:APIRequestContext,id:string,data:object={},requestOrigin=origin){return c.post(`/api/v1/bookings/${id}/meeting-access`,{headers:{origin:requestOrigin},data});}
test('Jitsi demo grants require membership, funding, accepted state and a valid window; grants are bounded and never settle money',async({playwright})=>{
 const contexts=await Promise.all([1,2,3,4].map(()=>playwright.request.newContext({baseURL:origin})));const [a,b,c,anon]=contexts;
 try{const learner=await bookingAccount(a,'Video Learner'),teacher=await bookingAccount(b,'Video Teacher');await bookingAccount(c,'Video Stranger');
 const row=(await (await requestBooking(a,teacher.id,startsAfter(120))).json()).data;expect((await access(anon,row.id)).status()).toBe(401);expect((await access(c,row.id)).status()).toBe(404);expect((await access(a,row.id)).status()).toBe(409);
 expect((await access(a,row.id,{},'https://other.example')).status()).toBe(403);for(const extra of [{actorId:teacher.id},{roomReference:'somebody-elses-room'},{joinToken:'forged'}])expect((await access(a,row.id,extra)).status()).toBe(400);
 await bookingAction(b,row.id,'accept');expect((await access(a,row.id)).status()).toBe(409);meetingClockFixture(row.id);
 const first=await access(a,row.id);expect(first.status()).toBe(200);expect(first.headers()['cache-control']).toContain('no-store');const grant=(await first.json()).data;
 expect(grant.provider).toBe('jitsi_demo');expect(grant.serverOrigin).toBe('https://meet.jit.si');expect(grant.roomReference).toMatch(/^skillswap-[0-9a-f]{32}$/);expect(grant.joinToken).toBeUndefined();expect(grant.roomReference).not.toContain(row.id.replaceAll('-',''));
 const simultaneous=await Promise.all([access(a,row.id),access(b,row.id)]);for(const r of simultaneous){expect(r.status()).toBe(200);expect((await r.json()).data.roomReference).toBe(grant.roomReference);}
 for(let i=0;i<6;i++)expect((await access(a,row.id)).status()).toBe(200);expect((await access(a,row.id)).status()).toBe(429);
 expect((await learner.client.schema('private').from('meeting_rooms').select('*')).error).toBeTruthy();expect((await learner.client.rpc('meeting_access_context',{p_booking_id:row.id,p_consume:null as unknown as boolean})).data).toEqual({error:'VALIDATION_ERROR'});
 expect((await (await a.get('/api/v1/me/wallet')).json()).data).toEqual({settledUnits:180,reservedUnits:30,availableUnits:150});expect(localSql(`select count(*) from private.ledger_events where booking_id='${row.id}';`)).toBe('0');
 meetingClockFixture(row.id,-46);expect((await access(b,row.id)).status()).toBe(409);meetingClockFixture(row.id,-5);
 const dispute=await a.post(`/api/v1/bookings/${row.id}/dispute`,{headers:{origin,'Idempotency-Key':crypto.randomUUID()},data:{reason:'The classroom demonstration needs to stop'}});expect(dispute.status()).toBe(200);expect((await access(b,row.id)).status()).toBe(409);
 // A historical preview cannot be treated as a funded video booking.
 const legacy=crypto.randomUUID();localSql(`insert into public.bookings(id,teacher_id,learner_id,skill_id,starts_at,ends_at,duration_minutes,cost_units,state,request_expires_at,credit_reservation_status) values('${legacy}','${teacher.id}','${learner.id}','41000000-0000-4000-8000-000000000004',now()-interval '5 minutes',now()+interval '25 minutes',30,30,'accepted',now()-interval '5 minutes','not_integrated');`);expect((await access(b,legacy)).status()).toBe(409);
 }finally{await Promise.all([a,b,c].map(cleanupBookings));await Promise.all(contexts.map(c=>c.dispose()));}
});
