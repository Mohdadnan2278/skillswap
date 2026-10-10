/** Phase 3–4 schema types, aligned to the versioned migrations.
 * Regenerate using Supabase gen types after authorized migration changes.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; bio: string; college: string; onboarded_at: string; created_at: string; updated_at: string };
        Insert: { id: string; display_name: string; bio?: string; college?: string; onboarded_at?: string; created_at?: string; updated_at?: string };
        Update: { display_name?: string; bio?: string; college?: string };
        Relationships: [];
      };
      skills: {
        Row: { id: string; slug: string; name: string; category: string; enabled: boolean };
        Insert: { id: string; slug: string; name: string; category: string; enabled?: boolean };
        Update: { enabled?: boolean };
        Relationships: [];
      };
      user_skills: {
        Row: { user_id: string; skill_id: string; direction: string };
        Insert: { user_id: string; skill_id: string; direction: string };
        Update: { skill_id?: string; direction?: string };
        Relationships: [];
      };
      account_preferences: {
        Row: { user_id: string; timezone: string; updated_at: string };
        Insert: { user_id: string; timezone: string; updated_at?: string };
        Update: { timezone?: string };
        Relationships: [{ foreignKeyName: "account_preferences_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      replace_my_skills: { Args: { p_offered: string[]; p_wanted: string[] }; Returns: undefined };
      discover_members: { Args: { p_after?: string; p_skill_id?: string; p_limit?: number }; Returns: { id: string; display_name: string; bio: string; college: string; matched_skills: Json }[] };
      save_my_profile: { Args: { p_display_name: string; p_bio: string; p_college: string; p_timezone: string }; Returns: undefined } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
