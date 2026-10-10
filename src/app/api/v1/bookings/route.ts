import { apiHandler, parseJson, requireConfiguration, requireSameOrigin, success } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { createBooking, listBookings } from "@/backend/bookings/service";
import { queryFields } from "@/backend/skills/service";
import { bookingQuerySchema, createBookingSchema, idempotencyKeySchema } from "@/shared/validation";
export async function GET(request: Request) { return apiHandler(async()=>{
 requireConfiguration(); const {client,user}=await verifiedSession(true);
 return success(await listBookings(client,user.id,bookingQuerySchema.parse(queryFields(new URL(request.url)))));
}); }
export async function POST(request: Request) { return apiHandler(async()=>{
 requireConfiguration(); requireSameOrigin(request); const {client}=await verifiedSession(true);
 const key=idempotencyKeySchema.parse(request.headers.get("idempotency-key"));
 const fields=await parseJson(request,createBookingSchema);
 return success(await createBooking(client,fields,key),201);
}); }
