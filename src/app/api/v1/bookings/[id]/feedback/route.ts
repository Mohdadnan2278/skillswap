import {apiHandler,requireConfiguration,requireSameOrigin,parseJson,success} from '@/backend/http';
import {verifiedSession} from '@/backend/auth/session';
import {createFeedback} from '@/backend/feedback/service';
import {userIdSchema,feedbackSchema,idempotencyKeySchema} from '@/shared/validation';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return apiHandler(async()=>{
 requireConfiguration();requireSameOrigin(request);const {client}=await verifiedSession(true);const id=userIdSchema.parse((await params).id),key=idempotencyKeySchema.parse(request.headers.get('Idempotency-Key'));const fields=await parseJson(request,feedbackSchema);
 return success(await createFeedback(client,id,fields,key),201);
});}
