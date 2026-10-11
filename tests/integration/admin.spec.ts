import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {origin} from '../helpers/local-auth';
import {bookingAccount,requestBooking,startsAfter,bookingAction,cleanupBookings,deadlineFixture} from '../helpers/local-bookings';
import {localSql,endedFixture} from '../helpers/local-credits';

const headers=()=>({origin,'Idempotency-Key':randomUUID()});
const reason='Reviewed by the demo administrator.';
async function manage(c:APIRequestContext,action:string,target:string,key=randomUUID()){
 return c.post('/api/v1/admin',{headers:{origin,'Idempotency-Key':key},data:{action,target,reason}});
}
test('admin roles are private; audited moderation, revocation and suspension preserve the ledger',async({playwright})=>{
 const a=await playwright.request.newContext({baseURL:origin}),b=await playwright.request.newContext({baseURL:origin}),anon=await playwright.request.newContext({baseURL:origin});let aid='';let bid='';
 try{
  const admin=await bookingAccount(a,'Admin Security'),member=await bookingAccount(b,'Admin Member');aid=admin.id;bid=member.id;
  expect((await anon.get('/api/v1/admin')).status()).toBe(401);expect((await b.get('/api/v1/admin')).status()).toBe(403);
  const deniedPage=await b.get('/admin');expect([200,404]).toContain(deniedPage.status());const deniedHtml=await deniedPage.text();expect(deniedHtml).toContain('404');expect(deniedHtml).not.toContain('SkillSwap management'); // A streamed Next.js notFound response may retain HTTP 200.
  await member.client.auth.updateUser({data:{role:'admin',isAdmin:true}});
  expect((await b.get('/api/v1/admin')).status()).toBe(403);
  expect((await member.client.rpc('admin_read')).error?.code).toBe('42501');
  localSql(`insert into private.admin_members(user_id) values('${aid}');`); // Explicit local bootstrap fixture, never an application privilege.
  expect((await a.get('/api/v1/admin')).status()).toBe(200);
  expect((await a.post('/api/v1/admin',{headers:{origin:'https://example.com','Idempotency-Key':randomUUID()},data:{action:'grant_admin',target:bid,reason}})).status()).toBe(403);
  expect((await a.post('/api/v1/admin',{headers:headers(),data:{action:'grant_admin',target:bid,reason,actor:aid}})).status()).toBe(400);
  const key=randomUUID(),grant=await manage(a,'grant_admin',bid,key);expect(grant.status()).toBe(200);
  const replay=await manage(a,'grant_admin',bid,key);expect((await replay.json()).data).toEqual((await grant.json()).data);
  expect((await manage(a,'revoke_admin',bid,key)).status()).toBe(409);
  expect((await b.get('/api/v1/admin?section=members')).status()).toBe(200);
  expect((await manage(a,'suspend_member',bid)).status()).toBe(409);
  expect((await manage(a,'revoke_admin',bid)).status()).toBe(200);expect((await b.get('/api/v1/admin')).status()).toBe(403);
  expect((await manage(a,'suspend_member',aid)).status()).toBe(409);
  const last=localSql(`begin;delete from private.admin_members where user_id<>'${aid}';set local request.jwt.claim.sub='${aid}';set local role authenticated;select public.admin_manage('revoke_admin','${aid}','{}','${reason}','${randomUUID()}');rollback;`);
  expect(last).toContain('INVALID_STATE');
  const walletBefore=(await (await b.get('/api/v1/me/wallet')).json()).data;
  expect((await manage(a,'suspend_member',bid)).status()).toBe(200);
  expect((await b.get('/api/v1/me')).status()).toBe(403);
  expect((await member.client.from('profiles').select('*')).data).toEqual([]);
  expect((await member.client.rpc('save_my_profile',{p_display_name:'Changed',p_bio:'',p_college:'',p_timezone:'UTC'})).error?.code).toBe('42501');
  expect((await member.client.rpc('read_my_bookings',{})).error?.code).toBe('42501');
  expect((await a.get(`/api/v1/profiles/${bid}`)).status()).toBe(404);
  expect((await admin.client.rpc('create_booking_request',{p_teacher_id:bid,p_skill_id:'41000000-0000-4000-8000-000000000004',p_starts_at:startsAfter(120),p_duration:30,p_key:randomUUID()})).error?.code).toBe('42501');
  expect((await manage(a,'restore_member',bid)).status()).toBe(200);
  expect((await (await b.get('/api/v1/me/wallet')).json()).data.settledUnits).toBe(walletBefore.settledUnits);
  const booking=(await (await requestBooking(b,aid,startsAfter(120))).json()).data;await bookingAction(a,booking.id,'accept');
  endedFixture(booking.id);await bookingAction(b,booking.id,'confirm');await bookingAction(a,booking.id,'confirm');
  const review=await b.post(`/api/v1/bookings/${booking.id}/feedback`,{headers:headers(),data:{rating:5,comment:'An original immutable review'}});expect(review.status()).toBe(201);const fid=(await review.json()).data.id;
  expect((await manage(a,'hide_feedback',fid)).status()).toBe(200);
  expect((await member.client.from('feedback').select('*').eq('id',fid)).data).toEqual([]);
  expect((await member.client.rpc('read_my_feedback',{p_booking_id:booking.id})).data).toMatchObject({id:fid,hidden:true});
  expect((await (await a.get(`/api/v1/profiles/${aid}`)).json()).data.reputation.ratingCount).toBe(0);
  expect((await b.post(`/api/v1/bookings/${booking.id}/feedback`,{headers:headers(),data:{rating:1,comment:'Replacement'}})).status()).toBe(409);
  const page=await b.get(`/bookings/${booking.id}`);expect(await page.text()).toContain('hidden from community');
  expect((await manage(a,'restore_feedback',fid)).status()).toBe(200);
  expect((await (await a.get(`/api/v1/profiles/${aid}`)).json()).data.reputation.ratingCount).toBe(1);
  expect(localSql(`select comment from public.feedback where id='${fid}'`)).toBe('An original immutable review');
  const disputed=(await (await requestBooking(b,aid,startsAfter(240))).json()).data;expect((await bookingAction(a,disputed.id,'accept')).status()).toBe(200);
  deadlineFixture(disputed.id,true);expect((await b.post(`/api/v1/bookings/${disputed.id}/dispute`,{headers:headers(),data:{reason:'The demo session requires staff review'}})).status()).toBe(200);
  const heldBefore=(await (await b.get('/api/v1/me/wallet')).json()).data;
  expect((await manage(a,'review_dispute',disputed.id)).status()).toBe(200);
  expect((await (await b.get('/api/v1/me/wallet')).json()).data).toEqual(heldBefore);
  expect((await (await b.get(`/api/v1/bookings/${disputed.id}`)).json()).data.state).toBe('disputed');
  const disputes=(await (await a.get('/api/v1/admin?section=disputes')).json()).data;expect(disputes.rows.some((r:{id:string;review_note:string})=>r.id===disputed.id&&r.review_note===reason)).toBe(true);
  for(const participant of [a,b])expect((await participant.post(`/api/v1/bookings/${disputed.id}/resolve`,{headers:headers(),data:{resolution:'cancel'}})).status()).toBe(200);
  const audit=(await (await a.get('/api/v1/admin?section=audit')).json()).data;
  expect(audit.rows.some((r:{action:string})=>r.action==='hide_feedback')).toBe(true);
  const auditId=(await grant.json()).data.auditId;expect(()=>localSql(`update private.admin_audit set reason='Tampered reason' where id='${auditId}'`)).toThrow();
 }finally{
  if(aid)localSql(`delete from private.admin_members where user_id='${aid}';`);
  if(bid)localSql(`delete from private.admin_members where user_id='${bid}';update private.member_suspensions set suspended=false where user_id='${bid}';`);
  await Promise.all([a,b].map(cleanupBookings));await Promise.all([a,b,anon].map(c=>c.dispose()));
 }
});

test('mobile administration creates and disables a skill with an audit reason; Google option is visible',async({page})=>{
 await page.setViewportSize({width:390,height:844});let aid='';
 try{
  await page.goto('/login');await expect(page.getByRole('button',{name:'Continue with Google'})).toBeVisible();await expect(page.getByRole('button',{name:'Continue with Google'})).toBeDisabled();
  expect((await page.request.post('/api/auth/google',{headers:{origin},data:{}})).status()).toBe(503);
  const account=await bookingAccount(page.request,'Admin Mobile');aid=account.id;localSql(`insert into private.admin_members(user_id) values('${aid}');`);
  await page.goto('/admin?section=skills');await expect(page.getByRole('heading',{name:'Administration',exact:true})).toBeVisible();
  const slug='admin-ui-'+randomUUID().slice(0,8);const name='Admin UI '+slug;
  await page.getByLabel('Name',{exact:true}).fill(name);await page.getByLabel('Slug',{exact:true}).fill(slug);await page.getByLabel('Category',{exact:true}).fill('Demo');
  await page.getByRole('button',{name:'Review new skill'}).click();await page.getByLabel('Reason or review note').fill(reason);await page.getByRole('button',{name:'Confirm action'}).click();
  const row=page.getByRole('article').filter({has:page.getByRole('heading',{name,exact:true})});await expect(row).toBeVisible();
  await row.getByRole('button',{name:'Disable skill'}).click();await page.getByLabel('Reason or review note').fill(reason);await page.getByRole('button',{name:'Confirm action'}).click();await expect(row.getByRole('button',{name:'Enable skill'})).toBeVisible();
  await page.getByRole('link',{name:'Audit',exact:true}).click();await expect(page.getByRole('heading',{name:'create_skill',exact:true}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{if(aid)localSql(`delete from private.admin_members where user_id='${aid}'`);await cleanupBookings(page.request);}
});
