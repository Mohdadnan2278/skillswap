import {test,expect,type APIRequestContext} from '@playwright/test';
import {origin} from '../helpers/local-auth';
import {bookingAccount,requestBooking,bookingAction,startsAfter,cleanupBookings} from '../helpers/local-bookings';
import {meetingClockFixture} from '../helpers/local-meetings';
function save(c:APIRequestContext,id:string,url:string|null,requestOrigin=origin){return c.put(`/api/v1/bookings/${id}/google-meet`,{headers:{origin:requestOrigin},data:{url}});}
function join(c:APIRequestContext,id:string){return c.post(`/api/v1/bookings/${id}/google-meet-access`,{headers:{origin},data:{}});}
test('Google Meet shares only teacher-managed canonical links, checks membership/state/window, and retains Jitsi',async({page,playwright})=>{
 await page.setViewportSize({width:390,height:844});const [learnerContext,strangerContext,anon]=await Promise.all([1,2,3].map(()=>playwright.request.newContext({baseURL:origin})));
 try{const teacher=await bookingAccount(page.request,'Meet Mobile Teacher'),learner=await bookingAccount(learnerContext,'Meet Learner');await bookingAccount(strangerContext,'Meet Stranger');const booking=(await (await requestBooking(learnerContext,teacher.id,startsAfter(120))).json()).data;
 const endpoint=`/api/v1/bookings/${booking.id}/google-meet`;expect((await anon.get(endpoint)).status()).toBe(401);expect((await strangerContext.get(endpoint)).status()).toBe(404);expect((await save(page.request,booking.id,'https://meet.google.com/abc-defg-hij')).status()).toBe(409);
 await bookingAction(page.request,booking.id,'accept');expect((await save(learnerContext,booking.id,'https://meet.google.com/abc-defg-hij')).status()).toBe(403);
 for(const url of ['http://meet.google.com/abc-defg-hij','https://meet.google.com.evil.test/abc-defg-hij','https://meet.google.com@evil.test/abc-defg-hij','javascript:alert(1)','https://meet.google.com/new','https://meet.google.com/abc-defg-hij\n'])expect((await save(page.request,booking.id,url)).status()).toBe(400);
 for(const url of ['https://meet.google.com/abc-defg-hij?authuser=0&hs=122','https://meet.google.com/abc-defg-hij#shared']){
  expect((await save(page.request,booking.id,url)).status()).toBe(200);
  expect((await (await learnerContext.get(endpoint)).json()).data.url).toBe('https://meet.google.com/abc-defg-hij');
 }
 expect((await save(page.request,booking.id,'https://meet.google.com/abc-defg-hij','https://foreign.test')).status()).toBe(403);
 await page.goto(`/bookings/${booking.id}`);await page.getByLabel('Google Meet link',{exact:true}).fill('https://meet.google.com/abc-defg-hij');await page.getByRole('button',{name:'Save Meet link',exact:true}).click();await expect(page.getByText('Google Meet link saved for both participants.',{exact:true})).toBeVisible();
 const read=await learnerContext.get(endpoint);expect(read.headers()['cache-control']).toContain('no-store');expect((await read.json()).data).toMatchObject({url:'https://meet.google.com/abc-defg-hij',canEdit:false});expect((await learner.client.schema('private').from('google_meet_links').select('*')).error).toBeTruthy();expect((await join(learnerContext,booking.id)).status()).toBe(409);
 await page.goto(`/bookings/${booking.id}/meeting`);await expect(page.getByRole('heading',{name:'Join with Jitsi'})).toBeVisible();await expect(page.getByRole('button',{name:'Prepare Google Meet'})).toHaveCount(0);
 meetingClockFixture(booking.id);await page.reload();await page.getByRole('button',{name:'Prepare Google Meet'}).click();const link=page.getByRole('link',{name:'Open Google Meet in a new tab'});await expect(link).toHaveAttribute('href','https://meet.google.com/abc-defg-hij');await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel','noopener noreferrer');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await (await learnerContext.get('/api/v1/me/wallet')).json()).data).toEqual({settledUnits:180,reservedUnits:30,availableUnits:150});expect((await join(strangerContext,booking.id)).status()).toBe(404);
 expect((await save(page.request,booking.id,null)).status()).toBe(200);expect((await join(learnerContext,booking.id)).status()).toBe(409);
 expect((await save(page.request,booking.id,'https://meet.google.com/ijk-lmno-pqr')).status()).toBe(200);expect((await learnerContext.post(`/api/v1/bookings/${booking.id}/meeting-access`,{headers:{origin},data:{}})).status()).toBe(200);
 meetingClockFixture(booking.id,-46);expect((await join(learnerContext,booking.id)).status()).toBe(409);expect((await save(page.request,booking.id,null)).status()).toBe(409);
 }finally{await Promise.all([page.request,learnerContext,strangerContext].map(cleanupBookings));await Promise.all([learnerContext,strangerContext,anon].map(c=>c.dispose()));}
});
