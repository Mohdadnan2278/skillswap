import { expect, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
export const origin = process.env.SITE_URL!;
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
if (!supabaseUrl || !["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname)) throw new Error("Tests require local Supabase; they must not create hosted accounts.");
export const mailpitUrl = process.env.TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";
if (!["127.0.0.1", "localhost"].includes(new URL(mailpitUrl).hostname)) throw new Error("Tests require a local mail inbox.");
export function credentials(label: string) { return { email: `skillswap-${label.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0,30)}-${randomUUID()}@example.test`, password: `Aa1!${randomUUID()}` }; }
export async function confirmationLink(email: string) {
  let id: string | undefined;
  await expect.poll(async () => {
    const response = await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (!response.ok) return false;
    const data = await response.json();
    id = data.messages?.[0]?.ID;
    return Boolean(id);
  }, { timeout: 20_000, message: "Local confirmation email should arrive" }).toBe(true);
  const response = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
  const message = await response.json();
  const content = String(message.HTML ?? message.Text ?? "").replaceAll("&amp;", "&");
  const match = content.match(/https?:\/\/[^"\s<>]+\/auth\/confirm\?[^"\s<>]+/);
  if (!match) throw new Error("Local confirmation email did not contain the app verification link");
  const url = new URL(match[0]);
  if (url.origin !== origin) throw new Error("Local email callback origin does not match SITE_URL");
  return url.pathname + url.search;
}
export async function signupAndConfirm(context: APIRequestContext, label: string) {
  const fields = credentials(label);
  const signup = await context.post("/api/auth/signup", { data: fields, headers: { origin } });
  expect(signup.status()).toBe(201);
  expect((await signup.json()).data.verificationRequired).toBe(true);
  const link = await confirmationLink(fields.email);
  const result = await context.get(link, { maxRedirects: 0 });
  expect(result.status()).toBe(307);
  expect(result.headers().location).toBe(`${origin}/dashboard`);
  const client = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword(fields);
  expect(error).toBeNull();
  return { fields, client, link };
}
