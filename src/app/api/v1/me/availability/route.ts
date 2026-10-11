import {verifiedSession} from '@/backend/auth/session';
import {apiHandler,requireConfiguration,requireSameOrigin,parseJson,success} from '@/backend/http';
import {readAvailability,setAvailability} from '@/backend/availability/service';
import {availabilitySchema} from '@/shared/availability';
export async function GET(){return apiHandler(async()=>{requireConfiguration();const {client,user}=await verifiedSession(true);return success(await readAvailability(client,user.id));});}
export async function PUT(request:Request){return apiHandler(async()=>{requireConfiguration();requireSameOrigin(request);const {client}=await verifiedSession(true);const fields=await parseJson(request,availabilitySchema);return success(await setAvailability(client,fields.minutes));});}
