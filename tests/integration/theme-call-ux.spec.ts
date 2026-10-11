import { test, expect } from "@playwright/test";
import { origin } from "../helpers/local-auth";
import { bookingAccount, requestBooking, bookingAction, startsAfter, cleanupBookings } from "../helpers/local-bookings";
import { localSql } from "../helpers/local-credits";

test("themes follow the device, persist through navigation and sync between tabs", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Color theme")).toHaveValue("system");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(15, 27, 23)");
  await page.setViewportSize({ width: 320, height: 800 });
  await page.screenshot({ path: ".local/theme-public-dark-320.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: ".local/theme-public-dark-1280.png" });
  await page.getByLabel("Color theme").selectOption("light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(248, 250, 247)");
  await page.screenshot({ path: ".local/theme-public-light-1280.png" });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.screenshot({ path: ".local/theme-public-light-320.png" });
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Color theme")).toHaveValue("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const second = await context.newPage();
  await second.goto("/signup");
  await page.getByLabel("Color theme").selectOption("dark");
  await expect(second.getByLabel("Color theme")).toHaveValue("dark");
  await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Color theme").selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors.filter(error => /hydration|didn't match|does not match/i.test(error))).toEqual([]);
  await second.close();
});

test("theme controls work without browser storage and public pages fit a narrow phone", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage unavailable", "SecurityError"); } });
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  for (const route of ["/", "/login", "/signup", "/forgot-password"]) {
    await page.goto(route);
    await page.getByLabel("Color theme").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel("Color theme").selectOption("light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  }
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  await expect(page.getByLabel("Color theme")).toHaveCSS("transition-duration", "0s");
});

test("mobile call stays mounted while scheduled completion becomes available at the top", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const teacherContext = await browser.newContext({ baseURL: origin, viewport: { width: 320, height: 700 } });
  const teacherPage = await teacherContext.newPage();
  try {
    const teacher = await bookingAccount(teacherContext.request, "Call UX Teacher");
    await bookingAccount(page.request, "Call UX Learner");
    const result = await requestBooking(page.request, teacher.id, startsAfter(120));
    expect(result.status()).toBe(201);
    const { id } = (await result.json()).data;
    expect((await bookingAction(teacherContext.request, id, "accept")).status()).toBe(200);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // Local timing fixture only: test the UI boundary against real server actions, not media attendance.
    localSql(`begin;update public.bookings set starts_at=now()-interval '30 minutes'+interval '12 seconds',ends_at=now()+interval '12 seconds',request_expires_at=now()-interval '30 minutes'+interval '12 seconds' where id='${id}';update private.booking_occupancy o set during=tstzrange(b.starts_at,b.ends_at,'[)') from public.bookings b where b.id=o.booking_id and b.id='${id}';commit;`);
    await page.route("https://meet.jit.si/external_api.js", route => route.fulfill({
      contentType: "application/javascript",
      body: `window.JitsiMeetExternalAPI=class{constructor(domain,options){this.frame=document.createElement('div');this.frame.dataset.instance=crypto.randomUUID();this.frame.textContent='Explicit call placement fixture';options.parentNode.appendChild(this.frame)}addEventListeners(events){setTimeout(()=>events.videoConferenceJoined(),10)}dispose(){this.frame.remove()}}`,
    }));
    await page.goto(`/bookings/${id}/meeting`);
    await page.getByLabel("Color theme").selectOption("dark");
    await expect(page.getByRole("button", { name: "Confirm session completed", exact: true })).toHaveCount(0);
    const preview = page.locator('video[aria-label="Your local camera preview"]');
    const note = page.getByRole("note");
    expect((await preview.boundingBox())!.y).toBeLessThan((await note.boundingBox())!.y);
    await page.getByRole("button", { name: "Join call", exact: true }).click();
    const frame = page.getByTestId("jitsi-call-frame");
    await expect(frame).toBeVisible();
    await expect.poll(async () => (await frame.boundingBox())!.y).toBeLessThan(220);
    const instance = await frame.locator("[data-instance]").getAttribute("data-instance");
    await page.screenshot({ path: ".local/theme-call-active-mobile.png" });
    await expect(page.getByRole("button", { name: "Use Google Meet", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Confirm session completed", exact: true })).toBeInViewport({ timeout: 20_000 });
    expect(await frame.locator("[data-instance]").getAttribute("data-instance")).toBe(instance);
    await page.screenshot({ path: ".local/theme-call-completion-mobile.png" });
    expect((await (await page.request.get("/api/v1/me/wallet")).json()).data).toEqual({ settledUnits: 180, reservedUnits: 30, availableUnits: 150 });
    await page.getByRole("button", { name: "Confirm session completed", exact: true }).click();
    await expect(page.getByText("Your completion is recorded. Waiting for the other participant.", { exact: true })).toBeVisible();
    await teacherPage.goto(`/bookings/${id}`);
    await expect(teacherPage.getByRole("button", { name: "Confirm session completed", exact: true })).toBeInViewport();
    await teacherPage.getByRole("button", { name: "Confirm session completed", exact: true }).click();
    await expect(teacherPage.getByTestId("booking-state")).toHaveText("completed");
    await teacherPage.screenshot({ path: ".local/theme-call-booking-mobile.png" });
    expect((await (await page.request.get("/api/v1/me/wallet")).json()).data).toEqual({ settledUnits: 150, reservedUnits: 0, availableUnits: 150 });
    expect((await (await teacherContext.request.get("/api/v1/me/wallet")).json()).data).toEqual({ settledUnits: 210, reservedUnits: 0, availableUnits: 210 });
    await page.goto(`/bookings/${id}/meeting`);
    await expect(page.getByText("Session completed. The credit transfer is complete.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Join call", exact: true })).toBeDisabled();
    // Theme-dependent member screens retain their layout and active navigation in both modes.
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const theme of ["light", "dark"]) {
        await page.getByLabel("Color theme").selectOption(theme);
        for (const route of ["/dashboard", "/discover", "/bookings", "/wallet", "/community", "/profile", "/notifications"]) {
          await page.goto(route);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
      }
    }
    await page.goto("/dashboard");
    await page.screenshot({ path: ".local/theme-dashboard-dark-desktop.png" });
  } finally {
    await Promise.all([cleanupBookings(page.request), cleanupBookings(teacherContext.request)]);
    await teacherContext.close();
  }
});
