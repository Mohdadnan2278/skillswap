import {test,expect} from '@playwright/test';
import {origin} from '../helpers/local-auth';
import {bookingAccount,requestBooking,bookingAction,startsAfter,cleanupBookings} from '../helpers/local-bookings';
import {endedFixture} from '../helpers/local-credits';
test('mobile wallet tracks a real reservation and two-person completion',async({page,browser})=>{
 await page.setViewportSize({width:390,height:844});const teacherContext=await browser.newContext({baseURL:origin,viewport:{width:390,height:844}});const teacherPage=await teacherContext.newPage();
 try{const teacher=await bookingAccount(teacherContext.request,'Wallet Mobile Teacher');await bookingAccount(page.request,'Wallet Mobile Learner');
 await page.goto('/wallet');await expect(page.getByTestId('wallet-available')).toHaveText('3 credits');await expect(page.getByText('Starter credits',{exact:true})).toBeVisible();
 const r=await requestBooking(page.request,teacher.id,startsAfter(120));expect(r.status()).toBe(201);const id=(await r.json()).data.id;
 await page.reload();await expect(page.getByTestId('wallet-available')).toHaveText('2.5 credits');await expect(page.getByTestId('wallet-reserved')).toHaveText('0.5 credits');await page.getByRole('link',{name:'Active reservations',exact:true}).click();await expect(page.getByText('0.5 credits · pending',{exact:true})).toBeVisible();
 await bookingAction(teacherContext.request,id,'accept');endedFixture(id);await page.goto(`/bookings/${id}`);await page.getByRole('button',{name:'Confirm session completed',exact:true}).click();await expect(page.getByTestId('booking-state')).toHaveText('accepted');
 await teacherPage.goto(`/bookings/${id}`);await teacherPage.getByRole('button',{name:'Confirm session completed',exact:true}).click();await expect(teacherPage.getByTestId('booking-state')).toHaveText('completed');
 await page.goto('/wallet');await expect(page.getByTestId('wallet-total')).toHaveText('2.5 credits');await expect(page.getByTestId('wallet-reserved')).toHaveText('0 credits');await expect(page.getByText('Learning session spent',{exact:true})).toBeVisible();
 await teacherPage.goto('/wallet');await expect(teacherPage.getByTestId('wallet-total')).toHaveText('3.5 credits');await expect(teacherPage.getByText('Teaching session earned',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await teacherPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await Promise.all([cleanupBookings(page.request),cleanupBookings(teacherContext.request)]);await teacherContext.close();}
});
