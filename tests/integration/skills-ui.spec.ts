import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { signupAndConfirm, origin } from "../helpers/local-auth";
const guitar = "41000000-0000-4000-8000-000000000008";
const headers = { origin };
const profile = (name: string) => ({ displayName: name, bio: "Happy to share skills.", college: "SkillSwap College", timezone: "Asia/Kolkata" });
test("mobile skill selection persists and discovery links to a safe member profile", async ({ page, playwright }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const teacherName = `Mobile Teacher ${randomUUID().slice(0, 8)}`;
  const teacher = await playwright.request.newContext({ baseURL: origin });
  try {
    await signupAndConfirm(teacher, "mobile-teacher");
    await teacher.patch("/api/v1/me/profile", { headers, data: profile(teacherName) });
    await teacher.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [guitar], wantedSkillIds: [] } });
    await signupAndConfirm(page.request, "mobile-learner");
    await page.request.patch("/api/v1/me/profile", { headers, data: profile("Mobile Learner") });
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "What would you like to learn?" })).toBeVisible();
    await page.getByRole("link", { name: "Choose skills" }).click();
    await page.getByRole("group", { name: /I want to learn/ }).getByRole("checkbox", { name: /Guitar/ }).check();
    await page.getByRole("button", { name: "Save skills", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Your skills are saved");
    await page.reload();
    await expect(page.getByRole("group", { name: /I want to learn/ }).getByRole("checkbox", { name: /Guitar/ })).toBeChecked();
    await page.getByRole("link", { name: "Discover members", exact: true }).click();
    await page.getByLabel("Wanted skill").selectOption(guitar);
    await page.getByRole("button", { name: "Apply filter" }).click();
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: teacherName, exact: true }) });
    await expect(card).toContainText("Can help you learn: Guitar");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await card.getByRole("link").click();
    await expect(page.getByRole("heading", { name: teacherName, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Can teach" })).toBeVisible();
    await expect(page.getByText("No ratings yet.", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/people/41000000-0000-4000-8000-999999999999");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  } finally {
    await Promise.all([teacher, page.request].map(context => context.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [], wantedSkillIds: [] } })));
    await teacher.dispose();
  }
});
