import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {origin,mailpitUrl} from '../helpers/local-auth';
import {bookingAccount,bookingAction,requestBooking,startsAfter,cleanupBookings,deadlineFixture} from '../helpers/local-bookings';
import {localSql} from '../helpers/local-credits';
import {bookingSkill} from '../helpers/local-bookings';
const headers=()=>({origin,'Idempotency-Key':randomUUID()});

test('booking pagination preserves database timestamp precision across all and history views',async({playwright})=>{
 const learner=await playwright.request.newContext({baseURL:origin}),teacher=await playwright.request.newContext({baseURL:origin});
 try{
  const t=await bookingAccount(teacher,'Precision teacher');await bookingAccount(learner,'Precision learner');const ids:string[]=[];
  for(let i=0;i<2;i++){const r=await learner.post('/api/v1/bookings',{headers:headers(),data:{teacherId:t.id,skillId:bookingSkill,startMode:'now',durationMinutes:30}});expect(r.status()).toBe(201);const b=(await r.json()).data;ids.push(b.id);expect((await bookingAction(learner,b.id,'cancel')).status()).toBe(200);}
  const instant=new Date(Date.now()+5*60000).toISOString().replace(/\.\d{3}Z$/,'.123456Z');
  localSql(`update public.bookings set starts_at='${instant}',ends_at='${instant}'::timestamptz+interval '30 minutes',request_expires_at='${instant}' where id in('${ids[0]}','${ids[1]}')`);
  for(const view of ['all','history']){
   const first=(await(await teacher.get(`/api/v1/bookings?view=${view}&limit=1`)).json()).data;expect(first.items).toHaveLength(1);expect(Boolean(first.nextCursor)).toBe(true);
   const second=(await(await teacher.get(`/api/v1/bookings?view=${view}&limit=1&cursor=${encodeURIComponent(first.nextCursor)}`)).json()).data;expect(second.items).toHaveLength(1);expect(second.items[0].id!==first.items[0].id).toBe(true);expect(second.nextCursor).toBeNull();
   expect((await teacher.get(`/api/v1/bookings?view=${view==='all'?'history':'all'}&cursor=${encodeURIComponent(first.nextCursor)}`)).status()).toBe(400);
  }
 }finally{await Promise.all([learner,teacher].map(cleanupBookings));await Promise.all([learner,teacher].map(c=>c.dispose()));}
});

test('availability is opt-in, owner-only, expiring and applied before discovery pagination',async({playwright})=>{
 const learner=await playwright.request.newContext({baseURL:origin}),teacher=await playwright.request.newContext({baseURL:origin}),anon=await playwright.request.newContext({baseURL:origin});
 try{
  const l=await bookingAccount(learner,'Available learner'),t=await bookingAccount(teacher,'Available teacher');
  expect((await anon.put('/api/v1/me/availability',{headers:{origin},data:{minutes:30}})).status()).toBe(401);
  expect((await teacher.put('/api/v1/me/availability',{headers:{origin},data:{minutes:30,userId:l.id}})).status()).toBe(400);
  expect((await teacher.put('/api/v1/me/availability',{headers:{origin:'https://evil.example'},data:{minutes:30}})).status()).toBe(403);
  const available=await teacher.put('/api/v1/me/availability',{headers:{origin},data:{minutes:30}});expect(available.status()).toBe(200);
  expect((await t.client.from('member_availability').update({available_until:new Date().toISOString()}).eq('user_id',l.id)).error?.code).toBe('42501');
  const found=(await (await learner.get('/api/v1/discover?availableOnly=true&limit=1')).json()).data;
  // Other test accounts may be available; follow real cursors rather than assuming this teacher is first.
  let page=found;const ids:string[]=[];while(true){ids.push(...page.items.map((i:{profile:{id:string}})=>i.profile.id));if(!page.nextCursor)break;page=(await(await learner.get('/api/v1/discover?availableOnly=true&limit=1&cursor='+encodeURIComponent(page.nextCursor))).json()).data;}
  expect(ids).toContain(t.id);expect(new Set(ids).size).toBe(ids.length);
  localSql(`update public.member_availability set available_until=now()-interval '1 minute' where user_id='${t.id}'`);
  const expired=(await(await learner.get('/api/v1/discover?availableOnly=true&limit=50')).json()).data;expect(expired.items.some((i:{profile:{id:string}})=>i.profile.id===t.id)).toBe(false);
  expect((await teacher.put('/api/v1/me/availability',{headers:{origin},data:{minutes:0}})).status()).toBe(200);
 }finally{await Promise.all([learner,teacher].map(cleanupBookings));await Promise.all([learner,teacher,anon].map(c=>c.dispose()));}
});

test('booking notifications are transactional, private and do not duplicate on retries; expiry worker releases without a participant read',async({playwright})=>{
 const learner=await playwright.request.newContext({baseURL:origin}),teacher=await playwright.request.newContext({baseURL:origin});
 try{
  const l=await bookingAccount(learner,'Inbox learner'),t=await bookingAccount(teacher,'Inbox teacher');const key=randomUUID();
  const request=await requestBooking(learner,t.id,startsAfter(80),30,key);expect(request.status()).toBe(201);const b=(await request.json()).data;
  expect((await requestBooking(learner,t.id,b.startsAt,30,key)).status()).toBe(201);
  const inbox=(await(await teacher.get('/api/v1/me/notifications')).json()).data;expect(inbox.items.filter((n:{booking_id:string;kind:string})=>n.booking_id===b.id&&n.kind==='pending')).toHaveLength(1);
  const notice=inbox.items.find((n:{booking_id:string})=>n.booking_id===b.id);expect(inbox.unreadCount).toBe(1);
  expect((await l.client.from('booking_notifications').select('*').eq('id',notice.id)).data).toEqual([]);
  expect((await learner.put('/api/v1/me/notifications',{headers:{origin},data:{ids:[notice.id]}})).status()).toBe(200);
  expect((await(await teacher.get('/api/v1/me/notifications')).json()).data.unreadCount).toBe(1);
  expect((await teacher.put('/api/v1/me/notifications',{headers:{origin},data:{ids:[notice.id]}})).status()).toBe(200);
  expect((await(await teacher.get('/api/v1/me/notifications')).json()).data.unreadCount).toBe(0);
  expect((await bookingAction(teacher,b.id,'accept')).status()).toBe(200);
  expect((await(await learner.get('/api/v1/me/notifications')).json()).data.items.some((n:{kind:string})=>n.kind==='accepted')).toBe(true);
  expect((await bookingAction(learner,b.id,'cancel')).status()).toBe(200);
  const overdue=(await(await requestBooking(learner,t.id,startsAfter(180))).json()).data;deadlineFixture(overdue.id);
  expect(localSql(`select state from public.bookings where id='${overdue.id}'`)).toBe('pending');
  localSql('select private.sweep_booking_requests();');
  expect(localSql(`select state||':'||credit_reservation_status from public.bookings where id='${overdue.id}'`)).toBe('expired:released');
  expect(localSql(`select reserved_units from public.wallets where user_id='${l.id}'`)).toBe('0');
  expect(()=>localSql('begin;set local role authenticated;select private.sweep_booking_requests();rollback;')).toThrow();
  expect((await t.client.from('booking_notifications').insert({user_id:l.id,booking_id:b.id,kind:'completed'})).error?.code).toBe('42501');
 }finally{await Promise.all([learner,teacher].map(cleanupBookings));await Promise.all([learner,teacher].map(c=>c.dispose()));}
});

test('support cancellation is restricted, audited, retry-safe and conserves credits',async({playwright})=>{
 const staff=await playwright.request.newContext({baseURL:origin}),learner=await playwright.request.newContext({baseURL:origin}),teacher=await playwright.request.newContext({baseURL:origin});let aid='',tid='';
 try{
  const a=await bookingAccount(staff,'Recovery staff'),l=await bookingAccount(learner,'Recovery learner'),t=await bookingAccount(teacher,'Recovery teacher');aid=a.id;tid=t.id;
  localSql(`insert into private.admin_members(user_id) values('${aid}'),('${tid}');`);
  const b=(await(await requestBooking(learner,t.id,startsAfter(70))).json()).data;expect((await bookingAction(teacher,b.id,'accept')).status()).toBe(200);
  const reason='Reviewed the no-show and released this stuck reservation.';const command={action:'cancel_stuck_booking',target:b.id,reason};
  expect((await learner.post('/api/v1/admin',{headers:headers(),data:command})).status()).toBe(403);
  expect((await staff.post('/api/v1/admin',{headers:headers(),data:command})).status()).toBe(409);
  localSql(`begin;update public.bookings set starts_at=now()-interval '26 hours',ends_at=now()-interval '26 hours'+interval '30 minutes',request_expires_at=now()-interval '26 hours' where id='${b.id}';update private.booking_occupancy o set during=tstzrange(b.starts_at,b.ends_at,'[)') from public.bookings b where b.id=o.booking_id and b.id='${b.id}';commit;`);
  expect((await teacher.post('/api/v1/admin',{headers:headers(),data:command})).status()).toBe(409);
  const retryKey=randomUUID();const results=await Promise.all([0,1].map(()=>staff.post('/api/v1/admin',{headers:{origin,'Idempotency-Key':retryKey},data:command})));
  expect(results.map(r=>r.status())).toEqual([200,200]);expect((await results[0].json()).data).toEqual((await results[1].json()).data);
  const wallets=await Promise.all([learner,teacher].map(async c=>(await(await c.get('/api/v1/me/wallet')).json()).data));
  expect(wallets.map(w=>w.settledUnits)).toEqual([180,180]);expect(wallets[0].reservedUnits).toBe(0);
  expect(localSql(`select count(*) from private.admin_audit where actor='${aid}' and request_key='${retryKey}'`)).toBe('1');
  expect(localSql(`select count(*) from private.ledger_events where booking_id='${b.id}'`)).toBe('0');
  expect((await(await learner.get(`/api/v1/bookings/${b.id}`)).json()).data.state).toBe('cancelled');
  const inbox=(await(await learner.get('/api/v1/me/notifications')).json()).data;expect(inbox.items.some((n:{kind:string})=>n.kind==='cancelled')).toBe(true);
  expect((await staff.post('/api/v1/admin',{headers:{origin,'Idempotency-Key':retryKey},data:{...command,reason:'Different reason for the same retry key.'}})).status()).toBe(409);
  const next=(await(await requestBooking(learner,t.id,startsAfter(160))).json()).data;expect((await bookingAction(teacher,next.id,'accept')).status()).toBe(200);
  localSql(`delete from private.admin_members where user_id='${tid}';insert into private.member_suspensions(user_id,suspended,reason,changed_by) values('${tid}',true,'Temporary test suspension','${aid}') on conflict(user_id) do update set suspended=true;`);
  expect((await staff.post('/api/v1/admin',{headers:headers(),data:{...command,target:next.id}})).status()).toBe(200);
  expect(localSql(`select reserved_units from public.wallets where user_id='${l.id}'`)).toBe('0');
 }finally{if(aid)localSql(`delete from private.admin_members where user_id='${aid}';`);if(tid)localSql(`delete from private.admin_members where user_id='${tid}';update private.member_suspensions set suspended=false where user_id='${tid}';`);await Promise.all([staff,learner,teacher].map(cleanupBookings));await Promise.all([staff,learner,teacher].map(c=>c.dispose()));}
});

test('320px mobile availability and inbox work; ordinary bookings refresh acceptance without a reload',async({page,browser})=>{
 test.setTimeout(90000);await page.setViewportSize({width:320,height:740});const teacherContext=await browser.newContext({baseURL:origin});
 try{
  const teacher=await bookingAccount(teacherContext.request,'Live teacher');await bookingAccount(page.request,'Live learner');
  await page.goto('/dashboard');await page.getByRole('button',{name:'Make me available'}).click();await expect(page.getByRole('button',{name:'Turn off availability'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const b=(await(await requestBooking(page.request,teacher.id,startsAfter(65))).json()).data;
  await page.goto(`/bookings/${b.id}`);await expect(page.getByTestId('booking-state')).toHaveText('pending');await bookingAction(teacherContext.request,b.id,'accept');
  await expect(page.getByTestId('booking-state')).toHaveText('accepted',{timeout:25000});
  await page.goto('/notifications');await expect(page.getByText('Your session was accepted')).toBeVisible();await page.getByRole('button',{name:'Mark this page as read'}).click();await expect(page.getByText('0 unread.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/bookings');await expect(page.getByRole('heading',{name:'SQL',exact:true})).toBeVisible();await expect(page.getByText('With Live teacher')).toBeVisible();
 }finally{await Promise.all([page.request,teacherContext.request].map(cleanupBookings));await teacherContext.close();}
});

test('recovery email chooses a new password, rejects anonymous writes and signs out existing sessions',async({playwright})=>{
 const account=await playwright.request.newContext({baseURL:origin}),other=await playwright.request.newContext({baseURL:origin}),anon=await playwright.request.newContext({baseURL:origin});
 try{
  const a=await bookingAccount(account,'Password recovery');expect((await other.post('/api/auth/login',{headers:{origin},data:a.fields})).status()).toBe(200);
  expect((await anon.post('/api/auth/reset-password',{headers:{origin},data:{password:'New!Password123'}})).status()).toBe(401);
  expect((await account.post('/api/auth/forgot-password',{headers:{origin},data:{email:a.fields.email}})).status()).toBe(200);
  let link='';await expect.poll(async()=>{const response=await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${a.fields.email}`)}`);const messages=await response.json();for(const row of messages.messages??[]){const message=await(await fetch(`${mailpitUrl}/api/v1/message/${row.ID}`)).json();const content=String(message.HTML??message.Text??'').replaceAll('&amp;','&');const links=[...content.matchAll(/https?:\/\/[^"\s<>]+/g)].map(match=>match[0]);for(const candidate of links){const url=new URL(candidate);if(url.pathname==='/auth/recovery'||(url.pathname==='/auth/v1/verify'&&url.searchParams.get('type')==='recovery')){link=candidate;return true;}}}return false;},{timeout:20000,message:'Local recovery email should arrive'}).toBe(true);
  expect(['http://127.0.0.1:54321',origin].includes(new URL(link).origin)).toBe(true);const recovered=await account.get(link);expect(new URL(recovered.url()).pathname==='/reset-password').toBe(true);
  const password=`New!${randomUUID()}`;const saved=await account.post('/api/auth/reset-password',{headers:{origin},data:{password}});expect(saved.status()).toBe(200);expect((await saved.json()).data.sessionsRevoked).toBe(true);
  expect((await other.get('/api/v1/me')).status()).toBe(401);
  expect((await anon.post('/api/auth/login',{headers:{origin},data:a.fields})).status()).toBe(401);
  expect((await anon.post('/api/auth/login',{headers:{origin},data:{email:a.fields.email,password}})).status()).toBe(200);
  const replay=await account.get(link);expect(new URL(replay.url()).pathname==='/forgot-password').toBe(true);expect(new URL(replay.url()).searchParams.get('notice')).toBe('expired');
 }finally{await Promise.all([account,other,anon].map(c=>c.dispose()));}
});


test('admin and community persist refreshed authentication cookies',async({playwright})=>{
 const context=await playwright.request.newContext({baseURL:origin});let aid='';
 try{
  const account=await bookingAccount(context,'Refresh member');aid=account.id;localSql(`insert into private.admin_members(user_id) values('${aid}')`);
  for(const path of ['/community','/admin']){
   expect((await context.post('/api/auth/login',{headers:{origin},data:account.fields})).status()).toBe(200);
   const state=await context.storageState();const matcher=/^sb-.*-auth-token(?:\.\d+)?$/;
   const cookies=state.cookies.filter(c=>matcher.test(c.name)).sort((a,b)=>a.name.localeCompare(b.name));
   const encoded=cookies.map(c=>c.value).join('');expect(encoded.startsWith('base64-')).toBe(true);
   const session=JSON.parse(Buffer.from(encoded.slice(7),'base64url').toString());session.expires_at=Math.floor(Date.now()/1000)-60;
   const old='base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');const name=cookies[0].name.replace(/\.\d+$/,'');const modified=state.cookies.filter(c=>!matcher.test(c.name));
   for(let offset=0;offset<old.length;offset+=3180)modified.push({...cookies[0],name:old.length>3180?`${name}.${offset/3180}`:name,value:old.slice(offset,offset+3180)});
   const stale=await playwright.request.newContext({baseURL:origin,storageState:{cookies:modified,origins:[]}});
   try{const response=await stale.get(path);expect(response.status()).toBe(200);expect(Boolean(response.headers()['set-cookie'])).toBe(true);
    const updated=(await stale.storageState()).cookies.filter(c=>matcher.test(c.name)).sort((a,b)=>a.name.localeCompare(b.name)).map(c=>c.value).join('');expect(updated!==old).toBe(true);
   }finally{await stale.dispose();}
  }
 }finally{if(aid)localSql(`delete from private.admin_members where user_id='${aid}'`);await cleanupBookings(context);await context.dispose();}
});
