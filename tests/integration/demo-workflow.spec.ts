import {test, expect, type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {credentials, confirmationLink, origin} from '../helpers/local-auth';
import {startsAfter, cleanupBookings} from '../helpers/local-bookings';
import {meetingClockFixture} from '../helpers/local-meetings';
import {endedFixture} from '../helpers/local-credits';

async function onboard(page: Page, name: string, timezone: string, teach: boolean) {
  const account = credentials('phase9');
  await page.goto('/signup');
  await page.getByLabel('Email', {exact: true}).fill(account.email);
  await page.getByLabel('Password', {exact: true}).fill(account.password);
  await page.getByLabel('Confirm password', {exact: true}).fill(account.password);
  await page.getByRole('button', {name: 'Create account', exact: true}).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.goto(await confirmationLink(account.email));
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('About you', {exact: false}).fill('Phase 9 local integration account');
  await page.getByLabel('Timezone', {exact: true}).fill(timezone);
  await page.getByRole('button', {name: 'Finish setup', exact: true}).click();
  await expect(page.getByRole('heading', {name: `Welcome, ${name}`, exact: true})).toBeVisible();
  await page.getByRole('link', {name: 'Edit profile', exact: true}).click();
  await page.getByRole('group', {name: teach ? /I can teach/ : /I want to learn/}).getByRole('checkbox', {name: /SQL/}).check();
  await page.getByRole('button', {name: 'Save skills', exact: true}).click();
  await expect(page.getByRole('status')).toContainText('Your skills are saved');
}

// This is real local Auth/PostgreSQL/UI integration, with explicit timing and Jitsi SDK fixtures.
// It does not represent a live media call, an elapsed 30-minute lesson, or physical-phone testing.
test('two mobile browsers complete signup → match → book → demo access → mutual settlement → feedback', async ({page, browser}) => {
  test.setTimeout(120_000); // Two full browser signup flows plus the integrated journey.
  await page.setViewportSize({width: 390, height: 844});
  const teacherContext = await browser.newContext({baseURL: origin, viewport: {width: 390, height: 844}});
  const teacherPage = await teacherContext.newPage();
  const teacherName = `Demo Teacher ${randomUUID().slice(0, 8)}`;
  try {
    await test.step('Two independently confirmed, onboarded accounts choose skills', async () => {
      await onboard(teacherPage, teacherName, 'UTC', true);
      await onboard(page, 'Demo Learner', 'Asia/Kolkata', false);
    });
    await page.goto('/discover');
    const match = page.getByRole('article').filter({has: page.getByRole('heading', {name: teacherName, exact: true})});
    await expect(match).toContainText('Can help you learn: SQL');
    await match.getByRole('link').click();
    await expect(page).toHaveURL(/\/people\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', {name: teacherName, exact: true})).toBeVisible();
    const teacherId = new URL(page.url()).pathname.split('/').at(-1)!;
    await page.getByRole('link', {name: 'Request a session', exact: true}).click();
    const start = startsAfter(120);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(start)).map(part => [part.type, part.value]));
    await page.getByLabel('Start date and time (Asia/Kolkata)').fill(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`);
    await page.getByLabel('Duration', {exact: true}).selectOption('30');
    await page.getByRole('button', {name: 'Review request', exact: true}).click();
    await expect(page.getByText('This request reserves 0.5 credits', {exact: false})).toBeVisible();
    await page.getByRole('button', {name: 'Send request', exact: true}).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+$/);
    const bookingId = new URL(page.url()).pathname.split('/').at(-1)!;
    await expect(page.getByTestId('booking-state')).toHaveText('pending');
    await teacherPage.goto(`/bookings/${bookingId}`);
    await expect(teacherPage.getByText('Start · UTC', {exact: true})).toBeVisible();
    await teacherPage.getByRole('button', {name: 'Accept request', exact: true}).click();
    await expect(teacherPage.getByTestId('booking-state')).toHaveText('accepted');
    await teacherPage.getByLabel('Google Meet link', {exact: true}).fill('https://meet.google.com/abc-defg-hij');
    await teacherPage.getByRole('button', {name: 'Save Meet link', exact: true}).click();
    await expect(teacherPage.getByText('Google Meet link saved for both participants.', {exact: true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', {name: 'Confirm session completed'})).toHaveCount(0);
    await page.getByRole('link', {name: 'Prepare for call', exact: true}).click();
    await expect(page.getByRole('button', {name: 'Join call', exact: true})).toBeDisabled();
    await test.step('Explicit local join-window and Jitsi browser fixtures exercise app access', async () => {
      meetingClockFixture(bookingId);
      await page.reload();
      await page.getByRole('button', {name: 'Prepare Google Meet', exact: true}).click();
      await expect(page.getByRole('link', {name: 'Open Google Meet in a new tab'})).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
      await page.route('https://meet.jit.si/external_api.js', route => route.fulfill({contentType: 'application/javascript', body: `window.JitsiMeetExternalAPI=class {constructor(domain,options){this.host=options.parentNode;this.frame=document.createElement('div');this.frame.textContent='Explicit Phase 9 Jitsi UI fixture';this.host.appendChild(this.frame);}addEventListeners(events){this.events=events;setTimeout(()=>events.videoConferenceJoined(),10);}dispose(){this.frame.remove();}};`}));
      await page.getByRole('button', {name: 'Join call', exact: true}).click();
      await expect(page.getByText('Connected to Jitsi.', {exact: false})).toBeVisible();
      await teacherPage.goto(`/bookings/${bookingId}/meeting`);
      await teacherPage.getByRole('button', {name: 'Prepare Google Meet', exact: true}).click();
      await expect(teacherPage.getByRole('link', {name: 'Open Google Meet in a new tab'})).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
      await page.getByRole('button', {name: 'Leave call', exact: true}).click();
      await expect(page.getByText('You left the call. No credits were transferred.', {exact: true})).toBeVisible();
      const wallet = (await (await page.request.get('/api/v1/me/wallet')).json()).data;
      expect(wallet).toEqual({settledUnits: 180, reservedUnits: 30, availableUnits: 150});
    });
    await test.step('Explicit local end-time fixture enables real two-party ledger settlement', async () => {
      endedFixture(bookingId);
      await page.getByRole('link', {name: 'Back to booking', exact: true}).click();
      await page.getByRole('button', {name: 'Confirm session completed', exact: true}).click();
      await expect(page.getByTestId('booking-state')).toHaveText('accepted');
      expect((await (await teacherPage.request.get('/api/v1/me/wallet')).json()).data.settledUnits).toBe(180);
      await teacherPage.goto(`/bookings/${bookingId}`);
      await teacherPage.getByRole('button', {name: 'Confirm session completed', exact: true}).click();
      await expect(teacherPage.getByTestId('booking-state')).toHaveText('completed');
      await page.goto('/wallet');
      await expect(page.getByTestId('wallet-total')).toHaveText('2.5 credits');
      await expect(page.getByTestId('wallet-reserved')).toHaveText('0 credits');
      await teacherPage.goto('/wallet');
      await expect(teacherPage.getByTestId('wallet-total')).toHaveText('3.5 credits');
    });
    await page.goto(`/bookings/${bookingId}`);
    await page.getByLabel('Rating', {exact: true}).selectOption('5');
    await page.getByLabel('Comment (optional)', {exact: true}).fill('Clear SQL explanation in the local workflow test.');
    await page.getByRole('button', {name: 'Publish feedback', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Your published feedback', exact: true})).toBeVisible();
    await page.goto(`/people/${teacherId}`);
    await expect(page.getByText('5.00 / 5 · 1 rating', {exact: true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await teacherPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await cleanupBookings(page.request);
    await page.locator('summary').filter({hasText: 'Menu'}).click();
    await page.getByRole('button', {name: 'Sign out', exact: true}).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto(`/bookings/${bookingId}`);
    await expect(page).toHaveURL(/\/login$/);
    // Independent teacher cookies remain valid after the learner signs out.
    expect((await teacherPage.request.get(`/api/v1/bookings/${bookingId}`)).status()).toBe(200);
  } finally {
    // Only this test's choices/future requests; no user deletion, reset or extra credits.
    await Promise.all([cleanupBookings(page.request), cleanupBookings(teacherContext.request)]);
    await teacherContext.close();
  }
});
