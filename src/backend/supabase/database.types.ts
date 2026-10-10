/** Phase 3–7 schema types, aligned to the versioned migrations.
 * Regenerate using Supabase gen types after authorized migration changes.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type BookingRow = {
 id: string; teacher_id: string; learner_id: string; skill_id: string;
 starts_at: string; ends_at: string; duration_minutes: 30 | 60 | 90;
 cost_units: number; state: "pending" | "accepted" | "rejected" | "cancelled" | "expired" | "completed" | "disputed";
 request_expires_at: string; credit_reservation_status: "not_integrated" | "held" | "released" | "settled";
 teacher_confirmed?: boolean; learner_confirmed?: boolean; dispute?: import("@/shared/contracts").BookingDispute | null;
 created_at: string; updated_at: string;
}
export interface Database {
  public: {
    Tables: {
      wallets: { Row: { user_id: string; settled_units: number; reserved_units: number }; Insert: { user_id: string; settled_units?: number; reserved_units?: number }; Update: { settled_units?: number; reserved_units?: number }; Relationships: [] };
      reservations: { Row: { booking_id: string; learner_id: string; units: number; status: string; created_at: string; updated_at: string }; Insert: { booking_id: string; learner_id: string; units: number; status: string }; Update: { status?: string }; Relationships: [] };
      ledger_entries: { Row: { id: string; event_id: string; user_id: string | null; delta_units: number; created_at: string }; Insert: { event_id: string; user_id?: string; delta_units: number }; Update: { delta_units?: number }; Relationships: [] };
      booking_confirmations: { Row: { booking_id: string; user_id: string; confirmed_at: string }; Insert: { booking_id: string; user_id: string }; Update: { confirmed_at?: string }; Relationships: [] };
      booking_disputes: { Row: { booking_id: string; opened_by: string; reason: string; opened_at: string; resolved_at: string | null }; Insert: { booking_id: string; opened_by: string; reason: string }; Update: { reason?: string }; Relationships: [] };
      booking_dispute_votes: { Row: { booking_id: string; user_id: string; resolution: string; updated_at: string }; Insert: { booking_id: string; user_id: string; resolution: string }; Update: { resolution?: string }; Relationships: [] };
      bookings: { Row: BookingRow; Insert: Partial<BookingRow>; Update: Partial<BookingRow>; Relationships: [] };
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
      meeting_access_context: { Args: { p_booking_id: string; p_consume?: boolean }; Returns: Json };
      booking_financial_action: { Args: { p_booking_id: string; p_action: string; p_key: string; p_reason?: string; p_resolution?: string }; Returns: Json };
      read_my_wallet: { Args: { p_kind?: string; p_limit?: number; p_after_created?: string; p_after_id?: string }; Returns: Json };
      create_booking_request: { Args: { p_teacher_id: string; p_skill_id: string; p_starts_at: string; p_duration: number; p_key: string }; Returns: Json };
      booking_action: { Args: { p_booking_id: string; p_action: string; p_key: string }; Returns: Json };
      read_my_bookings: { Args: { p_id?: string; p_after_start?: string; p_after_id?: string; p_state?: string; p_role?: string; p_limit?: number }; Returns: Json };
      replace_my_skills: { Args: { p_offered: string[]; p_wanted: string[] }; Returns: undefined };
      discover_members: { Args: { p_after?: string; p_skill_id?: string; p_limit?: number }; Returns: { id: string; display_name: string; bio: string; college: string; matched_skills: Json }[] };
      save_my_profile: { Args: { p_display_name: string; p_bio: string; p_college: string; p_timezone: string }; Returns: undefined } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
