import { test,expect } from '@playwright/test';
import { origin } from '../helpers/local-auth';
import { bookingAccount,startsAfter,cleanupBookings } from '../helpers/local-bookings';
import { formatSessionTime } from '@/shared/time';
test('mobile scheduling review, two-party acceptance, cancellation and local time display',async({page,browser})=>{
 await page.setViewportSize({width:320,height:844});
 const teacherContext=await browser.newContext({baseURL:origin,viewport:{width:390,height:844}});const teacherPage=await teacherContext.newPage();
 try {
  const teacher=await bookingAccount(teacherContext.request,'Mobile Booking Teacher');await bookingAccount(page.request,'Mobile Booking Learner');
  await teacherContext.request.patch('/api/v1/me/profile',{headers:{origin},data:{displayName:'Mobile Booking Teacher',bio:'Teaching SQL',college:'',timezone:'UTC'}});
  await page.goto(`/people/${teacher.id}`);await page.getByRole('link',{name:'Request a session'}).click();
  await expect(page.getByText('Requests reserve time and credits.',{exact:false})).toBeVisible();
  const start=startsAfter(180);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(start)).map(part=>[part.type,part.value]));
  const wall=`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  await page.getByLabel('Start date and time (Asia/Kolkata)').fill(wall);await page.getByLabel('Duration',{exact:true}).selectOption('30');
  await page.getByRole('button',{name:'Review request',exact:true}).click();await expect(page.getByRole('heading',{name:'Review your request'})).toBeVisible();await expect(page.getByRole('region',{name:'Review your request',exact:true})).toBeFocused();
  await expect(page.getByText('This request reserves 0.5 credits',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Edit details'}).click();await expect(page.getByLabel('Start date and time (Asia/Kolkata)')).toHaveValue(wall);
  await page.getByRole('button',{name:'Review request',exact:true}).click();await page.getByRole('button',{name:'Send request',exact:true}).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+$/);const id=page.url().split('/').at(-1)!;
  await expect(page.getByTestId('booking-state')).toHaveText('pending');await expect(page.getByRole('button',{name:'Accept request'})).toHaveCount(0);
  const stored=(await (await page.request.get(`/api/v1/bookings/${id}`)).json()).data;expect(stored.startsAt).toBe(start);expect(stored.creditReservationStatus).toBe('held');
  await expect(page.getByText(formatSessionTime(start,'Asia/Kolkata'),{exact:true})).toHaveCount(2); // start and expiry
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await teacherPage.goto(`/bookings/${id}`);await expect(teacherPage.getByText('Start · UTC',{exact:true})).toBeVisible();
  await teacherPage.getByRole('button',{name:'Accept request',exact:true}).click();await expect(teacherPage.getByTestId('booking-state')).toHaveText('accepted');
  await page.reload();await expect(page.getByTestId('booking-state')).toHaveText('accepted');
  await page.getByRole('button',{name:'Cancel booking',exact:true}).click();await expect(page.getByTestId('booking-state')).toHaveText('cancelled');
  await teacherPage.reload();await expect(teacherPage.getByRole('button',{name:'Cancel booking'})).toHaveCount(0);
  await page.getByRole('link',{name:'Back to bookings'}).click();await expect(page.getByRole('heading',{name:'Your bookings'})).toBeVisible();
  await page.getByLabel('View',{exact:true}).selectOption('history');await page.getByLabel('Status',{exact:true}).selectOption('cancelled');await page.getByRole('button',{name:'Apply filter',exact:true}).click();
  await expect(page.getByRole('article')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 } finally {await Promise.all([cleanupBookings(page.request),cleanupBookings(teacherContext.request)]);await teacherContext.close();}
});
