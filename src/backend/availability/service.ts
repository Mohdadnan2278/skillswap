import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/backend/supabase/database.types';
import {HttpError} from '@/backend/http';
import {availabilityResultSchema} from '@/shared/availability';
export async function readAvailability(client:SupabaseClient<Database>,id:string){
 const {data,error}=await client.from('member_availability').select('available_until').eq('user_id',id).maybeSingle();
 if(error)throw new HttpError(503,'DATABASE_UNAVAILABLE','Availability is temporarily unavailable.');
 return {availableUntil:data?.available_until??null,serverNow:new Date().toISOString()};
}
export async function setAvailability(client:SupabaseClient<Database>,minutes:number){
 const {data,error}=await client.rpc('set_my_availability',{p_minutes:minutes});
 if(error?.code==='P0001')throw new HttpError(403,'PROFILE_INCOMPLETE','Finish your profile first.');
 if(error?.code==='42501')throw new HttpError(403,'FORBIDDEN','An active account is required.');
 const parsed=availabilityResultSchema.safeParse(data);
 if(error||!parsed.success)throw new HttpError(503,'DATABASE_UNAVAILABLE','Could not update availability.');
 return parsed.data;
}
