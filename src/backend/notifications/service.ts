import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/backend/supabase/database.types';
import {HttpError} from '@/backend/http';
import {inboxSchema} from '@/shared/notifications';
export async function notifications(client:SupabaseClient<Database>,actorId:string,query:{limit:number;cursor?:string}){
 let after:{at:string;id:string}|undefined;
 if(query.cursor)try{after=z.object({at:z.string().datetime({offset:true}),id:z.string().uuid(),actor:z.literal(actorId)}).strict().parse(JSON.parse(Buffer.from(query.cursor,'base64url').toString()));}catch{throw new HttpError(400,'VALIDATION_ERROR','Invalid notification page. Start again.');}
 const {data,error}=await client.rpc('read_my_notifications',{p_limit:query.limit+1,...(after?{p_before:after.at,p_before_id:after.id}:{})});
 if(error?.code==='P0001')throw new HttpError(403,'PROFILE_INCOMPLETE','Finish your profile first.');
 const parsed=inboxSchema.safeParse(data);if(error||!parsed.success)throw new HttpError(503,'DATABASE_UNAVAILABLE','Notifications are temporarily unavailable.');
 const items=parsed.data.items.slice(0,query.limit),last=items.at(-1);
 return {items,unreadCount:parsed.data.unreadCount,nextCursor:parsed.data.items.length>query.limit&&last?Buffer.from(JSON.stringify({at:last.created_at,id:last.id,actor:actorId})).toString('base64url'):null};
}
export async function markNotificationsRead(client:SupabaseClient<Database>,ids:string[]){const {error}=await client.rpc('mark_my_notifications_read',{p_ids:ids});if(error)throw new HttpError(503,'DATABASE_UNAVAILABLE','Could not mark notifications as read.');}
