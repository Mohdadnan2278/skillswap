import { apiHandler,requireConfiguration,success } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { getBooking } from "@/backend/bookings/service";
import { userIdSchema } from "@/shared/validation";
export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) { return apiHandler(async()=>{
 requireConfiguration(); const {client}=await verifiedSession(true); const {id}=await params;
 return success(await getBooking(client,userIdSchema.parse(id)));
}); }
