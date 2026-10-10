import { describe, expect, it } from "vitest";
import { profileSchema, signupSchema, loginSchema, safeReturnPath } from "@/shared/validation";
const profile = { displayName: "Student", bio: "Hello", college: "College", timezone: "Asia/Kolkata" };
describe("profile input boundary", () => {
  it("accepts and trims valid profile fields", () => expect(profileSchema.parse({ ...profile, displayName: " Student " }).displayName).toBe("Student"));
  it("rejects a client-selected owner", () => expect(profileSchema.safeParse({ ...profile, id: "another-user" }).success).toBe(false));
  it("rejects writes to internal onboarding state", () => expect(profileSchema.safeParse({ ...profile, onboardedAt: "2026-01-01" }).success).toBe(false));
  it("rejects unknown timezone names", () => expect(profileSchema.safeParse({ ...profile, timezone: "Mars/City" }).success).toBe(false));
  it("rejects invalid names and excessive bios", () => {
    expect(profileSchema.safeParse({ ...profile, displayName: " " }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profile, bio: "x".repeat(501) }).success).toBe(false);
  });
});
describe("credentials", () => {
  it("requires a valid email and new password length", () => {
    expect(signupSchema.safeParse({ email: "invalid", password: "long-enough" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "student@example.test", password: "short" }).success).toBe(false);
  });
  it("does not trim passwords or enforce signup strength on login", () => expect(loginSchema.parse({ email: "student@example.test", password: " x " }).password).toBe(" x "));
  it("does not permit a supplied role", () => expect(signupSchema.safeParse({ email: "student@example.test", password: "valid-password", role: "admin" }).success).toBe(false));
});
describe("callback redirect boundary", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/dashboard?next=https://evil.example", "%2f%2fevil.example", undefined])("rejects unsafe destination %s", value => expect(safeReturnPath(value)).toBe("/dashboard"));
  it("allows implemented safe internal destinations", () => expect(safeReturnPath("/profile")).toBe("/profile"));
});
