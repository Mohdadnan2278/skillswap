/** Shared DTOs. Phase 3–7 auth/profile/skills/discovery/scheduling APIs are implemented; later contracts remain design-only.
 * These types do not validate runtime input or authorize database access.
 */
export type UUID = string;
/** Validated ISO 8601 UTC instant ending in Z, not a local wall-clock time. */
export type UtcTimestamp = string;
/** Nonnegative safe integer minute units for balances/costs; 60 = 1 credit. */
export type CreditUnits = number;
export type DurationMinutes = 30 | 60 | 90;
export type BookingState =
  | "pending" | "accepted" | "rejected" | "cancelled"
  | "expired" | "completed" | "disputed";
export type SessionRole = "teacher" | "learner";
export type DisputeResolution = "complete" | "cancel";
export type Rating = 1 | 2 | 3 | 4 | 5;
export type ErrorCode =
  | "VALIDATION_ERROR" | "UNAUTHENTICATED" | "FORBIDDEN"
  | "EMAIL_UNVERIFIED" | "PROFILE_INCOMPLETE" | "NOT_FOUND"
  | "INVALID_STATE" | "SCHEDULE_CONFLICT" | "INSUFFICIENT_CREDITS"
  | "REQUEST_EXPIRED" | "ALREADY_REVIEWED" | "IDEMPOTENCY_CONFLICT"
  | "RATE_LIMITED" | "PROVIDER_UNAVAILABLE" | "INTERNAL_ERROR"
  | "INVALID_CREDENTIALS" | "CONFIGURATION_REQUIRED" | "DATABASE_UNAVAILABLE";

export interface ApiSuccess<T> { data: T }
export interface ApiFailure {
  error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export interface Page<T> { items: T[]; nextCursor: string | null }
export interface Reputation { averageRating: number | null; ratingCount: number }
export interface PublicProfile {
  id: UUID; displayName: string; bio: string; college: string;
  reputation: Reputation;
}
export interface CurrentUser {
  id: UUID; profile: PublicProfile | null; timezone: string; emailVerified: boolean;
}
export interface UpdateProfileRequest {
  displayName: string; bio: string; college: string; timezone: string;
}
export interface Skill { id: UUID; slug: string; name: string; category: string }
export interface SkillSelections { offeredSkillIds: UUID[]; wantedSkillIds: UUID[] }
export interface DiscoveryMatch { profile: PublicProfile; matchedSkills: Skill[] }
export interface CreateBookingRequest {
  teacherId: UUID; skillId: UUID; startsAt: UtcTimestamp;
  durationMinutes: DurationMinutes;
}
export interface BookingDispute {
  openedBy: UUID; reason: string; openedAt: UtcTimestamp;
  teacherResolution: DisputeResolution | null;
  learnerResolution: DisputeResolution | null;
  resolvedAt: UtcTimestamp | null;
}
export interface Booking {
  id: UUID; teacherId: UUID; learnerId: UUID; skillId: UUID;
  startsAt: UtcTimestamp; endsAt: UtcTimestamp; durationMinutes: DurationMinutes;
  state: BookingState; costUnits: CreditUnits; requestExpiresAt: UtcTimestamp;
  creditReservationStatus: "not_integrated" | "held" | "released" | "settled";
  teacherConfirmed: boolean; learnerConfirmed: boolean;
  dispute: BookingDispute | null;
  createdAt: UtcTimestamp; updatedAt: UtcTimestamp;
}
export interface DisputeRequest { reason: string }
export interface ResolveDisputeRequest { resolution: DisputeResolution }
export interface Wallet {
  settledUnits: CreditUnits; reservedUnits: CreditUnits; availableUnits: CreditUnits;
}
export interface Reservation {
  bookingId: UUID; units: CreditUnits; bookingState: BookingState;
  status: "held" | "released" | "settled";
  createdAt: UtcTimestamp; updatedAt: UtcTimestamp;
}
export interface LedgerEntry {
  id: UUID; eventId: UUID; kind: "starter_grant" | "session_transfer";
  bookingId: UUID | null;
  /** Signed safe integer units: positive receipt, negative payment. */
  deltaUnits: number;
  createdAt: UtcTimestamp;
}
export interface CreateFeedbackRequest { rating: Rating; comment?: string }
export interface Feedback {
  id: UUID; bookingId: UUID; reviewerId: UUID; revieweeId: UUID;
  rating: Rating; comment: string; createdAt: UtcTimestamp;
}
export interface LeaderboardEntry { profile: PublicProfile; rank: number }
/** Public Jitsi demo room. App checks do not enforce access on the public video provider. */
export interface MeetingAccess {
  provider: "jitsi_demo"; roomReference: string; serverOrigin: "https://meet.jit.si"; roomClosesAt: UtcTimestamp; serverNow: UtcTimestamp;
}

export type BookingAction = "accept" | "reject" | "cancel" | "confirm" | "dispute" | "resolve";
