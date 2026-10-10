import {apiHandler,requireConfiguration,success} from '@/backend/http';
import {verifiedSession} from '@/backend/auth/session';
import {leaderboard} from '@/backend/feedback/service';
import {queryFields} from '@/backend/skills/service';
import {catalogueQuerySchema} from '@/shared/validation';
export async function GET(request:Request){return apiHandler(async()=>{
 requireConfiguration();const {client}=await verifiedSession(true);return success(await leaderboard(client,catalogueQuerySchema.parse(queryFields(new URL(request.url)))));
});}
