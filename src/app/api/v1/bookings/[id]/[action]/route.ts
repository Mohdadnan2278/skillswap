import { apiHandler,parseJson,requireConfiguration,requireSameOrigin,success,HttpError } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { changeBooking } from "@/backend/bookings/service";
import { bookingActionSchema,emptySchema,idempotencyKeySchema,userIdSchema } from "@/shared/validation";
export async function POST(request:Request,{params}:{params:Promise<{id:string;action:string}>}) { return apiHandler(async()=>{
 requireConfiguration(); requireSameOrigin(request); const {client}=await verifiedSession(true); const {id,action}=await params;
 if (!bookingActionSchema.safeParse(action).success) throw new HttpError(404,"NOT_FOUND","This booking action is not available.");
 const key=idempotencyKeySchema.parse(request.headers.get("idempotency-key")); await parseJson(request,emptySchema);
 return success(await changeBooking(client,userIdSchema.parse(id),action,key));
}); }
