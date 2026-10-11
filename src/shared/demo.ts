import { z } from 'zod';
export const demoPolicySchema=z.object({enabled:z.boolean(),durationMinutes:z.number().int().min(1).max(10),costUnits:z.union([z.literal(30),z.literal(60),z.literal(90),z.literal(120),z.literal(150),z.literal(180)]),version:z.number().int().positive()}).strict();
export type DemoPolicy=z.infer<typeof demoPolicySchema>;
