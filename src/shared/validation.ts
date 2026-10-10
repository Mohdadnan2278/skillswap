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

const skillIds = z.array(z.string().uuid()).max(20).refine(ids => new Set(ids).size === ids.length, "Choose each skill only once.");
export const skillSelectionsSchema = z.object({ offeredSkillIds: skillIds, wantedSkillIds: skillIds }).strict();
export const catalogueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).optional(),
}).strict();
export const discoveryQuerySchema = catalogueQuerySchema.extend({ skillId: z.string().uuid().optional() });

export const utcInstantSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/, "Send a UTC timestamp ending in Z.").refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,19) === value.slice(0,19), "Choose a valid date and time.");
export const createBookingSchema = z.object({ teacherId: z.string().uuid(), skillId: z.string().uuid(), startsAt: utcInstantSchema, durationMinutes: z.union([z.literal(30),z.literal(60),z.literal(90)]) }).strict();
export const bookingStateSchema = z.enum(["pending","accepted","rejected","cancelled","expired","completed","disputed"]);
export const bookingQuerySchema = catalogueQuerySchema.extend({ state: bookingStateSchema.optional(), role: z.enum(["teacher","learner"]).optional() });
export const bookingActionSchema = z.enum(["accept","reject","cancel"]);
export const idempotencyKeySchema = z.string().uuid("A valid Idempotency-Key header is required.");

export const financialActionSchema = z.enum(["confirm","dispute","resolve"]);
export const disputeSchema = z.object({ reason: z.string().trim().min(10).max(500) }).strict();
export const resolutionSchema = z.object({ resolution: z.enum(["complete","cancel"]) }).strict();

export const databaseInstantSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/).refine(value=>!Number.isNaN(Date.parse(value)));

export const googleMeetUrlSchema = z.string().length(36).regex(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/, "Use a Google Meet link like https://meet.google.com/abc-defg-hij without extra parameters.");
export const googleMeetLinkSchema = z.object({url: googleMeetUrlSchema.nullable()}).strict();
export const feedbackSchema = z.object({rating:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)]),comment:z.string().trim().max(500).default('')}).strict();
