import {apiHandler,requireConfiguration,requireSameOrigin,parseJson,success} from '@/backend/http';
import {verifiedSession} from '@/backend/auth/session';
import {googleMeetLink} from '@/backend/meetings/google-meet';
import {userIdSchema,googleMeetLinkSchema} from '@/shared/validation';
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){return apiHandler(async()=>{
 requireConfiguration();const {client}=await verifiedSession(true);return success(await googleMeetLink(client,userIdSchema.parse((await params).id)));
});}
export async function PUT(request:Request,{params}:Context){return apiHandler(async()=>{
 requireConfiguration();requireSameOrigin(request);const {client}=await verifiedSession(true);const fields=await parseJson(request,googleMeetLinkSchema);
 return success(await googleMeetLink(client,userIdSchema.parse((await params).id),{write:true,url:fields.url}));
});}
