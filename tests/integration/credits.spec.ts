import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {origin} from '../helpers/local-auth';
import {localSql,endedFixture} from '../helpers/local-credits';
import {bookingAccount,requestBooking,bookingAction,startsAfter,deadlineFixture,cleanupBookings} from '../helpers/local-bookings';
async function balance(c:APIRequestContext){const r=await c.get('/api/v1/me/wallet');expect(r.status()).toBe(200);return (await r.json()).data;}
async function finance(c:APIRequestContext,id:string,action:string,data:object={},key=randomUUID()){return c.post(`/api/v1/bookings/${id}/${action}`,{headers:{origin,'Idempotency-Key':key},data});}
function reconcile(){expect(localSql(`select count(*) from public.wallets w where w.settled_units<>(select coalesce(sum(delta_units),0) from public.ledger_entries e where e.user_id=w.user_id) or w.reserved_units<>(select coalesce(sum(units),0) from public.reservations r where r.learner_id=w.user_id and r.status='held');`)).toBe('0');expect(localSql(`select count(*) from (select event_id from public.ledger_entries group by event_id having count(*)<>2 or sum(delta_units)<>0) bad;`)).toBe('0');}
test('one-time issuance, concurrent spending, refunds, RLS and deferred ledger invariants',async({playwright})=>{
 const a=await playwright.request.newContext({baseURL:origin}),b=await playwright.request.newContext({baseURL:origin}),anon=await playwright.request.newContext({baseURL:origin});
 try{const learner=await bookingAccount(a,'Credits Learner'),teacher=await bookingAccount(b,'Credits Teacher');
 expect((await anon.get('/api/v1/me/wallet')).status()).toBe(401);
 expect(await balance(a)).toEqual({settledUnits:180,reservedUnits:0,availableUnits:180});
 await a.patch('/api/v1/me/profile',{headers:{origin},data:{displayName:'Credits Learner',bio:'Updated profile',college:'',timezone:'UTC'}});
 await Promise.all([balance(a),balance(a)]);expect(localSql(`select count(*) from private.ledger_events where beneficiary_id='${learner.id}';`)).toBe('1');
 expect((await learner.client.from('wallets').select('*').eq('user_id',teacher.id)).data).toEqual([]);
 expect((await learner.client.from('ledger_entries').select('*').eq('user_id',teacher.id)).data).toEqual([]);
 expect((await learner.client.from('wallets').update({settled_units:999}).eq('user_id',learner.id)).error?.code).toBe('42501');
 const races=await Promise.all([0,1,2,3].map(i=>requestBooking(a,teacher.id,startsAfter(120+i*120),90)));
 expect(races.map(r=>r.status()).sort()).toEqual([201,201,409,409]);for(const r of races.filter(r=>r.status()===409))expect((await r.json()).error.code).toBe('INSUFFICIENT_CREDITS');
 expect(await balance(a)).toEqual({settledUnits:180,reservedUnits:180,availableUnits:0});
 const ids=[];for(const r of races.filter(r=>r.status()===201))ids.push((await r.json()).data.id as string);
 const reservations=(await (await a.get('/api/v1/me/wallet/reservations?limit=1')).json()).data;expect(reservations.nextCursor).toBeTruthy();
 expect((await a.get(`/api/v1/me/wallet/transactions?cursor=${reservations.nextCursor}`)).status()).toBe(400);expect((await b.get(`/api/v1/me/wallet/reservations?cursor=${reservations.nextCursor}`)).status()).toBe(400);
 const second=(await (await a.get(`/api/v1/me/wallet/reservations?limit=1&cursor=${reservations.nextCursor}`)).json()).data;expect(second.items[0].bookingId).not.toBe(reservations.items[0].bookingId);
 const key=randomUUID();expect((await bookingAction(a,ids[0],'cancel',key)).status()).toBe(200);expect((await bookingAction(a,ids[0],'cancel',key)).status()).toBe(200);
 expect((await bookingAction(b,ids[1],'reject')).status()).toBe(200);expect(await balance(a)).toEqual({settledUnits:180,reservedUnits:0,availableUnits:180});
 const expiry=(await (await requestBooking(a,teacher.id,startsAfter(800))).json()).data;deadlineFixture(expiry.id);expect((await bookingAction(b,expiry.id,'accept')).status()).toBe(409);expect((await balance(a)).reservedUnits).toBe(0);
 expect(()=>localSql(`update public.ledger_entries set delta_units=delta_units+1 where user_id='${learner.id}';`)).toThrow();
 expect(()=>localSql(`begin;update public.wallets set settled_units=settled_units+1 where user_id='${learner.id}';commit;`)).toThrow();expect((await balance(a)).settledUnits).toBe(180);reconcile();
 }finally{await Promise.all([a,b].map(cleanupBookings));await Promise.all([a.dispose(),b.dispose(),anon.dispose()]);}
});
test('two-party completion transfers exactly once and disputed votes can change without premature transfer',async({playwright})=>{
 const a=await playwright.request.newContext({baseURL:origin}),b=await playwright.request.newContext({baseURL:origin}),c=await playwright.request.newContext({baseURL:origin});
 try{const learner=await bookingAccount(a,'Settlement Learner'),teacher=await bookingAccount(b,'Settlement Teacher');await bookingAccount(c,'Settlement Stranger');
 const row=(await (await requestBooking(a,teacher.id,startsAfter(120))).json()).data;expect((await bookingAction(b,row.id,'accept')).status()).toBe(200);
 expect((await finance(a,row.id,'confirm')).status()).toBe(409);endedFixture(row.id);
 const key=randomUUID();expect((await finance(a,row.id,'confirm',{},key)).status()).toBe(200);expect((await finance(a,row.id,'confirm',{},key)).status()).toBe(200);
 expect(await balance(a)).toEqual({settledUnits:180,reservedUnits:30,availableUnits:150});expect((await balance(b)).settledUnits).toBe(180);
 const finished=await Promise.all([finance(b,row.id,'confirm'),finance(b,row.id,'confirm')]);expect(finished.map(r=>r.status())).toEqual([200,200]);
 expect(await balance(a)).toEqual({settledUnits:150,reservedUnits:0,availableUnits:150});expect((await balance(b)).settledUnits).toBe(210);
 expect(localSql(`select count(*) from private.ledger_events where booking_id='${row.id}';`)).toBe('1');
 const history=(await (await a.get('/api/v1/me/wallet/transactions?limit=1')).json()).data;expect(history.items[0].deltaUnits).toBe(-30);expect(history.nextCursor).toBeTruthy();const older=(await (await a.get(`/api/v1/me/wallet/transactions?limit=1&cursor=${history.nextCursor}`)).json()).data;expect(older.items[0].kind).toBe('starter_grant');
 const disputed=(await (await requestBooking(a,teacher.id,startsAfter(240))).json()).data;await bookingAction(b,disputed.id,'accept');deadlineFixture(disputed.id,true);
 expect((await finance(c,disputed.id,'dispute',{reason:'I cannot join this session'})).status()).toBe(404);expect((await finance(a,disputed.id,'dispute',{reason:'short'})).status()).toBe(400);
 expect((await finance(a,disputed.id,'dispute',{reason:'The teaching session had a problem'})).status()).toBe(200);
 expect((await finance(a,disputed.id,'resolve',{resolution:'complete'})).status()).toBe(409);
 const vote=randomUUID();expect((await finance(a,disputed.id,'resolve',{resolution:'cancel'},vote)).status()).toBe(200);expect((await finance(a,disputed.id,'resolve',{resolution:'complete'},vote)).status()).toBe(409);
 endedFixture(disputed.id);expect((await finance(b,disputed.id,'resolve',{resolution:'complete'})).status()).toBe(200);expect((await balance(a)).reservedUnits).toBe(30);
 expect((await finance(a,disputed.id,'resolve',{resolution:'complete'})).status()).toBe(200);expect((await balance(a)).settledUnits).toBe(120);expect((await balance(b)).settledUnits).toBe(240);
 const cancelled=(await (await requestBooking(a,teacher.id,startsAfter(360))).json()).data;await bookingAction(b,cancelled.id,'accept');deadlineFixture(cancelled.id,true);await finance(b,cancelled.id,'dispute',{reason:'We agree that the session cannot continue'});await finance(a,cancelled.id,'resolve',{resolution:'cancel'});expect((await balance(a)).reservedUnits).toBe(30);await finance(b,cancelled.id,'resolve',{resolution:'cancel'});expect(await balance(a)).toEqual({settledUnits:120,reservedUnits:0,availableUnits:120});reconcile();
 // Historical previews remain unfunded: the local fixture does not mint or reserve credits.
 const legacy=randomUUID();localSql(`insert into public.bookings(id,teacher_id,learner_id,skill_id,starts_at,ends_at,duration_minutes,cost_units,state,request_expires_at,credit_reservation_status) values('${legacy}','${teacher.id}','${learner.id}','41000000-0000-4000-8000-000000000004',now()-interval '31 minutes',now()-interval '1 minute',30,30,'accepted',now()-interval '31 minutes','not_integrated');`);
 expect((await finance(a,legacy,'confirm')).status()).toBe(409);expect((await balance(a)).settledUnits).toBe(120);
 }finally{await Promise.all([a,b,c].map(cleanupBookings));await Promise.all([a.dispose(),b.dispose(),c.dispose()]);}
});
