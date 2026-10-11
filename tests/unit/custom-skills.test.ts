import { describe, expect, it } from "vitest";
import { customSkillSchema } from "@/shared/skills";

describe("custom skill input", () => {
  it("normalizes spacing and compatibility characters without losing international names", () => {
    expect(customSkillSchema.parse({ name: "  Ｐｙｔｈｏｎ   basics  ", category: "Programming" }).name).toBe("Python basics");
    for (const name of ["C++", "C#", "മലയാളം", "हिन्दी", "日本語", "Baking & pastry"])
      expect(customSkillSchema.safeParse({ name, category: "Other" }).success).toBe(true);
  });
  it("rejects empty, oversized, control/markup-only names and client-owned catalogue fields", () => {
    for (const name of [" ", "a", "-+", "a".repeat(61), "<script>", "ab\u0000cd"])
      expect(customSkillSchema.safeParse({ name, category: "Other" }).success).toBe(false);
    expect(customSkillSchema.safeParse({ name: "Baking", category: "invented category" }).success).toBe(false);
    expect(customSkillSchema.safeParse({ name: "Baking", category: "Other", enabled: true }).success).toBe(false);
  });
});
