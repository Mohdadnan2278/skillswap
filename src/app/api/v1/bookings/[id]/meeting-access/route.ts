import {apiHandler,requireConfiguration,requireSameOrigin,parseJson,success} from '@/backend/http';
import {verifiedSession} from '@/backend/auth/session';
import {meetingAccess} from '@/backend/meetings/service';
import {userIdSchema,emptySchema} from '@/shared/validation';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return apiHandler(async()=>{
 requireConfiguration();requireSameOrigin(request);const {client}=await verifiedSession(true);const {id}=await params;await parseJson(request,emptySchema);
 return success(await meetingAccess(client,userIdSchema.parse(id)));
});}
