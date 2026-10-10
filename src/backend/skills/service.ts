import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/backend/supabase/database.types";
import type { DiscoveryMatch, Page, Skill, SkillSelections } from "@/shared/contracts";
import { HttpError } from "@/backend/http";
import { z } from "zod";

type Client = SupabaseClient<Database>;
type Query = { limit: number; cursor?: string; skillId?: string };
const skillSchema = z.object({ id: z.string().uuid(), slug: z.string(), name: z.string(), category: z.string() });
const storageError = () => new HttpError(503, "DATABASE_UNAVAILABLE", "Skill storage is unavailable. Please try again shortly.");
function databaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "22023") throw new HttpError(400, "VALIDATION_ERROR", "Choose enabled catalogue skills. A discovery filter must be one of your wanted skills.");
  if (error.code === "P0001") throw new HttpError(403, "PROFILE_INCOMPLETE", "Finish your profile before choosing skills or discovering members.");
  if (error.code === "42501") throw new HttpError(403, "FORBIDDEN", "A verified account is required.");
  throw storageError();
}
function encodeCursor(kind: string, last: string, context: string) {
  return Buffer.from(JSON.stringify({ kind, last, context })).toString("base64url");
}
function decodeCursor(cursor: string | undefined, kind: string, context: string) {
  if (!cursor) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw Error();
    const value = z.object({ kind: z.literal(kind), last: kind === "catalogue" ? z.string().regex(/^[a-z0-9-]+$/).max(100) : z.string().uuid(), context: z.literal(context) }).strict().parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    return value.last;
  } catch { throw new HttpError(400, "VALIDATION_ERROR", "This page cursor is invalid for the selected filter. Start again from the first page."); }
}
export async function catalogue(client: Client, query: Query): Promise<Page<Skill>> {
  const after = decodeCursor(query.cursor, "catalogue", "enabled");
  let request = client.from("skills").select("id,slug,name,category").eq("enabled", true).order("slug").limit(query.limit + 1);
  if (after) request = request.gt("slug", after);
  const { data, error } = await request;
  if (error || !data) throw storageError();
  const items = data.slice(0, query.limit);
  return { items, nextCursor: data.length > query.limit ? encodeCursor("catalogue", items.at(-1)!.slug, "enabled") : null };
}
/** Load the entire bounded catalogue for the selection UI without silently truncating it. */
export async function allSkills(client: Client): Promise<Skill[]> {
  const items: Skill[] = [];
  let cursor: string | undefined;
  do {
    const page = await catalogue(client, { limit: 50, cursor });
    items.push(...page.items); cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}
export async function requireOnboarded(client: Client, userId: string) {
  const { data, error } = await client.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw storageError();
  if (!data) throw new HttpError(403, "PROFILE_INCOMPLETE", "Finish your profile before choosing skills or discovering members.");
}
export async function selections(client: Client, userId: string): Promise<SkillSelections> {
  const { data, error } = await client.from("user_skills").select("skill_id,direction").eq("user_id", userId).order("skill_id");
  if (error || !data) throw storageError();
  return { offeredSkillIds: data.filter(row => row.direction === "offered").map(row => row.skill_id), wantedSkillIds: data.filter(row => row.direction === "wanted").map(row => row.skill_id) };
}
export async function replaceSelections(client: Client, fields: SkillSelections) {
  const { error } = await client.rpc("replace_my_skills", { p_offered: fields.offeredSkillIds, p_wanted: fields.wantedSkillIds });
  databaseError(error);
  // Return the exact selection written by this transaction, avoiding a racing later read.
  return fields;
}
export async function discover(client: Client, userId: string, query: Query): Promise<Page<DiscoveryMatch>> {
  const context = `${userId}:${query.skillId ?? "all"}`;
  const after = decodeCursor(query.cursor, "discover", context);
  const { data, error } = await client.rpc("discover_members", { ...(after ? { p_after: after } : {}), ...(query.skillId ? { p_skill_id: query.skillId } : {}), p_limit: query.limit + 1 });
  databaseError(error);
  if (!data) throw storageError();
  const rows = data.slice(0, query.limit);
  const items = rows.map(row => ({ profile: { id: row.id, displayName: row.display_name, bio: row.bio, college: row.college, reputation: { averageRating: null, ratingCount: 0 } }, matchedSkills: z.array(skillSchema).parse(row.matched_skills) }));
  return { items, nextCursor: data.length > query.limit ? encodeCursor("discover", rows.at(-1)!.id, context) : null };
}
/** Reject repeated parameters rather than silently taking the last value. */
export function queryFields(url: URL) {
  const result: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (key in result) throw new HttpError(400, "VALIDATION_ERROR", "Query parameters must not be repeated.");
    result[key] = value;
  }
  return result;
}
