import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/backend/supabase/database.types';
import {HttpError} from '@/backend/http';
import {googleMeetUrlSchema} from '@/shared/validation';
const linkSchema=z.object({url:googleMeetUrlSchema.nullable(),canEdit:z.boolean(),serverNow:z.string().datetime({offset:true}),closesAt:z.string().datetime({offset:true})});
export async function googleMeetLink(client:SupabaseClient<Database>,id:string,options:{write?:boolean;url?:string|null;join?:boolean}={}){
 const {data,error}=await client.rpc('booking_meet_link',{p_booking_id:id,p_write:options.write??false,p_url:options.url??null,p_join:options.join??false});
 if(error?.code==='P0001')throw new HttpError(403,'PROFILE_INCOMPLETE','Finish your profile first.');
 if(error?.code==='42501')throw new HttpError(403,'EMAIL_UNVERIFIED','Confirm your email first.');
 if(error||!data||typeof data!=='object'||Array.isArray(data))throw new HttpError(503,'DATABASE_UNAVAILABLE','Google Meet settings are unavailable.');
 if(data.error==='NOT_FOUND')throw new HttpError(404,'NOT_FOUND','Booking not found.');
 if(data.error==='FORBIDDEN')throw new HttpError(403,'FORBIDDEN','Only the teacher can change the Meet link.');
 if(data.error==='VALIDATION_ERROR')throw new HttpError(400,'VALIDATION_ERROR','Use a standard Google Meet link.');
 if(data.error==='INVALID_STATE')throw new HttpError(409,'INVALID_STATE','Google Meet requires an accepted funded booking and a saved link. Join from 10 minutes before start until 15 minutes after end.');
 const result=linkSchema.safeParse(data);if(!result.success)throw new HttpError(503,'DATABASE_UNAVAILABLE','Could not safely read the Meet link.');return result.data;
}
