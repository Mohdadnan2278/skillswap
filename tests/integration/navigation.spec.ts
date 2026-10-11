import { test, expect, type Page, type Locator } from "@playwright/test";
import { origin } from "../helpers/local-auth";
import { bookingAccount, bookingAction, requestBooking, startsAfter, cleanupBookings, deadlineFixture } from "../helpers/local-bookings";
import { localSql, endedFixture } from "../helpers/local-credits";

async function clickDestination(page: Page, link: Locator) {
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const target = new URL(href!, origin);
  expect(target.origin).toBe(origin);
  await link.click();
  await expect(page).toHaveURL(target.href);
}

async function checkLinks(page: Page) {
  const problems = await page.locator("a").evaluateAll(anchors => anchors.flatMap(anchor => {
    const box = anchor.getBoundingClientRect();
    if (box.width < 2 || box.height < 2 || getComputedStyle(anchor).visibility === "hidden") return [];
    const style = getComputedStyle(anchor);
    const href = anchor.getAttribute("href");
    const issues = [];
    if (!href || href === "#" || href.startsWith("javascript:")) issues.push("missing destination");
    if (!anchor.classList.contains("primary-button") && !anchor.classList.contains("secondary-button")) issues.push("missing button style");
    if (box.height < 44) issues.push("small touch target");
    if (style.color === style.backgroundColor) issues.push("invisible label");
    return issues.map(issue => `${anchor.textContent?.trim()}: ${issue}`);
  }));
  expect(problems).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

const destinations = [
  ["Dashboard", "/dashboard", /^Welcome,/], ["Discover", "/discover", "Discover members"],
  ["Bookings", "/bookings", "Your bookings"], ["Notifications", "/notifications", "Notifications"],
  ["Wallet", "/wallet", "Your wallet"], ["Community", "/community", "Community reputation"],
  ["Profile", "/profile", "Your profile"],
] as const;

async function memberLink(page: Page, name: string, mobile: boolean) {
  if (mobile) await page.locator("summary").filter({ hasText: "Menu" }).click();
  return page.getByRole("navigation", { name: mobile ? "Mobile member navigation" : "Member navigation", exact: true }).getByRole("link", { name, exact: true });
}

test("public button links navigate, theme stays visible, and narrow layouts fit", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(page.getByText("Theme", { exact: true })).toBeVisible();
    await page.getByLabel("Color theme").selectOption("dark");
    await checkLinks(page);
    await page.screenshot({path: `.local/navigation-home-dark-${width}.png`});
    await clickDestination(page, page.getByRole("link", { name: "How it works", exact: true }));
    await expect(page.getByRole("heading", { name: "Grow together, one skill at a time." })).toBeInViewport();
    await clickDestination(page, page.getByRole("link", { name: "Sign in", exact: true }));
    await checkLinks(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await clickDestination(page, page.getByRole("link", { name: "Forgot password?", exact: true }));
    await checkLinks(page);
    await clickDestination(page, page.getByRole("link", { name: "Back to sign in", exact: true }));
    await clickDestination(page, page.getByRole("link", { name: "Create an account", exact: true }));
    await checkLinks(page);
    await clickDestination(page, page.getByRole("link", { name: "Sign in", exact: true }));
    await clickDestination(page, page.getByRole("link", { name: "SkillSwap", exact: true }));
    await clickDestination(page, page.getByRole("link", { name: "Join now", exact: true }));
    await clickDestination(page, page.getByRole("link", { name: "SkillSwap", exact: true }));
    await clickDestination(page, page.getByRole("link", { name: "Start learning", exact: true }));
    await page.getByLabel("Color theme").selectOption("light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  }
  for (const route of ["/dashboard", "/bookings", "/wallet", "/notifications", "/profile", "/admin", "/reset-password"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect(errors).toEqual([]);
});

test("member navigation and dashboard shortcuts work in both themes on desktop and mobile", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await bookingAccount(page.request, "Navigation Member");
    await page.goto("/dashboard");
    for (const width of [320, 1280]) {
      const mobile = width < 1024;
      await page.setViewportSize({ width, height: 800 });
      for (const theme of ["light", "dark"]) {
        await page.getByLabel("Color theme").selectOption(theme);
        for (const [name, route, heading] of destinations) {
          const link = await memberLink(page, name, mobile);
          await expect(link).toHaveAttribute("href", route);
          await clickDestination(page, link);
          await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
          await checkLinks(page);
          if (name === "Dashboard") await page.screenshot({path: `.local/navigation-dashboard-${theme}-${width}.png`});
          const nav = page.getByRole("navigation", { name: mobile ? "Mobile member navigation" : "Member navigation", exact: true, includeHidden: true });
          await expect(nav.getByRole("link", { name, exact: true, includeHidden: true })).toHaveAttribute("aria-current", "page");
          await expect(nav.getByRole("link", { name: "Admin", exact: true, includeHidden: true })).toHaveCount(0);
          if (mobile) await expect(nav).not.toBeVisible();
        }
      }
      await page.goto("/dashboard");
      for (const name of ["View bookings", "View wallet", "View notifications", "Edit profile", "Discover members"]) {
        await clickDestination(page, page.getByRole("link", { name, exact: true }));
        await page.goto("/dashboard");
      }
      if (mobile) {
        const summary = page.locator("summary").filter({ hasText: "Menu" });
        await summary.click();
        await page.keyboard.press("Escape");
        await expect(summary).toBeFocused();
        await expect(page.getByRole("navigation", { name: "Mobile member navigation", exact: true })).not.toBeVisible();
      }
    }
    await page.getByRole("button", { name: "Make me available", exact: true }).click();
    await expect(page.getByText("You are now listed as available to teach.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Turn off availability", exact: true }).click();
    await expect(page.getByText("Your availability is turned off.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
  } finally { await cleanupBookings(page.request); }
});

test("booking, wallet, inbox, discovery, call and invalid-filter buttons reach the right destination", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 800 });
  const teacherContext = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 800 } });
  const teacherPage = await teacherContext.newPage();
  const errors: string[] = [];
  for (const p of [page, teacherPage]) p.on("pageerror", error => errors.push(error.message));
  try {
    const teacher = await bookingAccount(teacherContext.request, "Navigation Teacher");
    await bookingAccount(page.request, "Navigation Learner");
    await teacherContext.request.put("/api/v1/me/availability", { headers: { origin }, data: { minutes: 15 } });
    await page.goto("/discover");
    await page.getByLabel("Available now only").check();
    await page.getByRole("button", { name: "Apply filter", exact: true }).click();
    await clickDestination(page, page.getByRole("link", { name: "View Navigation Teacher's profile", exact: true }));
    await checkLinks(page);
    await clickDestination(page, page.getByRole("link", { name: "Back to discovery", exact: true }));
    await page.goto(`/people/${teacher.id}`);
    await clickDestination(page, page.getByRole("link", { name: "Request a session", exact: true }));
    await checkLinks(page);
    await clickDestination(page, page.getByRole("link", { name: "Change your timezone", exact: true }));
    await page.goto(`/people/${teacher.id}/request`);
    await clickDestination(page, page.getByRole("link", { name: "View wallet", exact: true }));
    await page.goto(`/people/${teacher.id}/request`);
    await clickDestination(page, page.getByRole("link", { name: "Back to member", exact: true }));

    const first = await requestBooking(page.request, teacher.id, startsAfter(120));
    expect(first.status()).toBe(201);
    const { id } = (await first.json()).data;
    await page.goto("/dashboard");
    await clickDestination(page, page.getByRole("link", { name: "View bookings", exact: true }));
    await clickDestination(page, page.getByRole("link", { name: "View booking", exact: true }));
    await expect(page).toHaveURL(`${origin}/bookings/${id}`);
    await teacherPage.goto("/notifications");
    await clickDestination(teacherPage, teacherPage.getByRole("link", { name: "View booking", exact: true }));
    await teacherPage.getByRole("button", { name: "Accept request", exact: true }).click();
    await expect(teacherPage.getByTestId("booking-state")).toHaveText("accepted");
    await page.goto("/wallet");
    await clickDestination(page, page.getByRole("link", { name: "Active reservations", exact: true }));
    await checkLinks(page);
    await page.screenshot({path: ".local/navigation-reserved-booking-320.png"});
    await clickDestination(page, page.getByRole("link", { name: "View reserved booking", exact: true }));
    await checkLinks(page);
    await clickDestination(page, page.getByRole("link", { name: "Prepare for call", exact: true }));
    await expect(page.getByRole("heading", { name: "Join with Jitsi", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Use Google Meet", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Google Meet option", exact: true })).toBeVisible();
    await checkLinks(page);
    await clickDestination(page, page.getByRole("link", { name: "Back to booking", exact: true }));
    await clickDestination(page, page.getByRole("link", { name: "Back to bookings", exact: true }));
    await page.goto("/notifications");
    await page.getByRole("button", { name: "Mark this page as read", exact: true }).click();
    await expect(page.getByText("0 unread.", { exact: false })).toBeVisible();
    await clickDestination(page, page.getByRole("link", { name: "View booking", exact: true }));
    endedFixture(id);
    await page.reload();
    await page.getByRole("button", { name: "Confirm session completed", exact: true }).click();
    await teacherPage.goto(`/bookings/${id}`);
    await teacherPage.getByRole("button", { name: "Confirm session completed", exact: true }).click();
    await expect(teacherPage.getByTestId("booking-state")).toHaveText("completed");
    await page.goto("/wallet");
    await clickDestination(page, page.getByRole("link", { name: "View booking", exact: true }));
    await expect(page.getByTestId("booking-state")).toHaveText("completed");
    await page.goto("/wallet?limit=1");
    await clickDestination(page, page.getByRole("link", { name: "Next entries", exact: true }));
    await expect(page.getByText("Starter credits", { exact: true })).toBeVisible();
    await clickDestination(page, page.getByRole("link", { name: "Your bookings", exact: true }));
    await clickDestination(page, page.getByRole("link", { name: "booking history", exact: true }));
    await clickDestination(page, page.getByRole("link", { name: "View booking", exact: true }));

    const second = await requestBooking(page.request, teacher.id, startsAfter(180));
    const secondId = (await second.json()).data.id;
    expect(second.status()).toBe(201);
    expect((await bookingAction(page.request, secondId, "cancel")).status()).toBe(200);
    await page.goto("/bookings?view=history&limit=1");
    const displayed = await page.getByRole("link", { name: "View booking", exact: true }).getAttribute("href");
    await clickDestination(page, page.getByRole("link", { name: "Next bookings", exact: true }));
    expect(await page.getByRole("link", { name: "View booking", exact: true }).getAttribute("href")).not.toBe(displayed);
    await page.goto(`/people/${teacher.id}?cursor=invalid`);
    await clickDestination(page, page.getByRole("link", { name: "Start again", exact: true }));
    for (const [route, name] of [["/bookings?view=invalid", "Reset bookings"], ["/wallet?kind=invalid", "Reset wallet"], ["/discover?skillId=invalid", "Reset discovery"], ["/community?limit=invalid", "Start again"], ["/notifications?limit=invalid", "Start again"]]) {
      await page.goto(route);
      await checkLinks(page);
      await clickDestination(page, page.getByRole("link", { name, exact: true }));
    }
    await page.goto("/notifications?limit=1");
    await clickDestination(page, page.getByRole("link", { name: "Older notifications", exact: true }));
    await checkLinks(page);
    expect(errors).toEqual([]);
  } finally {
    await teacherContext.request.put("/api/v1/me/availability", { headers: { origin }, data: { minutes: 0 } });
    await Promise.all([cleanupBookings(page.request), cleanupBookings(teacherContext.request)]);
    await teacherContext.close();
  }
});

test("admin section buttons and reset navigation work on narrow and desktop screens", async ({ page }) => {
  test.setTimeout(120_000);
  let id = "";
  try {
    const account = await bookingAccount(page.request, "Navigation Admin");
    id = account.id;
    localSql(`insert into private.admin_members(user_id) values('${id}');`);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/dashboard");
      await clickDestination(page, await memberLink(page, "Admin", width < 1024));
      for (const section of ["Overview", "Demo", "Members", "Skills", "Bookings", "Disputes", "Feedback", "Audit"]) {
        await clickDestination(page, page.getByRole("navigation", { name: "Admin sections", exact: true }).getByRole("link", { name: section, exact: true }));
        await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
        await checkLinks(page);
      }
      await page.goto("/admin?section=invalid");
      await clickDestination(page, page.getByRole("link", { name: "Start again", exact: true }));
      await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
    }
  } finally {
    if (id) localSql(`delete from private.admin_members where user_id='${id}'`);
    await cleanupBookings(page.request);
  }
});

test("Meet and Jitsi launch buttons open the checked provider destination in a new tab", async ({ page, context, browser }) => {
  const teacherContext = await browser.newContext({ baseURL: origin });
  try {
    const teacher = await bookingAccount(teacherContext.request, "Launch Teacher");
    await bookingAccount(page.request, "Launch Learner");
    const created = await requestBooking(page.request, teacher.id, startsAfter(120));
    expect(created.status()).toBe(201);
    const { id } = (await created.json()).data;
    expect((await bookingAction(teacherContext.request, id, "accept")).status()).toBe(200);
    expect((await teacherContext.request.put(`/api/v1/bookings/${id}/google-meet`, { headers: { origin }, data: { url: "https://meet.google.com/abc-defg-hij" } })).status()).toBe(200);
    // Explicit local timing/provider fixtures: verifies launch destinations, not live media.
    deadlineFixture(id, true);
    await context.route("https://meet.google.com/**", route => route.fulfill({ contentType: "text/html", body: "<title>Provider launch fixture</title><p>Explicit Google Meet navigation fixture</p>" }));
    await page.route("https://meet.jit.si/external_api.js", route => route.fulfill({ contentType: "application/javascript", body: "window.JitsiMeetExternalAPI=class{constructor(domain,options){this.frame=document.createElement('p');this.frame.textContent='Explicit Jitsi launch fixture';options.parentNode.appendChild(this.frame)}addEventListeners(events){setTimeout(()=>events.videoConferenceJoined(),10)}dispose(){this.frame.remove()}}" }));
    await context.route(/^https:\/\/meet\.jit\.si\/(?!external_api\.js).*$/, route => route.fulfill({ contentType: "text/html", body: "<title>Provider launch fixture</title><p>Explicit Jitsi navigation fixture</p>" }));
    await page.goto(`/bookings/${id}/meeting`);
    await page.getByRole("button", { name: "Use Google Meet", exact: true }).click();
    await page.getByRole("button", { name: "Prepare Google Meet", exact: true }).click();
    const meetLink = page.getByRole("link", { name: "Open Google Meet in a new tab", exact: true });
    await expect(meetLink).toHaveAttribute("rel", "noopener noreferrer");
    const meetPopup = page.waitForEvent("popup");
    await meetLink.click();
    const meet = await meetPopup;
    await expect(meet).toHaveURL("https://meet.google.com/abc-defg-hij");
    await meet.close();
    await page.getByRole("button", { name: "Use Jitsi", exact: true }).click();
    await page.getByRole("button", { name: "Check devices", exact: true }).click();
    await expect(page.getByRole("button", { name: "Check devices", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Stop preview", exact: true }).click();
    await page.getByRole("button", { name: "Join call", exact: true }).click();
    const jitsiLink = page.getByRole("link", { name: "Open Jitsi in a new tab", exact: true });
    await expect(jitsiLink).toHaveAttribute("rel", "noopener noreferrer");
    const destination = await jitsiLink.getAttribute("href");
    expect(new URL(destination!).hostname).toBe("meet.jit.si");
    const jitsiPopup = page.waitForEvent("popup");
    await jitsiLink.click();
    const jitsi = await jitsiPopup;
    await expect(jitsi).toHaveURL(destination!);
    await jitsi.close();
    await page.getByRole("button", { name: "Leave call", exact: true }).click();
    await expect(page.getByRole("button", { name: "Use Google Meet", exact: true })).toBeEnabled();
  } finally {
    await Promise.all([cleanupBookings(page.request), cleanupBookings(teacherContext.request)]);
    await teacherContext.close();
  }
});

test("missing and inaccessible pages offer theme-aware recovery without exposing private sessions", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
  await page.getByLabel("Color theme").selectOption("dark");
  await checkLinks(page);
  await clickDestination(page, page.getByRole("link", { name: "Return home", exact: true }));
  const teacherContext = await browser.newContext({ baseURL: origin });
  const learnerContext = await browser.newContext({ baseURL: origin });
  try {
    await bookingAccount(page.request, "Recovery Stranger");
    const teacher = await bookingAccount(teacherContext.request, "Private Session Teacher");
    await bookingAccount(learnerContext.request, "Private Session Learner");
    const created = await requestBooking(learnerContext.request, teacher.id, startsAfter(120));
    expect(created.status()).toBe(201);
    const { id } = (await created.json()).data;
    for (const route of [`/bookings/${id}`, `/bookings/${id}/meeting`, "/bookings/not-a-booking", "/people/not-a-member", "/admin"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: "Page unavailable", exact: true })).toBeVisible();
      await expect(page.getByText("Private Session Teacher", { exact: false })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Administration", exact: true })).toHaveCount(0);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await checkLinks(page);
      await clickDestination(page, page.getByRole("navigation", { name: "Recovery actions", exact: true }).getByRole("link", { name: "View bookings", exact: true }));
      await expect(page.getByRole("heading", { name: "Your bookings", exact: true })).toBeVisible();
    }
    await page.goto("/people/not-a-member");
    await clickDestination(page, page.getByRole("navigation", { name: "Recovery actions", exact: true }).getByRole("link", { name: "Discover members", exact: true }));
    await page.goto("/bookings/not-a-booking");
    await clickDestination(page, page.getByRole("navigation", { name: "Recovery actions", exact: true }).getByRole("link", { name: "Return to dashboard", exact: true }));
  } finally {
    await Promise.all([cleanupBookings(page.request), cleanupBookings(teacherContext.request), cleanupBookings(learnerContext.request)]);
    await Promise.all([teacherContext.close(), learnerContext.close()]);
  }
});
