import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, BookingRow, Json } from "@/backend/supabase/database.types";
import type { Booking, CreateBookingRequest, ErrorCode, Page } from "@/shared/contracts";
import { HttpError } from "@/backend/http";
import { utcInstantSchema } from "@/shared/validation";
type Client = SupabaseClient<Database>;
export type BookingQuery = { limit: number; cursor?: string; state?: string; role?: string };
const messages: Partial<Record<ErrorCode,string>> = {
 VALIDATION_ERROR: "Choose an offered skill, 30/60/90 minutes, and a start between 15 minutes and 30 days ahead.",
 SCHEDULE_CONFLICT: "One of you already has a request or session at that time. Choose another time.",
 IDEMPOTENCY_CONFLICT: "This request key was already used for different details. Start a new request.",
 NOT_FOUND: "Booking or member not found.", FORBIDDEN: "Only the teacher can accept or reject this request.",
 INVALID_STATE: "This action is no longer available. Refresh to see the current booking.", REQUEST_EXPIRED: "This request has expired. Choose a new time and request again.",
};
function outcome(data: Json | null, error: { code?: string } | null) {
 if (error?.code === "42501") throw new HttpError(403,"FORBIDDEN","A verified account is required.");
 if (error?.code === "P0001") throw new HttpError(403,"PROFILE_INCOMPLETE","Finish your profile before booking.");
 if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(503,"DATABASE_UNAVAILABLE","Booking storage is unavailable. Please try again.");
 const result = data as { error?: ErrorCode; booking?: BookingRow; items?: BookingRow[]; allowed_actions?: ("accept"|"reject"|"cancel")[] };
 if (result.error) {
  const code=result.error;
  const status=code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : code === "VALIDATION_ERROR" ? 400 : 409;
  throw new HttpError(status,code,messages[code] ?? "Could not update this booking.");
 }
 return result;
}
export function bookingDto(row: BookingRow): Booking {
 return { id: row.id,teacherId: row.teacher_id,learnerId: row.learner_id,skillId: row.skill_id,
  startsAt: new Date(row.starts_at).toISOString(),endsAt: new Date(row.ends_at).toISOString(),durationMinutes: row.duration_minutes,
  costUnits: row.cost_units,state: row.state,requestExpiresAt: new Date(row.request_expires_at).toISOString(),
  creditReservationStatus: row.credit_reservation_status,teacherConfirmed: false,learnerConfirmed: false,dispute: null,
  createdAt: new Date(row.created_at).toISOString(),updatedAt: new Date(row.updated_at).toISOString() };
}
export async function createBooking(client: Client,fields: CreateBookingRequest,key: string) {
 const {data,error}=await client.rpc("create_booking_request",{p_teacher_id:fields.teacherId,p_skill_id:fields.skillId,p_starts_at:fields.startsAt,p_duration:fields.durationMinutes,p_key:key});
 const result=outcome(data,error); if (!result.booking) throw new Error("Missing booking result"); return bookingDto(result.booking);
}
export async function getBooking(client: Client,id: string) {
 const {data,error}=await client.rpc("read_my_bookings",{p_id:id});
 const result=outcome(data,error); if (!result.booking) throw new Error("Missing booking result"); return bookingDto(result.booking);
}
export async function changeBooking(client: Client,id: string,action: string,key: string) {
 const {data,error}=await client.rpc("booking_action",{p_booking_id:id,p_action:action,p_key:key});
 const result=outcome(data,error); if (!result.booking) throw new Error("Missing booking result"); return bookingDto(result.booking);
}
export async function listBookings(client: Client,userId: string,query: BookingQuery): Promise<Page<Booking>> {
 const context=`${userId}:${query.state??"all"}:${query.role??"all"}`;
 let after: { start: string; id: string } | undefined;
 if (query.cursor) {
  try {
   if (!/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw Error();
   after=z.object({start:utcInstantSchema,id:z.string().uuid(),context:z.literal(context)}).strict().parse(JSON.parse(Buffer.from(query.cursor,"base64url").toString("utf8")));
  } catch { throw new HttpError(400,"VALIDATION_ERROR","Invalid booking page cursor. Start again from the first page."); }
 }
 const {data,error}=await client.rpc("read_my_bookings",{p_limit:query.limit+1,...(after?{p_after_start:after.start,p_after_id:after.id}:{}),...(query.state?{p_state:query.state}:{}),...(query.role?{p_role:query.role}:{})});
 const rows=outcome(data,error).items; if (!rows) throw new Error("Missing bookings result");
 const items=rows.slice(0,query.limit).map(bookingDto); const last=items.at(-1);
 return {items,nextCursor:rows.length>query.limit&&last?Buffer.from(JSON.stringify({start:last.startsAt,id:last.id,context})).toString("base64url"):null};
}

export async function bookingView(client: Client,id: string) {
 const {data,error}=await client.rpc("read_my_bookings",{p_id:id});
 const result=outcome(data,error);if(!result.booking)throw new Error("Missing booking result");
 return { booking: bookingDto(result.booking), actions: result.allowed_actions??[] };
}
