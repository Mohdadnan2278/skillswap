import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { signupAndConfirm, origin } from "../helpers/local-auth";
import { localSql } from "../helpers/local-credits";
import { bookingAction, cleanupBookings, startsAfter } from "../helpers/local-bookings";

const headers = { origin };
const profile = (name: string) => ({ displayName: name, bio: "Sharing something new.", college: "", timezone: "Asia/Kolkata" });
test("custom skills share an identity, match and book; member guards, moderation and quotas apply", async ({ playwright }) => {
  const a = await playwright.request.newContext({ baseURL: origin });
  const b = await playwright.request.newContext({ baseURL: origin });
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  let aid = ""; let bid = ""; const created: string[] = [];
  try {
    const teacher = await signupAndConfirm(a, "custom-teacher");
    const learner = await signupAndConfirm(b, "custom-learner");
    expect((await anonymous.post("/api/v1/skills", { headers, data: { name: "Baking", category: "Other" } })).status()).toBe(401);
    expect((await a.post("/api/v1/skills", { headers, data: { name: "Baking", category: "Other" } })).status()).toBe(403);
    expect((await teacher.client.rpc("create_custom_skill", { p_name: "Baking", p_category: "Other" })).error?.code).toBe("P0001");
    await a.patch("/api/v1/me/profile", { headers, data: profile("Custom Teacher") });
    await b.patch("/api/v1/me/profile", { headers, data: profile("Custom Learner") });
    aid = (await (await a.get("/api/v1/me")).json()).data.id;
    bid = (await (await b.get("/api/v1/me")).json()).data.id;
    const name = `Baking ${randomUUID().slice(0, 8)}`;
    const results = await Promise.all([a.post("/api/v1/skills", { headers, data: { name, category: "Lifestyle" } }), b.post("/api/v1/skills", { headers, data: { name: `  ${name.toUpperCase()}  `, category: "Other" } })]);
    expect(results.map(result => result.status()).sort()).toEqual([200, 201]);
    const [first, second] = await Promise.all(results.map(async result => (await result.json()).data));
    expect(first.skill.id).toBe(second.skill.id); expect(first.skill.category).toBe(second.skill.category);
    created.push(first.skill.id);
    const skills = { offeredSkillIds: [first.skill.id], wantedSkillIds: [] };
    expect((await a.put("/api/v1/me/skills", { headers, data: skills })).status()).toBe(200);
    expect((await b.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [], wantedSkillIds: [first.skill.id] } })).status()).toBe(200);
    const matches = (await (await b.get(`/api/v1/discover?skillId=${first.skill.id}`)).json()).data.items;
    expect(matches.find((match: { profile: { id: string } }) => match.profile.id === aid).matchedSkills[0].id).toBe(first.skill.id);
    const booking = await b.post("/api/v1/bookings", { headers: { origin, "Idempotency-Key": randomUUID() }, data: { teacherId: aid, skillId: first.skill.id, startsAt: startsAfter(120), durationMinutes: 30 } });
    expect(booking.status()).toBe(201); expect((await bookingAction(b, (await booking.json()).data.id, "cancel")).status()).toBe(200);
    expect((await b.post("/api/v1/skills", { headers: { origin: "https://example.com" }, data: { name, category: "Other" } })).status()).toBe(403);
    expect((await b.post("/api/v1/skills", { headers, data: { name, category: "Other", userId: aid } })).status()).toBe(400);
    expect((await learner.client.from("skills").insert({ id: randomUUID(), slug: "illegal-custom", name: "Illegal", category: "Other" })).error?.code).toBe("42501");
    expect((await teacher.client.rpc("create_custom_skill", { p_name: "x".repeat(61), p_category: "Other" })).error?.code).toBe("22023");
    localSql(`update public.skills set enabled=false where id='${first.skill.id}';`);
    expect((await a.post("/api/v1/skills", { headers, data: { name, category: "Other" } })).status()).toBe(409);
    localSql(`insert into private.member_suspensions(user_id,suspended,reason,changed_by) values('${bid}',true,'Local security fixture','${aid}');`);
    expect((await b.post("/api/v1/skills", { headers, data: { name: "Suspended custom skill", category: "Other" } })).status()).toBe(403);
    expect((await learner.client.rpc("create_custom_skill", { p_name: "Suspended custom skill", p_category: "Other" })).error?.code).toBe("42501");
    localSql(`update private.member_suspensions set suspended=false where user_id='${bid}';`);
    const token = randomUUID().slice(0, 8);
    // The other actor created zero or one of the first shared skill: add exactly its remaining quota.
    const ownCount = Number(localSql(`select count(*) from private.skill_submissions where user_id='${aid}';`));
    for (let i = ownCount; i < 10; i++) {
      const response = await a.post("/api/v1/skills", { headers, data: { name: `Quota ${token} ${i}`, category: "Other" } });
      expect(response.status()).toBe(201); created.push((await response.json()).data.skill.id);
    }
    expect((await a.post("/api/v1/skills", { headers, data: { name: `Over quota ${token}`, category: "Other" } })).status()).toBe(429);
    const existing = await a.post("/api/v1/skills", { headers, data: { name: "  ＰＹＴＨＯＮ  ", category: "Other" } });
    expect(existing.status()).toBe(200); expect((await existing.json()).data.skill.name).toBe("Python");
    expect(localSql(`select count(*) from private.skill_submissions where user_id='${aid}';`)).toBe("10");
  } finally {
    if (bid) localSql(`update private.member_suspensions set suspended=false where user_id='${bid}';`);
    await Promise.all([a, b].map(cleanupBookings));
    await Promise.all([a, b].map(context => context.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [], wantedSkillIds: [] } })));
    for (const id of created) localSql(`update public.skills set enabled=false where id='${id}';`);
    await Promise.all([a, b, anonymous].map(context => context.dispose()));
  }
});

test("custom skill choices persist on a narrow phone; public and member screens fit responsive widths", async ({ page }) => {
  let customId = "";
  try {
    await page.setViewportSize({ width: 320, height: 740 });
    for (const route of ["/", "/login", "/signup"]) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator("body")).not.toContainText(/semester|college project|classroom demo/i);
      if (route === "/") await page.screenshot({ path: ".local/mobile-home.png", fullPage: true });
    }
    await signupAndConfirm(page.request, "custom-mobile");
    await page.request.patch("/api/v1/me/profile", { headers, data: profile("Mobile Member " + "x".repeat(40)) });
    await page.goto("/profile");
    await page.getByText("Can’t find your skill? Add a custom skill", { exact: true }).click();
    const name = "Needlework " + randomUUID().slice(0, 8);
    await page.getByLabel("Custom skill name").fill(name);
    await page.getByLabel("Skill category").selectOption("Creative");
    await page.getByLabel("Add to my list").selectOption("both");
    await page.getByRole("button", { name: "Add custom skill", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Save your skills");
    await page.getByLabel("Search skills").fill(name);
    for (const list of [/I can teach/, /I want to learn/]) await expect(page.getByRole("group", { name: list }).getByRole("checkbox", { name: new RegExp(name) })).toBeChecked();
    await page.getByRole("button", { name: "Save skills", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Your skills are saved");
    await page.reload();
    const selected = (await (await page.request.get("/api/v1/me/skills")).json()).data;
    customId = selected.offeredSkillIds[0]; expect(selected.wantedSkillIds).toEqual([customId]);
    await page.getByLabel("Search skills").fill(name);
    await expect(page.getByRole("group", { name: /I can teach/ }).getByRole("checkbox", { name: new RegExp(name) })).toBeChecked();
    await page.screenshot({ path: ".local/mobile-profile.png", fullPage: true });
    await page.locator("summary").filter({ hasText: "Menu" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile member navigation" });
    await expect(mobileNav.getByRole("link", { name: "Profile", exact: true })).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape"); await expect(mobileNav).toBeHidden();
    await expect(page.locator("summary").filter({ hasText: "Menu" })).toBeFocused();
    await page.keyboard.press("Enter"); await expect(mobileNav).toBeVisible();
    await mobileNav.getByRole("link", { name: "Wallet", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your wallet" })).toBeVisible();
    await expect(mobileNav).toBeHidden();
    await page.locator("summary").filter({ hasText: "Menu" }).click();
    await page.getByTestId("wallet-total").click(); await expect(mobileNav).toBeHidden();
    for (const width of [320, 360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ["/dashboard", "/profile", "/discover", "/bookings", "/wallet", "/community"]) {
        await page.goto(route);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}px`).toBe(true);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/dashboard");
    await page.screenshot({ path: ".local/mobile-dashboard.png" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: ".local/desktop-dashboard.png" });
  } finally {
    await page.request.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [], wantedSkillIds: [] } });
    if (customId) localSql(`update public.skills set enabled=false where id='${customId}';`);
  }
});
