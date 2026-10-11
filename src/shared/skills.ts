import { z } from "zod";

export const skillCategories = ["Programming", "Creative", "Music", "Communication", "Academic", "Productivity", "Languages", "Lifestyle", "Other"] as const;
export const customSkillSchema = z.object({
  name: z.string().max(200).transform(value => value.normalize("NFKC").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2, "Use at least 2 characters.").max(60, "Use at most 60 characters.")
      .refine(value => /[\p{L}\p{N}]/u.test(value) && !/[\p{Cc}<>]/u.test(value), "Enter a skill name using plain text.")),
  category: z.enum(skillCategories),
}).strict();
export const customSkillResultSchema = z.object({
  skill: z.object({ id: z.string().uuid(), slug: z.string(), name: z.string(), category: z.string() }),
  created: z.boolean(),
});
export type CustomSkillResult = z.infer<typeof customSkillResultSchema>;
