import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { origin } from '../helpers/local-auth';
import { bookingAccount, bookingAction, bookingSkill, cleanupBookings, deadlineFixture, requestBooking, startsAfter } from '../helpers/local-bookings';

function requestNow(context: APIRequestContext, teacherId: string, key = randomUUID(), durationMinutes = 30) {
  return context.post('/api/v1/bookings', { headers: { origin, 'Idempotency-Key': key }, data: { teacherId, skillId: bookingSkill, startMode: 'now', durationMinutes } });
}
function meeting(context: APIRequestContext, id: string) {
  return context.post(`/api/v1/bookings/${id}/meeting-access`, { headers: { origin }, data: {} });
}
async function wallet(context: APIRequestContext) {
  return (await (await context.get('/api/v1/me/wallet')).json()).data;
}

test('immediate requests use server time, replay safely, join on acceptance and retain financial and participant guards', async ({ playwright }) => {
  const [learner, teacher, stranger] = await Promise.all([1, 2, 3].map(() => playwright.request.newContext({ baseURL: origin })));
  try {
    await bookingAccount(learner, 'Quick Learner');
    const t = await bookingAccount(teacher, 'Quick Teacher');
    const s = await bookingAccount(stranger, 'Quick Stranger');
    const key = randomUUID();
    const responses = await Promise.all([requestNow(learner, t.id, key), requestNow(learner, t.id, key)]);
    for (const response of responses) expect(response.status()).toBe(201);
    const booking = (await responses[0].json()).data;
    expect((await responses[1].json()).data).toEqual(booking);
    expect(Date.parse(booking.startsAt) - Date.parse(booking.createdAt)).toBe(5 * 60000);
    expect(booking.requestExpiresAt).toBe(booking.startsAt);
    expect(Date.parse(booking.endsAt) - Date.parse(booking.startsAt)).toBe(30 * 60000);
    expect(booking.creditReservationStatus).toBe('held');
    expect(await wallet(learner)).toEqual({ settledUnits: 180, reservedUnits: 30, availableUnits: 150 });
    expect((await requestNow(learner, t.id, key, 60)).status()).toBe(409);
    expect((await requestNow(stranger, t.id)).status()).toBe(409);
    expect((await requestNow(learner, s.id)).status()).toBe(409);
    expect((await requestBooking(learner, t.id, startsAfter(5))).status()).toBe(400);
    for (const extra of [{ startsAt: startsAfter(120) }, { startsAt: null }, { durationMinutes: 1 }, { costUnits: 1 }, { createdAt: startsAfter(-60) }]) {
      expect((await learner.post('/api/v1/bookings', { headers: { origin, 'Idempotency-Key': randomUUID() }, data: { teacherId: t.id, skillId: bookingSkill, startMode: 'now', durationMinutes: 30, ...extra } })).status()).toBe(400);
    }
    expect((await meeting(learner, booking.id)).status()).toBe(409);
    expect((await meeting(stranger, booking.id)).status()).toBe(404);
    expect((await bookingAction(learner, booking.id, 'accept')).status()).toBe(403);
    expect((await bookingAction(teacher, booking.id, 'accept')).status()).toBe(200);
    // No clock fixture: the real accepted request is already within the call window.
    const grants = await Promise.all([meeting(learner, booking.id), meeting(teacher, booking.id)]);
    for (const grant of grants) expect(grant.status()).toBe(200);
    expect((await grants[0].json()).data.roomReference).toBe((await grants[1].json()).data.roomReference);
    expect((await meeting(stranger, booking.id)).status()).toBe(404);
    expect((await teacher.put(`/api/v1/bookings/${booking.id}/google-meet`, { headers: { origin }, data: { url: 'https://meet.google.com/abc-defg-hij' } })).status()).toBe(200);
    for (const context of [learner, teacher]) {
      expect((await context.post(`/api/v1/bookings/${booking.id}/google-meet-access`, { headers: { origin }, data: {} })).status()).toBe(200);
      expect((await bookingAction(context, booking.id, 'confirm')).status()).toBe(409);
    }
    expect(await wallet(teacher)).toEqual({ settledUnits: 180, reservedUnits: 0, availableUnits: 180 });
    expect((await bookingAction(learner, booking.id, 'cancel')).status()).toBe(200);
    expect((await meeting(learner, booking.id)).status()).toBe(409);
    expect(await wallet(learner)).toEqual({ settledUnits: 180, reservedUnits: 0, availableUnits: 180 });
    const rejected = (await (await requestNow(learner, t.id)).json()).data;
    expect((await bookingAction(teacher, rejected.id, 'reject')).status()).toBe(200);
    expect(await wallet(learner)).toEqual({ settledUnits: 180, reservedUnits: 0, availableUnits: 180 });
    const expiring = (await (await requestNow(learner, t.id)).json()).data;
    // Explicit local deadline fixture only for expiry, never for immediate call access.
    deadlineFixture(expiring.id);
    expect((await bookingAction(teacher, expiring.id, 'accept')).status()).toBe(409);
    expect((await (await learner.get(`/api/v1/bookings/${expiring.id}`)).json()).data.state).toBe('expired');
    expect(await wallet(learner)).toEqual({ settledUnits: 180, reservedUnits: 0, availableUnits: 180 });
    expect((await teacher.put('/api/v1/me/skills', { headers: { origin }, data: { offeredSkillIds: [], wantedSkillIds: [] } })).status()).toBe(200);
    expect((await requestNow(learner, t.id)).status()).toBe(400);
  } finally {
    await Promise.all([learner, teacher, stranger].map(cleanupBookings));
    await Promise.all([learner, teacher, stranger].map(context => context.dispose()));
  }
});

test('320px Start now booking needs no date, preserves edits and enables both call choices immediately', async ({ page, browser }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const teacherContext = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } });
  const teacherPage = await teacherContext.newPage();
  try {
    const teacher = await bookingAccount(teacherContext.request, 'Live Call Teacher');
    await bookingAccount(page.request, 'Live Call Learner');
    await page.goto(`/people/${teacher.id}/request`);
    await page.getByRole('radio', { name: 'Start now', exact: true }).check();
    await expect(page.getByLabel('Start date and time', { exact: false })).toHaveCount(0);
    await page.getByLabel('Duration', { exact: true }).selectOption('30');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '.local/quick-call-request-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Review request', exact: true }).click();
    await expect(page.getByText('Immediately after the teacher accepts', { exact: true })).toBeVisible();
    await expect(page.getByText('It expires in 5 minutes', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Edit details' }).click();
    await expect(page.getByRole('radio', { name: 'Start now', exact: true })).toBeChecked();
    await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('30');
    await page.getByRole('button', { name: 'Review request', exact: true }).click();
    await page.getByRole('button', { name: 'Send request', exact: true }).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+$/);
    const id = page.url().split('/').at(-1)!;
    await expect(page.getByTestId('booking-state')).toHaveText('pending');
    await teacherPage.goto(`/bookings/${id}`);
    await teacherPage.getByRole('button', { name: 'Accept request', exact: true }).click();
    await expect(teacherPage.getByTestId('booking-state')).toHaveText('accepted');
    await page.reload();
    await page.getByRole('link', { name: 'Prepare for call', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Join call', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Prepare Google Meet', exact: true })).toBeDisabled();
    await expect(page.getByText('The teacher has not added a Meet link yet.', { exact: false })).toBeVisible();
    await expect(teacherPage.getByRole('link', { name: 'Create a Google Meet meeting' })).toHaveAttribute('href', 'https://meet.google.com/new');
    await teacherPage.getByLabel('Google Meet link', { exact: true }).fill('https://meet.google.com/abc-defg-hij?authuser=0&hs=122#shared');
    await teacherPage.getByRole('button', { name: 'Refresh Meet link', exact: true }).click();
    await expect(teacherPage.getByText('No Meet link has been saved yet.', { exact: false })).toBeVisible();
    await expect(teacherPage.getByLabel('Google Meet link', { exact: true })).toHaveValue('https://meet.google.com/abc-defg-hij?authuser=0&hs=122#shared');
    await teacherPage.getByRole('button', { name: 'Save Meet link', exact: true }).click();
    await expect(teacherPage.getByText('Google Meet link saved for both participants.', { exact: true })).toBeVisible();
    await expect(teacherPage.getByLabel('Google Meet link', { exact: true })).toHaveValue('https://meet.google.com/abc-defg-hij');
    // The learner was already on this screen before saving: no reload is needed.
    await expect(page.getByText('The teacher has added a Meet link.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prepare Google Meet', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Prepare Google Meet', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Open Google Meet in a new tab' })).toBeVisible();
    await teacherPage.getByRole('button', { name: 'Remove Meet link', exact: true }).click();
    await expect(teacherPage.getByText('Google Meet link removed.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Google Meet in a new tab' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Prepare Google Meet', exact: true })).toBeDisabled();
    await teacherPage.getByLabel('Google Meet link', { exact: true }).fill('https://meet.google.com/abc-defg-hij?authuser=0');
    await teacherPage.getByRole('button', { name: 'Save Meet link', exact: true }).click();
    await expect(teacherPage.getByText('Google Meet link saved for both participants.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prepare Google Meet', exact: true })).toBeEnabled();
    const timer = page.getByRole('timer', { name: 'Time until scheduled start' });
    const initial = await timer.innerText();
    await expect.poll(() => timer.innerText()).not.toBe(initial);
    const seconds = (value: string) => value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
    const beforeReload = seconds(await timer.innerText());
    await page.reload();
    await expect(timer).toBeVisible();
    expect(seconds(await timer.innerText())).toBeLessThanOrEqual(beforeReload + 1);
    await page.screenshot({ path: '.local/meet-schedule-mobile.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await wallet(page.request)).toEqual({ settledUnits: 180, reservedUnits: 30, availableUnits: 150 });
  } finally {
    await Promise.all([page.request, teacherContext.request].map(cleanupBookings));
    await teacherContext.close();
  }
});
