import {apiHandler,requireConfiguration,success} from '@/backend/http';
import {verifiedSession} from '@/backend/auth/session';
import {receivedFeedback} from '@/backend/feedback/service';
import {queryFields} from '@/backend/skills/service';
import {userIdSchema,catalogueQuerySchema} from '@/shared/validation';
export async function GET(request:Request,{params}:{params:Promise<{userId:string}>}){return apiHandler(async()=>{
 requireConfiguration();const {client}=await verifiedSession(true);return success(await receivedFeedback(client,userIdSchema.parse((await params).userId),catalogueQuerySchema.parse(queryFields(new URL(request.url)))));
});}
