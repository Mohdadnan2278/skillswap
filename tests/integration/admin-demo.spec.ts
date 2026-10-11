import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {origin} from '../helpers/local-auth';
import {bookingAccount,bookingAction,bookingSkill,cleanupBookings,deadlineFixture,requestBooking,startsAfter} from '../helpers/local-bookings';
import {localSql} from '../helpers/local-credits';

const headers=()=>({origin,'Idempotency-Key':randomUUID()});
const reason='Set a short credit transfer demonstration.';
async function policy(c:APIRequestContext){return (await c.get('/api/v1/admin?section=demo')).json().then(r=>r.data.rows[0]);}
async function configure(c:APIRequestContext,enabled:boolean,durationMinutes=1,costUnits=30,key=randomUUID(),version?:number){
 return c.post('/api/v1/admin',{headers:{origin,'Idempotency-Key':key},data:{action:'configure_demo',enabled,durationMinutes,costUnits,version:version??(await policy(c)).version,reason}});
}
function demo(c:APIRequestContext,teacherId:string,version:number,key=randomUUID(),extra={}){return c.post('/api/v1/bookings',{headers:{origin,'Idempotency-Key':key},data:{teacherId,skillId:bookingSkill,startMode:'demo',policyVersion:version,...extra}});}
async function wallet(c:APIRequestContext){return (await (await c.get('/api/v1/me/wallet')).json()).data;}
function resetPolicy(){localSql('update private.demo_policy set enabled=false,duration_minutes=1,cost_units=30,version=version+1;');}

test('demo settings require private admin authority; terms are versioned, bounded, audited and replay safely',async({playwright})=>{
 const [admin,learner,teacher,anon]=await Promise.all([1,2,3,4].map(()=>playwright.request.newContext({baseURL:origin})));let aid='';
 try{
  resetPolicy();aid=(await bookingAccount(admin,'Demo Admin')).id;await bookingAccount(learner,'Demo Learner');const t=await bookingAccount(teacher,'Demo Teacher');
  localSql(`insert into private.admin_members(user_id) values('${aid}');`);
  const initial=await policy(admin);
  expect((await configure(anon,true,1,30,randomUUID(),initial.version)).status()).toBe(401);
  expect((await configure(learner,true,1,30,randomUUID(),initial.version)).status()).toBe(403);
  expect((await t.client.rpc('admin_manage',{p_action:'configure_demo',p_target:null,p_value:{enabled:true,durationMinutes:1,costUnits:30,version:initial.version},p_reason:reason,p_key:randomUUID()})).error?.code).toBe('42501');
  expect((await t.client.rpc('read_demo_policy')).data).toMatchObject({enabled:false});
  expect((await demo(learner,t.id,initial.version)).status()).toBe(409);
  for(const [minutes,units] of [[0,30],[11,30],[1.5,30],[1,0],[1,31],[1,181]])expect((await configure(admin,true,minutes,units)).status()).toBe(400);
  for(const value of [{enabled:'true',durationMinutes:1,costUnits:30,version:initial.version},{enabled:true,durationMinutes:0,costUnits:30,version:initial.version},{enabled:true,durationMinutes:1,costUnits:31,version:initial.version},{enabled:true,durationMinutes:1,costUnits:30,version:initial.version,actor:aid}]){
   expect((await t.client.rpc('admin_manage',{p_action:'configure_demo',p_target:null,p_value:value,p_reason:reason,p_key:randomUUID()})).error?.code).toBe('42501');
   expect(()=>localSql(`begin;set local request.jwt.claim.sub='${aid}';set local role authenticated;select public.admin_manage('configure_demo',null,'${JSON.stringify(value)}','${reason}','${randomUUID()}');rollback;`)).toThrow();
  }
 }finally{if(aid)localSql(`delete from private.admin_members where user_id='${aid}';`);resetPolicy();await Promise.all([admin,learner,teacher].map(cleanupBookings));await Promise.all([admin,learner,teacher,anon].map(c=>c.dispose()));}
});

test('demo reserves configured cost and preserves terms across policy changes; rejection, cancellation and expiry release once',async({playwright})=>{
 const [a,l,t,s]=await Promise.all([1,2,3,4].map(()=>playwright.request.newContext({baseURL:origin})));let aid='';
 try{
  resetPolicy();aid=(await bookingAccount(a,'Policy Admin')).id;await bookingAccount(l,'Policy Learner');const teacher=await bookingAccount(t,'Policy Teacher');await bookingAccount(s,'Policy Outsider');
  localSql(`insert into private.admin_members(user_id) values('${aid}');`);
  const version=(await policy(a)).version,key=randomUUID();const saved=await configure(a,true,2,60,key,version);expect(saved.status()).toBe(200);
  expect((await (await configure(a,true,2,60,key,version)).json()).data).toEqual((await saved.json()).data);
  expect((await configure(a,false,2,60,key,version)).status()).toBe(409);
  expect((await configure(a,true,1,30,randomUUID(),version)).status()).toBe(409);
  const approved=(await policy(a)).version;
  expect((await demo(l,teacher.id,version)).status()).toBe(409);
  const requestKey=randomUUID(),requests=await Promise.all([demo(l,teacher.id,approved,requestKey),demo(l,teacher.id,approved,requestKey)]);
  for(const request of requests)expect(request.status()).toBe(201);const b=(await requests[0].json()).data;
  expect((await requests[1].json()).data).toEqual(b);expect(b).toMatchObject({isDemo:true,durationMinutes:2,costUnits:60,creditReservationStatus:'held'});
  expect(Date.parse(b.startsAt)-Date.parse(b.createdAt)).toBe(60000);expect(Date.parse(b.endsAt)-Date.parse(b.startsAt)).toBe(120000);
  expect(await wallet(l)).toEqual({settledUnits:180,reservedUnits:60,availableUnits:120});
  expect((await demo(s,teacher.id,approved)).status()).toBe(409);
  expect((await bookingAction(l,b.id,'accept')).status()).toBe(403);expect((await bookingAction(s,b.id,'confirm')).status()).toBe(404);
  expect((await bookingAction(t,b.id,'accept')).status()).toBe(200);expect((await bookingAction(l,b.id,'confirm')).status()).toBe(409);
  for(const extra of [{costUnits:1},{durationMinutes:1},{startsAt:startsAfter(-60)},{endsAt:startsAfter(-60)}])expect((await demo(l,teacher.id,approved,randomUUID(),extra)).status()).toBe(400);
  expect((await requestBooking(l,teacher.id,startsAfter(5),30)).status()).toBe(400);
  expect((await configure(a,false,10,180)).status()).toBe(200);
  expect((await (await demo(l,teacher.id,approved,requestKey)).json()).data).toEqual(b);
  expect((await demo(l,teacher.id,approved)).status()).toBe(409);
  expect((await (await l.get(`/api/v1/bookings/${b.id}`)).json()).data).toMatchObject({durationMinutes:2,costUnits:60});
  expect((await bookingAction(l,b.id,'cancel')).status()).toBe(200);expect(await wallet(l)).toEqual({settledUnits:180,reservedUnits:0,availableUnits:180});
  expect((await configure(a,true,1,180)).status()).toBe(200);const highVersion=(await policy(a)).version;
  const rejected=(await (await demo(l,teacher.id,highVersion)).json()).data;expect(rejected.costUnits).toBe(180);
  expect((await bookingAction(t,rejected.id,'reject')).status()).toBe(200);expect(await wallet(l)).toEqual({settledUnits:180,reservedUnits:0,availableUnits:180});
  const expired=(await (await demo(l,teacher.id,highVersion)).json()).data;deadlineFixture(expired.id);
  expect((await bookingAction(t,expired.id,'accept')).status()).toBe(409);expect(await wallet(l)).toEqual({settledUnits:180,reservedUnits:0,availableUnits:180});
  const normal=(await (await requestBooking(l,teacher.id,startsAfter(120),30)).json()).data;expect(normal).toMatchObject({isDemo:false,durationMinutes:30,costUnits:30});
  expect((await demo(l,teacher.id,highVersion)).status()).toBe(409);expect((await bookingAction(l,normal.id,'cancel')).status()).toBe(200);
  const audit=(await (await a.get('/api/v1/admin?section=audit')).json()).data;expect(audit.rows.some((r:{action:string;before_value:object;after_value:object})=>r.action==='configure_demo'&&r.before_value&&r.after_value)).toBe(true);
 }finally{await Promise.all([a,l,t,s].map(cleanupBookings));if(aid)localSql(`delete from private.admin_members where user_id='${aid}';`);resetPolicy();await Promise.all([a,l,t,s].map(c=>c.dispose()));}
});

test('320px admin sets one-minute demo; actual timer unlocks both confirmations and transfers 0.5 credits exactly once',async({page,browser})=>{
 test.setTimeout(240000);await page.setViewportSize({width:320,height:844});
 const teacherContext=await browser.newContext({baseURL:origin,viewport:{width:320,height:844}}),teacherPage=await teacherContext.newPage();let tid='';
 try{
  resetPolicy();const teacher=await bookingAccount(teacherContext.request,'Timed Demo Teacher');tid=teacher.id;const learner=await bookingAccount(page.request,'Timed Demo Learner');
  localSql(`insert into private.admin_members(user_id) values('${tid}');`);
  await teacherPage.goto('/admin?section=demo');await teacherPage.getByLabel('Enable demo sessions').check();
  await teacherPage.getByLabel('Demo duration (minutes)').fill('1');await teacherPage.getByLabel('Demo credit cost').selectOption('30');
  await teacherPage.getByRole('button',{name:'Review demo settings'}).click();await teacherPage.getByLabel('Reason or review note').fill(reason);await teacherPage.getByRole('button',{name:'Confirm action'}).click();
  await expect(teacherPage.getByText('Action saved and recorded in the audit log.')).toBeVisible();
  expect(await teacherPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await teacherPage.screenshot({path:'.local/admin-demo-mobile.png',fullPage:true});
  await page.goto(`/people/${tid}/request`);await page.getByRole('radio',{name:'Demo session',exact:true}).check();
  await expect(page.getByLabel('Duration',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Review request'}).click();
  await expect(page.getByText('Demo session: accept within 1 minute.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Send request'}).click();await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+$/);const id=page.url().split('/').at(-1)!;
  await teacherPage.goto(`/bookings/${id}`);await teacherPage.getByRole('button',{name:'Accept request'}).click();
  await expect(page.getByTestId('booking-state')).toHaveText('accepted');await expect(page.getByRole('timer')).toBeVisible();
  for(const c of [page.request,teacherContext.request])expect((await c.post(`/api/v1/bookings/${id}/meeting-access`,{headers:{origin},data:{}})).status()).toBe(200);
  expect((await bookingAction(page.request,id,'confirm')).status()).toBe(409);
  await page.screenshot({path:'.local/demo-booking-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  // Actual DB time: no edited deadlines/end times or provider/financial fixtures.
  await expect(page.getByRole('button',{name:'Confirm session completed'})).toBeVisible({timeout:145000});
  await page.getByRole('button',{name:'Confirm session completed'}).click();await expect(page.getByText('Learner confirmation: recorded.',{exact:false})).toBeVisible();
  expect(await wallet(page.request)).toEqual({settledUnits:180,reservedUnits:30,availableUnits:150});
  const transferKey=randomUUID();const results=await Promise.all([bookingAction(teacherContext.request,id,'confirm',transferKey),bookingAction(teacherContext.request,id,'confirm',transferKey)]);
  for(const result of results)expect(result.status()).toBe(200);expect((await results[0].json()).data).toMatchObject({state:'completed',creditReservationStatus:'settled'});
  expect(await wallet(page.request)).toEqual({settledUnits:150,reservedUnits:0,availableUnits:150});expect(await wallet(teacherContext.request)).toEqual({settledUnits:210,reservedUnits:0,availableUnits:210});
  expect(localSql(`select count(*) from public.ledger_entries e join private.ledger_events v on v.id=e.event_id where v.booking_id='${id}'`)).toBe('2');
  expect((await bookingAction(teacherContext.request,id,'confirm')).status()).toBe(200);
  expect(await wallet(teacherContext.request)).toEqual({settledUnits:210,reservedUnits:0,availableUnits:210});
  expect(localSql(`select count(*) from public.ledger_entries e join private.ledger_events v on v.id=e.event_id where v.booking_id='${id}'`)).toBe('2');
  expect((await page.request.post(`/api/v1/bookings/${id}/feedback`,{headers:headers(),data:{rating:5,comment:'Demo'}})).status()).toBe(409);
  expect((await learner.client.rpc('create_feedback',{p_booking_id:id,p_rating:5,p_comment:'Demo',p_key:randomUUID()})).data).toMatchObject({error:'INVALID_STATE'});
  expect(()=>localSql(`insert into public.feedback(booking_id,reviewer_id,reviewee_id,rating,comment) values('${id}','${learner.id}','${tid}',5,'Demo');`)).toThrow();
  await page.reload();await expect(page.getByTestId('booking-state')).toHaveText('completed');await expect(page.getByRole('heading',{name:'Review this session'})).toHaveCount(0);
  expect(localSql(`select sum(settled_units) from public.wallets where user_id in('${tid}','${learner.id}')`)).toBe('360');
 }finally{await Promise.all([page.request,teacherContext.request].map(cleanupBookings));if(tid)localSql(`delete from private.admin_members where user_id='${tid}';`);resetPolicy();await teacherContext.close();}
});
