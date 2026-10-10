import { z } from "zod";

export const emailSchema = z.string().trim().email("Enter a valid email address.").max(254);
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.").max(128) }).strict();
export const signupSchema = loginSchema.extend({ password: z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters.") });
export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Use at least 2 characters.").max(60),
  bio: z.string().trim().max(500),
  college: z.string().trim().max(120),
  timezone: z.string().min(1).max(100).refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
    catch { return false; }
  }, "Choose a valid IANA timezone, for example Asia/Kolkata."),
}).strict();
export const resendSchema = z.object({ email: emailSchema }).strict();
export const emptySchema = z.object({}).strict();
export const userIdSchema = z.string().uuid();

/** Only implemented internal destinations are accepted; never trust a return URL. */
export function safeReturnPath(input: unknown): string {
  return typeof input === "string" && ["/dashboard", "/profile", "/onboarding"].includes(input) ? input : "/dashboard";
}
