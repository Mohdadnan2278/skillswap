import { test, expect } from "@playwright/test";
import { origin, signupAndConfirm, supabaseUrl, publishableKey, credentials } from "../helpers/local-auth";
import { createClient } from "@supabase/supabase-js";

test("two real accounts: confirmation, owner-only persistence, privacy, and logout", async ({ playwright }) => {
  const alice = await playwright.request.newContext({ baseURL: origin });
  const bob = await playwright.request.newContext({ baseURL: origin });
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  try {
    expect((await anonymous.get("/api/v1/me")).status()).toBe(401);
    const unauthenticatedPage = await anonymous.get("/dashboard", { maxRedirects: 0 });
    expect(unauthenticatedPage.status()).toBe(307);
    expect(unauthenticatedPage.headers().location).toContain("/login");
    const a = await signupAndConfirm(alice, "alice");
    const b = await signupAndConfirm(bob, "bob");
    const aMe = await alice.get("/api/v1/me");
    expect(aMe.status()).toBe(200);
    const aUser = (await aMe.json()).data;
    expect(aUser.profile).toBeNull();
    const bUser = (await (await bob.get("/api/v1/me")).json()).data;
    const onboarding = await alice.get("/dashboard", { maxRedirects: 0 });
    if (onboarding.headers().location) expect(onboarding.headers().location).toContain("/onboarding");
    else expect((await onboarding.text()).includes("NEXT_REDIRECT;replace;/onboarding;307;")).toBe(true);
    const aProfile = { displayName: "Alice Student", bio: "I enjoy music.", college: "Demo College", timezone: "Asia/Kolkata" };
    const bProfile = { displayName: "Bob Student", bio: "I enjoy coding.", college: "Demo College", timezone: "Europe/London" };
    expect((await alice.patch("/api/v1/me/profile", { data: aProfile, headers: { origin } })).status()).toBe(200);
    expect((await bob.patch("/api/v1/me/profile", { data: bProfile, headers: { origin } })).status()).toBe(200);
    const updated = await alice.patch("/api/v1/me/profile", { data: { ...aProfile, bio: "A saved new introduction." }, headers: { origin } });
    expect((await updated.json()).data.profile.bio).toBe("A saved new introduction.");
    expect((await (await bob.get("/api/v1/me")).json()).data.profile.bio).toBe(bProfile.bio);
    // The API rejects any attempt to choose an owner or internal eligibility state.
    expect((await alice.patch("/api/v1/me/profile", { data: { ...aProfile, id: bUser.id }, headers: { origin } })).status()).toBe(400);
    expect((await alice.patch("/api/v1/me/profile", { data: { ...aProfile, onboardedAt: "2020-01-01" }, headers: { origin } })).status()).toBe(400);
    expect((await alice.patch("/api/v1/me/profile", { data: { ...aProfile, timezone: "Mars/City" }, headers: { origin } })).status()).toBe(400);
    // Direct Data API writes cannot bypass the trusted profile function or grants.
    const attempted = await a.client.from("profiles").update({ bio: "hijacked" }).eq("id", bUser.id);
    expect(attempted.error?.code).toBe("42501");
    const attemptedOwner = await a.client.from("profiles").update({ onboarded_at: "2020-01-01" }).eq("id", aUser.id);
    expect(attemptedOwner.error?.code).toBe("42501");
    const otherPrefs = await a.client.from("account_preferences").select("*").eq("user_id", bUser.id);
    expect(otherPrefs.error).toBeNull(); expect(otherPrefs.data).toEqual([]);
    const invalidRpc = await a.client.rpc("save_my_profile", { p_display_name: "Changed Name", p_bio: "", p_college: "", p_timezone: "Mars/City" });
    expect(invalidRpc.error?.code).toBe("22023");
    expect((await (await alice.get("/api/v1/me")).json()).data.profile.bio).toBe("A saved new introduction.");
    const publicBob = (await (await alice.get(`/api/v1/profiles/${bUser.id}`)).json()).data;
    expect(publicBob.displayName).toBe(bProfile.displayName);
    expect(publicBob).not.toHaveProperty("timezone"); expect(publicBob).not.toHaveProperty("email");
    const dashboard = await alice.get("/dashboard");
    expect(dashboard.status()).toBe(200); expect((await dashboard.text()).replace(/<!--[\s\S]*?-->/g, "").includes("Welcome, Alice Student")).toBe(true);
    // Replayed confirmation links must fail without echoing tokens or arbitrary redirects.
    const replay = await anonymous.get(a.link, { maxRedirects: 0 });
    expect(replay.headers().location).toBe(`${origin}/login?notice=callback`);
    const badCallback = await anonymous.get("/auth/callback?next=https://evil.example", { maxRedirects: 0 });
    expect(badCallback.headers().location).toBe(`${origin}/login?notice=callback`);
    expect((await alice.patch("/api/v1/me/profile", { data: aProfile, headers: { origin: "https://evil.example" } })).status()).toBe(403);
    const logout = await alice.post("/api/auth/logout", { data: {}, headers: { origin } });
    expect(logout.status()).toBe(200);
    expect((await alice.get("/api/v1/me")).status()).toBe(401);
    // Other user's account remains signed in.
    expect((await bob.get("/api/v1/me")).status()).toBe(200);
    const login = await alice.post("/api/auth/login", { data: a.fields, headers: { origin } });
    expect(login.status()).toBe(200);
    expect((await (await alice.get("/api/v1/me")).json()).data.profile.bio).toBe("A saved new introduction.");
    await a.client.auth.signOut({ scope: "local" }); await b.client.auth.signOut({ scope: "local" });
  } finally { await alice.dispose(); await bob.dispose(); await anonymous.dispose(); }
});

test("invalid credentials, unconfirmed email, forged cookie, body limits, and anonymous RLS", async ({ playwright }) => {
  const context = await playwright.request.newContext({ baseURL: origin });
  try {
    const fields = credentials("unconfirmed");
    expect((await context.post("/api/auth/signup", { data: fields, headers: { origin } })).status()).toBe(201);
    const unconfirmed = await context.post("/api/auth/login", { data: fields, headers: { origin } });
    expect(unconfirmed.status()).toBe(403); expect((await unconfirmed.json()).error.code).toBe("EMAIL_UNVERIFIED");
    const invalid = await context.post("/api/auth/login", { data: { ...fields, password: "incorrect-password" }, headers: { origin } });
    expect(invalid.status()).toBe(401); expect((await invalid.json()).error.code).toBe("INVALID_CREDENTIALS");
    const oversized = await context.post("/api/auth/login", { data: { ...fields, password: "x".repeat(17_000) }, headers: { origin } });
    expect(oversized.status()).toBe(400);
    const forged = await context.get("/api/v1/me", { headers: { cookie: "sb-127-auth-token=base64-forged-cookie" } });
    expect(forged.status()).toBe(401);
    const forgedToken = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: "4be5c87c-b624-4437-b43a-7005c5b730d6", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), "invalid-signature"].join(".");
    const forgedSession = Buffer.from(JSON.stringify({ access_token: forgedToken, refresh_token: "forged-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: "4be5c87c-b624-4437-b43a-7005c5b730d6" } })).toString("base64url");
    expect((await context.get("/api/v1/me", { headers: { cookie: `sb-127-auth-token=base64-${forgedSession}` } })).status()).toBe(401);
    expect((await context.post("/api/auth/resend", { data: { email: "invalid" }, headers: { origin } })).status()).toBe(400);
    const anon = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
    const read = await anon.from("profiles").select("*");
    expect(read.error?.code).toBe("42501");
    const save = await anon.rpc("save_my_profile", { p_display_name: "Intruder", p_bio: "", p_college: "", p_timezone: "UTC" });
    expect(save.error?.code).toBe("42501");
  } finally { await context.dispose(); }
});
