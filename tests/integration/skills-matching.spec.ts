import { test, expect, type APIResponse, type APIRequestContext } from "@playwright/test";
import { signupAndConfirm, origin } from "../helpers/local-auth";
const python = "41000000-0000-4000-8000-000000000001";
const java = "41000000-0000-4000-8000-000000000003";
const sql = "41000000-0000-4000-8000-000000000004";
const unknown = "41000000-0000-4000-8000-000000999999";
const headers = { origin };
const profile = (name: string) => ({ displayName: name, bio: "Happy to share skills.", college: "SkillSwap College", timezone: "Asia/Kolkata" });
async function matchingPage(context: APIRequestContext, skillId?: string) {
  const items: { profile: { id: string; displayName: string }; matchedSkills: { id: string }[] }[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "50", ...(skillId ? { skillId } : {}), ...(cursor ? { cursor } : {}) });
    const response: APIResponse = await context.get(`/api/v1/discover?${query}`);
    expect(response.status()).toBe(200);
    const data: { items: typeof items; nextCursor: string | null } = (await response.json()).data;
    items.push(...data.items); cursor = data.nextCursor;
  } while (cursor);
  return { items };
}
test("atomic selections, owner permissions, explained matches and stable pagination", async ({ playwright }) => {
  const alice = await playwright.request.newContext({ baseURL: origin });
  const bob = await playwright.request.newContext({ baseURL: origin });
  const carol = await playwright.request.newContext({ baseURL: origin });
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  try {
    const a = await signupAndConfirm(alice, "skills-alice");
    const b = await signupAndConfirm(bob, "skills-bob");
    await signupAndConfirm(carol, "skills-carol");
    expect((await anonymous.get("/api/v1/skills")).status()).toBe(401);
    expect((await alice.get("/api/v1/discover")).status()).toBe(403);
    expect((await alice.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [], wantedSkillIds: [python] } })).status()).toBe(403);
    expect((await a.client.rpc("replace_my_skills", { p_offered: [], p_wanted: [python] })).error?.code).toBe("P0001");
    for (const [context, name] of [[alice, "Skills Alice"], [bob, "Skills Bob"], [carol, "Skills Carol"]] as const)
      expect((await context.patch("/api/v1/me/profile", { headers, data: profile(name) })).status()).toBe(200);
    const aliceId = (await (await alice.get("/api/v1/me")).json()).data.id;
    const bobId = (await (await bob.get("/api/v1/me")).json()).data.id;
    const carolId = (await (await carol.get("/api/v1/me")).json()).data.id;
    const first = (await (await alice.get("/api/v1/skills?limit=3")).json()).data;
    expect(first.items).toHaveLength(3); expect(first.nextCursor).toBeTruthy();
    const second = (await (await alice.get(`/api/v1/skills?limit=3&cursor=${first.nextCursor}`)).json()).data;
    expect(first.items.at(-1).slug < second.items[0].slug).toBe(true);
    const chosen = { offeredSkillIds: [python], wantedSkillIds: [python, sql] };
    expect((await alice.put("/api/v1/me/skills", { headers, data: chosen })).status()).toBe(200);
    expect((await bob.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [python, sql], wantedSkillIds: [] } })).status()).toBe(200);
    expect((await carol.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [java], wantedSkillIds: [] } })).status()).toBe(200);
    const matches = await matchingPage(alice);
    const bm = matches.items.find(item => item.profile.id === bobId)!;
    expect(bm.matchedSkills.map((skill: { id: string }) => skill.id)).toEqual([python, sql]);
    expect(matches.items.some(item => [aliceId, carolId].includes(item.profile.id))).toBe(false);
    expect(bm.profile).not.toHaveProperty("email"); expect(bm.profile).not.toHaveProperty("timezone");
    expect((await alice.put("/api/v1/me/skills", { headers, data: { ...chosen, userId: bobId } })).status()).toBe(400);
    expect((await a.client.from("user_skills").insert({ user_id: bobId, skill_id: java, direction: "offered" })).error?.code).toBe("42501");
    expect((await a.client.from("user_skills").delete().eq("user_id", bobId)).error?.code).toBe("42501");
    for (const wanted of [[python, python], [unknown], Array.from({ length: 21 }, (_, i) => `41000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`)]) {
      expect((await alice.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [], wantedSkillIds: wanted } })).status()).toBe(400);
      expect((await a.client.rpc("replace_my_skills", { p_offered: [], p_wanted: wanted })).error?.code).toBe("22023");
    }
    expect((await (await alice.get("/api/v1/me/skills")).json()).data).toEqual(chosen);
    expect((await (await bob.get("/api/v1/me/skills")).json()).data.offeredSkillIds).toEqual([python, sql]);
    expect((await alice.put("/api/v1/me/skills", { headers: { origin: "https://other.example" }, data: chosen })).status()).toBe(403);
    expect((await a.client.from("skills").update({ enabled: false }).eq("id", python)).error?.code).toBe("42501");
    expect((await b.client.rpc("discover_members", { p_skill_id: java })).error?.code).toBe("22023");
    expect((await carol.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [python], wantedSkillIds: [] } })).status()).toBe(200);
    const all = await matchingPage(alice, python);
    const ids = all.items.map((item: { profile: { id: string } }) => item.profile.id);
    expect(ids).toEqual([...ids].sort());
    const seen: string[] = []; let cursor: string | null = null; let firstCursor = "";
    do {
      const response: APIResponse = await alice.get(`/api/v1/discover?limit=1&skillId=${python}${cursor ? `&cursor=${cursor}` : ""}`);
      expect(response.status()).toBe(200); const data: { items: { profile: { id: string } }[]; nextCursor: string | null } = (await response.json()).data;
      seen.push(...data.items.map((item: { profile: { id: string } }) => item.profile.id));
      cursor = data.nextCursor; if (!firstCursor && cursor) firstCursor = cursor;
    } while (cursor);
    expect(seen).toEqual(ids); expect(new Set(seen).size).toBe(seen.length);
    expect(firstCursor).toBeTruthy();
    for (const query of ["limit=51", "limit=0", "cursor=bad", "limit=2&limit=3", "extra=1", `skillId=${java}`, `skillId=${sql}&cursor=${firstCursor}`])
      expect((await alice.get(`/api/v1/discover?${query}`)).status()).toBe(400);
    expect((await bob.get(`/api/v1/discover?cursor=${firstCursor}&skillId=${python}`)).status()).toBe(400);
    // Both simultaneous replacements succeed, but the final state is one complete set.
    const alternatives = [{ offeredSkillIds: [java], wantedSkillIds: [sql] }, { offeredSkillIds: [], wantedSkillIds: [] }];
    const writes = await Promise.all(alternatives.map(fields => a.client.rpc("replace_my_skills", { p_offered: fields.offeredSkillIds, p_wanted: fields.wantedSkillIds })));
    writes.forEach(result => expect(result.error).toBeNull());
    expect(alternatives).toContainEqual((await (await alice.get("/api/v1/me/skills")).json()).data);
    expect((await alice.put("/api/v1/me/skills", { headers, data: alternatives[1] })).status()).toBe(200);
    expect((await (await alice.get("/api/v1/discover")).json()).data.items).toEqual([]);
  } finally {
    await Promise.all([alice, bob, carol].map(context => context.put("/api/v1/me/skills", { headers, data: { offeredSkillIds: [], wantedSkillIds: [] } })));
    await Promise.all([alice.dispose(), bob.dispose(), carol.dispose(), anonymous.dispose()]);
  }
});

