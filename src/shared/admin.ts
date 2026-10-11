import {z} from 'zod';
export const adminSections=['overview','demo','members','skills','bookings','disputes','feedback','audit'] as const;
export const adminQuerySchema=z.object({section:z.enum(adminSections).default('overview'),page:z.coerce.number().int().min(0).max(4000).default(0),search:z.string().trim().max(100).default('')}).strict();
const reason=z.string().trim().min(10,'Give a reason of at least 10 characters.').max(500);
const target=z.string().uuid();
const actions=['suspend_member','restore_member','grant_admin','revoke_admin','enable_skill','disable_skill','hide_feedback','restore_feedback','review_dispute','cancel_stuck_booking'] as const;
export const adminCommandSchema=z.union([
 z.object({action:z.enum(actions),target,reason}).strict(),
 z.object({action:z.literal('create_skill'),reason,slug:z.string().min(2).max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),name:z.string().trim().min(2).max(80),category:z.string().trim().min(2).max(60)}).strict(),
 z.object({action:z.literal('configure_demo'),reason,enabled:z.boolean(),durationMinutes:z.number().int().min(1).max(10),costUnits:z.union([z.literal(30),z.literal(60),z.literal(90),z.literal(120),z.literal(150),z.literal(180)]),version:z.number().int().positive().max(999999999)}).strict(),
]);
export const adminDataSchema=z.object({rows:z.array(z.record(z.string(),z.unknown())).max(25),total:z.number().int().nonnegative(),counts:z.record(z.string(),z.number().int().nonnegative())});
export type AdminQuery=z.infer<typeof adminQuerySchema>;
export type AdminData=z.infer<typeof adminDataSchema>;
export type AdminCommand=z.infer<typeof adminCommandSchema>;
