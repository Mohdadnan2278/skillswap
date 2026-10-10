import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/backend/supabase/database.types";
import type { CurrentUser, PublicProfile, UpdateProfileRequest } from "@/shared/contracts";
import { HttpError } from "@/backend/http";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export function publicProfile(row: ProfileRow): PublicProfile {
  return { id: row.id, displayName: row.display_name, bio: row.bio, college: row.college,
    // Phase 8 has not introduced ratings; null explicitly means no rating is available.
    reputation: { averageRating: null, ratingCount: 0 } };
}
export async function getCurrentUser(client: SupabaseClient<Database>, user: User): Promise<CurrentUser> {
  const [profile, preferences] = await Promise.all([
    client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    client.from("account_preferences").select("timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profile.error || preferences.error) throw new HttpError(503, "DATABASE_UNAVAILABLE", "Profile storage is unavailable. Check the database migration or try again shortly.");
  return { id: user.id, profile: profile.data ? publicProfile(profile.data) : null,
    timezone: preferences.data?.timezone ?? "UTC", emailVerified: Boolean(user.email_confirmed_at) };
}
export async function saveProfile(client: SupabaseClient<Database>, fields: UpdateProfileRequest) {
  const { error } = await client.rpc("save_my_profile", { p_display_name: fields.displayName, p_bio: fields.bio, p_college: fields.college, p_timezone: fields.timezone });
  if (error?.code === "22023") throw new HttpError(400, "VALIDATION_ERROR", "Check your profile fields and timezone.");
  if (error?.code === "42501") throw new HttpError(403, "FORBIDDEN", "A verified account is required to save a profile.");
  if (error) throw new HttpError(503, "DATABASE_UNAVAILABLE", "Could not save your profile. Check the database migration or try again shortly.");
}
