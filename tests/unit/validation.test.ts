import { describe, expect, it } from "vitest";
import { profileSchema, signupSchema, loginSchema, safeReturnPath, createBookingSchema } from "@/shared/validation";
const profile = { displayName: "Student", bio: "Hello", college: "College", timezone: "Asia/Kolkata" };
describe("quick-call input boundary", () => {
  const fields = { teacherId: "41000000-0000-4000-8000-000000000001", skillId: "41000000-0000-4000-8000-000000000004", durationMinutes: 30 };
  it("allows explicit immediate requests and retains existing scheduled clients", () => {
    expect(createBookingSchema.safeParse({ ...fields, startMode: "now" }).success).toBe(true);
    expect(createBookingSchema.safeParse({ ...fields, startsAt: "2026-10-12T12:00:00Z" }).success).toBe(true);
  });
  it("rejects ambiguous timing, missing scheduling input and client-controlled duration or cost", () => {
    for (const extra of [{}, { startsAt: null }, { startMode: "now", startsAt: "2026-10-12T12:00:00Z" }, { startMode: "scheduled" }, { startMode: "now", costUnits: 1 }, { startMode: "now", durationMinutes: 1 }]) {
      expect(createBookingSchema.safeParse({ ...fields, ...extra }).success).toBe(false);
    }
  });
});
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
