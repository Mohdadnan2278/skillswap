import { afterEach, expect, it, vi } from "vitest";
import { getSiteOrigin, getSupabaseConfig } from "@/backend/config";
afterEach(() => vi.unstubAllEnvs());
it("rejects provider secret keys as public config", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_do-not-expose");
  expect(getSupabaseConfig()).toBeNull();
});
it("rejects a legacy service-role JWT as public config", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", `header.${Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url")}.signature`);
  expect(getSupabaseConfig()).toBeNull();
});
it("rejects nonlocal insecure URLs and embedded credentials", () => {
  vi.stubEnv("SITE_URL", "http://skillswap.example"); expect(getSiteOrigin()).toBeNull();
  vi.stubEnv("SITE_URL", "https://user:password@skillswap.example"); expect(getSiteOrigin()).toBeNull();
});
it("accepts an exact local development origin and rejects redirect paths", () => {
  vi.stubEnv("SITE_URL", "http://127.0.0.1:3000"); expect(getSiteOrigin()).toBe("http://127.0.0.1:3000");
  vi.stubEnv("SITE_URL", "https://skillswap.example/redirect"); expect(getSiteOrigin()).toBeNull();
});
