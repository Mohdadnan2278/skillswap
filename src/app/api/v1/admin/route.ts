import {apiHandler,requireConfiguration,requireSameOrigin,parseJson,success} from '@/backend/http';
import {requireAdmin,readAdmin,manageAdmin} from '@/backend/admin/service';
import {adminQuerySchema,adminCommandSchema} from '@/shared/admin';
import {idempotencyKeySchema} from '@/shared/validation';
export async function GET(request:Request){return apiHandler(async()=>{
 requireConfiguration();const {client}=await requireAdmin();const q=adminQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));return success(await readAdmin(client,q));
});}
export async function POST(request:Request){return apiHandler(async()=>{
 requireConfiguration();requireSameOrigin(request);const {client}=await requireAdmin(true);const body=await parseJson(request,adminCommandSchema);const key=idempotencyKeySchema.parse(request.headers.get('Idempotency-Key'));return success(await manageAdmin(client,body,key));
});}
