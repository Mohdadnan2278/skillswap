import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { origin } from '../helpers/local-auth';
import { bookingAccount,requestBooking,bookingAction,startsAfter,bookingSkill,deadlineFixture,cleanupBookings } from '../helpers/local-bookings';
test('booking permissions, replay, role transitions, timing and transactional expiry',async({playwright})=>{
 const alice=await playwright.request.newContext({baseURL:origin});const bob=await playwright.request.newContext({baseURL:origin});const carol=await playwright.request.newContext({baseURL:origin});const anon=await playwright.request.newContext({baseURL:origin});
 try {
  const a=await bookingAccount(alice,'Booking Alice');const b=await bookingAccount(bob,'Booking Bob');const c=await bookingAccount(carol,'Booking Carol');
  expect((await anon.get('/api/v1/bookings')).status()).toBe(401);
  const start=startsAfter(120);const key=randomUUID();
  const response=await requestBooking(alice,b.id,start,30,key);expect(response.status()).toBe(201);
  const booking=(await response.json()).data;expect(booking.state).toBe('pending');expect(booking.creditReservationStatus).toBe('held');expect(booking.costUnits).toBe(30);expect(booking.learnerId).toBe(a.id);
  expect(Date.parse(booking.endsAt)-Date.parse(booking.startsAt)).toBe(30*60000);
  expect(booking.requestExpiresAt).toBe(start);
  expect((await (await requestBooking(alice,b.id,start,30,key)).json()).data).toEqual(booking);
  expect((await requestBooking(alice,b.id,startsAfter(180),30,key)).status()).toBe(409);
  const repeated=await Promise.all([requestBooking(alice,b.id,startsAfter(240),30,randomUUID()),requestBooking(alice,b.id,startsAfter(240),30,randomUUID())]);
  expect(repeated.map(r=>r.status()).sort()).toEqual([201,409]);
  expect((await carol.get(`/api/v1/bookings/${booking.id}`)).status()).toBe(404);
  expect((await bookingAction(carol,booking.id,'cancel')).status()).toBe(404);
  expect((await a.client.from('bookings').update({state:'accepted'}).eq('id',booking.id)).error?.code).toBe('42501');
  expect((await c.client.from('bookings').select('id').eq('id',booking.id)).data).toEqual([]);
  expect((await a.client.schema('private').from('booking_occupancy').select('*')).error).toBeTruthy();
  expect((await bookingAction(alice,booking.id,'accept')).status()).toBe(403);
  expect((await bob.put('/api/v1/me/skills',{headers:{origin},data:{offeredSkillIds:[],wantedSkillIds:[]}})).status()).toBe(200);
  expect((await requestBooking(alice,b.id,startsAfter(300))).status()).toBe(400);
  const acceptKey=randomUUID();const accepted=await bookingAction(bob,booking.id,'accept',acceptKey);expect(accepted.status()).toBe(200);
  expect((await accepted.json()).data.state).toBe('accepted');
  expect((await bookingAction(bob,booking.id,'accept',acceptKey)).status()).toBe(200);
  expect((await bookingAction(bob,booking.id,'accept')).status()).toBe(409);
  expect((await bob.put('/api/v1/me/skills',{headers:{origin},data:{offeredSkillIds:[bookingSkill],wantedSkillIds:[]}})).status()).toBe(200);
  expect((await bookingAction(alice,booking.id,'cancel')).status()).toBe(200);
  expect((await bookingAction(bob,booking.id,'accept')).status()).toBe(409);
  const next=await requestBooking(alice,b.id,start);expect(next.status()).toBe(201);const nextId=(await next.json()).data.id;
  expect((await bookingAction(bob,nextId,'reject')).status()).toBe(200);
  expect((await requestBooking(alice,a.id,startsAfter(300))).status()).toBe(400);
  for(const timestamp of [startsAfter(-30),startsAfter(5),startsAfter(31*24*60)])expect((await requestBooking(alice,b.id,timestamp)).status()).toBe(400);
  const body={teacherId:b.id,skillId:bookingSkill,startsAt:startsAfter(360),durationMinutes:30};
  for(const extra of [{learnerId:c.id},{costUnits:1},{state:'accepted'},{durationMinutes:15}])expect((await alice.post('/api/v1/bookings',{headers:{origin,'Idempotency-Key':randomUUID()},data:{...body,...extra}})).status()).toBe(400);
  expect((await alice.post('/api/v1/bookings',{headers:{origin},data:body})).status()).toBe(400);
  expect((await alice.post('/api/v1/bookings',{headers:{origin:'https://other.example','Idempotency-Key':randomUUID()},data:body})).status()).toBe(403);
  expect((await alice.post(`/api/v1/bookings/${nextId}/cancel`,{headers:{origin,'Idempotency-Key':randomUUID()},data:{teacherId:c.id}})).status()).toBe(400);
  expect((await bookingAction(bob,nextId,'confirm')).status()).toBe(409);
  const expiry=await requestBooking(alice,b.id,startsAfter(420));expect(expiry.status()).toBe(201);const expiryId=(await expiry.json()).data.id;
  deadlineFixture(expiryId);
  expect((await bookingAction(bob,expiryId,'accept')).status()).toBe(409);
  expect((await (await alice.get(`/api/v1/bookings/${expiryId}`)).json()).data.state).toBe('expired');
  expect((await requestBooking(alice,b.id,startsAfter(420))).status()).toBe(201);
  for(const duration of [60,90] as const) {
   const result=await requestBooking(alice,b.id,startsAfter(48*60+duration*2),duration);expect(result.status()).toBe(201);
   const row=(await result.json()).data;expect(row.costUnits).toBe(duration);expect(Date.parse(row.endsAt)-Date.parse(row.startsAt)).toBe(duration*60000);
   expect(Date.parse(row.requestExpiresAt)-Date.parse(row.createdAt)).toBe(24*60*60000);
   expect((await bookingAction(alice,row.id,'cancel')).status()).toBe(200);
  }
  const list=(await (await alice.get('/api/v1/bookings?limit=1&role=learner')).json()).data;
  expect(list.items).toHaveLength(1);expect(list.nextCursor).toBeTruthy();
  const page=(await (await alice.get(`/api/v1/bookings?limit=1&role=learner&cursor=${list.nextCursor}`)).json()).data;
  expect(page.items[0].id).not.toBe(list.items[0].id);
  expect((await alice.get(`/api/v1/bookings?role=teacher&cursor=${list.nextCursor}`)).status()).toBe(400);
  for(const query of ['limit=51','state=bad','role=admin','cursor=bad','limit=2&limit=3'])expect((await alice.get(`/api/v1/bookings?${query}`)).status()).toBe(400);
  // An accepted session whose local fixture start has passed cannot be cancelled.
  const active=await requestBooking(alice,b.id,startsAfter(480));const activeId=(await active.json()).data.id;expect((await bookingAction(bob,activeId,'accept')).status()).toBe(200);deadlineFixture(activeId,true);
  expect((await bookingAction(alice,activeId,'cancel')).status()).toBe(409);
 } finally {await Promise.all([alice,bob,carol].map(cleanupBookings));await Promise.all([alice.dispose(),bob.dispose(),carol.dispose(),anon.dispose()]);}
});

test('concurrent conflicts span both roles, adjacent intervals work, and terminal states release occupancy',async({playwright})=>{
 const contexts=await Promise.all(['A','B','C','D'].map(()=>playwright.request.newContext({baseURL:origin})));
 try {
  const accounts=[];for(let i=0;i<contexts.length;i++)accounts.push(await bookingAccount(contexts[i],`Concurrency ${i}`));
  const [a,b,c,d]=accounts;const start=startsAfter(720);
  // A learns from B while B tries to learn from C at the same instant.
  const races=await Promise.all([requestBooking(contexts[0],b.id,start),requestBooking(contexts[1],c.id,start)]);
  expect(races.map(r=>r.status()).sort()).toEqual([201,409]);
  const winner=(await races.find(r=>r.status()===201)!.json()).data;
  const actor=winner.learnerId===a.id?contexts[0]:contexts[1];
  expect((await bookingAction(actor,winner.id,'cancel')).status()).toBe(200);
  const sameTeacher=await Promise.all([requestBooking(contexts[0],b.id,start),requestBooking(contexts[3],b.id,start)]);
  expect(sameTeacher.map(r=>r.status()).sort()).toEqual([201,409]);
  const one=(await sameTeacher.find(r=>r.status()===201)!.json()).data;
  const learner=one.learnerId===a.id?contexts[0]:contexts[3];
  expect((await requestBooking(learner,b.id,new Date(Date.parse(start)+30*60000).toISOString())).status()).toBe(201);
  expect((await requestBooking(contexts[2],d.id,startsAfter(800))).status()).toBe(201);
  expect((await bookingAction(contexts[1],one.id,'reject')).status()).toBe(200);
  expect((await requestBooking(learner,b.id,start)).status()).toBe(201);
  const replayKey=randomUUID();const at=startsAfter(900);
  const replay=await Promise.all([requestBooking(contexts[2],d.id,at,30,replayKey),requestBooking(contexts[2],d.id,at,30,replayKey)]);
  expect(replay.map(r=>r.status())).toEqual([201,201]);expect((await replay[0].json()).data.id).toBe((await replay[1].json()).data.id);
 } finally {await Promise.all(contexts.map(cleanupBookings));await Promise.all(contexts.map(c=>c.dispose()));}
});
