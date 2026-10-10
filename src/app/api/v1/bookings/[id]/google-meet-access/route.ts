import {apiHandler,requireConfiguration,requireSameOrigin,parseJson,success} from '@/backend/http';
import {verifiedSession} from '@/backend/auth/session';
import {googleMeetLink} from '@/backend/meetings/google-meet';
import {userIdSchema,emptySchema} from '@/shared/validation';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return apiHandler(async()=>{
 requireConfiguration();requireSameOrigin(request);const {client}=await verifiedSession(true);await parseJson(request,emptySchema);
 return success(await googleMeetLink(client,userIdSchema.parse((await params).id),{join:true}));
});}
