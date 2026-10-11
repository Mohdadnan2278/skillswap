import {z} from 'zod';
export const availabilitySchema=z.object({minutes:z.union([z.literal(0),z.literal(15),z.literal(30),z.literal(60)])}).strict();
export const availabilityResultSchema=z.object({availableUntil:z.string().datetime({offset:true}).nullable(),serverNow:z.string().datetime({offset:true})});
export type Availability=z.infer<typeof availabilityResultSchema>;
