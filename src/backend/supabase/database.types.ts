/** Phase 3 schema types, aligned to 20261010160000_auth_profiles.sql.
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
      account_preferences: {
        Row: { user_id: string; timezone: string; updated_at: string };
        Insert: { user_id: string; timezone: string; updated_at?: string };
        Update: { timezone?: string };
        Relationships: [{ foreignKeyName: "account_preferences_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
    };
    Views: { [_ in never]: never };
    Functions: { save_my_profile: { Args: { p_display_name: string; p_bio: string; p_college: string; p_timezone: string }; Returns: undefined } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
