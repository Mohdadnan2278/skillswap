import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/backend/supabase/database.types';
import {HttpError} from '@/backend/http';
import {demoAccess,requireVideoConfiguration,type MeetingContext} from './jitsi';
const contextSchema=z.object({roomName:z.string().regex(/^skillswap-[0-9a-f]{32}$/).nullable(),actorId:z.string().uuid(),displayName:z.string().min(1).max(80),teacherId:z.string().uuid(),learnerId:z.string().uuid(),opensAt:z.string().datetime({offset:true}),closesAt:z.string().datetime({offset:true}),serverNow:z.string().datetime({offset:true})});
export async function meetingContext(client:SupabaseClient<Database>,id:string,consume=false):Promise<MeetingContext>{
 const {data,error}=await client.rpc('meeting_access_context',{p_booking_id:id,p_consume:consume});
 if(error?.code==='P0001')throw new HttpError(403,'PROFILE_INCOMPLETE','Finish your profile before joining.');
 if(error?.code==='42501')throw new HttpError(403,'EMAIL_UNVERIFIED','Confirm your email before joining.');
 if(error||!data||typeof data!=='object'||Array.isArray(data))throw new HttpError(503,'DATABASE_UNAVAILABLE','Video access checks are unavailable.');
 if(data.error==='NOT_FOUND')throw new HttpError(404,'NOT_FOUND','Booking not found.');
 if(data.error==='INVALID_STATE')throw new HttpError(409,'INVALID_STATE','Video is available for accepted funded bookings from 10 minutes before start until 15 minutes after end.');
 if(data.error==='RATE_LIMITED')throw new HttpError(429,'RATE_LIMITED','Please wait a minute before requesting video access again.');
 const context=contextSchema.safeParse(data);if(!context.success)throw new HttpError(503,'DATABASE_UNAVAILABLE','Could not safely read video access.');return context.data;
}
export async function meetingAccess(client:SupabaseClient<Database>,id:string){
 await meetingContext(client,id);requireVideoConfiguration();
 const context=await meetingContext(client,id,true);
 // No provider secret or synthetic join token: public Jitsi is explicitly a classroom demo.
 await meetingContext(client,id);return demoAccess(context);
}
