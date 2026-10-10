import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/backend/supabase/database.types';
import type {CreateFeedbackRequest,Feedback,LeaderboardEntry,Page,Reputation} from '@/shared/contracts';
import {HttpError} from '@/backend/http';
import {feedbackSchema} from '@/shared/validation';
type Client=SupabaseClient<Database>;
type Query={limit:number;cursor?:string};
const unavailable=()=>new HttpError(503,'DATABASE_UNAVAILABLE','Feedback storage is unavailable. Please try again shortly.');
const rowSchema=z.object({id:z.string().uuid(),booking_id:z.string().uuid(),reviewer_id:z.string().uuid(),reviewee_id:z.string().uuid(),rating:feedbackSchema.shape.rating,comment:z.string().max(500),created_at:z.string().datetime({offset:true})});
function feedback(raw:unknown):Feedback{const r=rowSchema.safeParse(raw);if(!r.success)throw unavailable();const v=r.data;return {id:v.id,bookingId:v.booking_id,reviewerId:v.reviewer_id,revieweeId:v.reviewee_id,rating:v.rating,comment:v.comment,createdAt:new Date(v.created_at).toISOString()};}
export async function reputations(client:Client,ids:string[]):Promise<Map<string,Reputation>>{
 if(!ids.length)return new Map();const {data,error}=await client.from('profile_reputation').select('*').in('user_id',ids);if(error||!data)throw unavailable();return new Map(data.map(row=>[row.user_id,{averageRating:row.average_rating,ratingCount:row.rating_count}]));
}
export async function createFeedback(client:Client,id:string,fields:CreateFeedbackRequest,key:string){
 const {data,error}=await client.rpc('create_feedback',{p_booking_id:id,p_rating:fields.rating,p_comment:fields.comment??'',p_key:key});
 if(error?.code==='42501')throw new HttpError(403,'EMAIL_UNVERIFIED','Confirm your email before reviewing.');
 if(error?.code==='P0001')throw new HttpError(403,'PROFILE_INCOMPLETE','Finish your profile first.');
 if(error||!data||typeof data!=='object'||Array.isArray(data))throw unavailable();
 const code=data.error;switch(code){
 case 'NOT_FOUND':throw new HttpError(404,code,'Booking not found.');
 case 'INVALID_STATE':throw new HttpError(409,code,'Feedback is available after both participants complete and settle this booking.');
 case 'ALREADY_REVIEWED':throw new HttpError(409,code,'You have already reviewed this booking. Reviews cannot be changed.');
 case 'IDEMPOTENCY_CONFLICT':throw new HttpError(409,code,'This submission key was already used with different feedback.');
 case 'VALIDATION_ERROR':throw new HttpError(400,code,'Choose 1–5 stars and a comment of at most 500 characters.');
 }
 return feedback(data.feedback);
}
function encode(value:object){return Buffer.from(JSON.stringify(value)).toString('base64url');}
function decode<T>(cursor:string|undefined,schema:z.ZodType<T>):T|undefined{
 if(!cursor)return;try{if(!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error();return schema.parse(JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')));}catch{throw new HttpError(400,'VALIDATION_ERROR','This page cursor is invalid. Start from the first page.');}
}
export async function receivedFeedback(client:Client,id:string,query:Query):Promise<Page<Feedback>>{
 const {data:profile,error:profileError}=await client.from('profiles').select('id').eq('id',id).maybeSingle();if(profileError)throw unavailable();if(!profile)throw new HttpError(404,'NOT_FOUND','Profile not found.');
 const after=decode(query.cursor,z.object({kind:z.literal('feedback'),context:z.literal(id),at:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/).refine(v=>!Number.isNaN(Date.parse(v))),id:z.string().uuid()}).strict());
 let request=client.from('feedback').select('*').eq('reviewee_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(query.limit+1);
 if(after)request=request.or(`created_at.lt.${after.at},and(created_at.eq.${after.at},id.lt.${after.id})`);
 const {data,error}=await request;if(error||!data)throw unavailable();const rows=data.slice(0,query.limit),last=rows.at(-1);
 return {items:rows.map(feedback),nextCursor:data.length>query.limit&&last?encode({kind:'feedback',context:id,at:last.created_at,id:last.id}):null};
}
export async function bookingFeedback(client:Client,id:string,actorId:string):Promise<Feedback|null>{const {data,error}=await client.from('feedback').select('*').eq('booking_id',id).eq('reviewer_id',actorId).maybeSingle();if(error)throw unavailable();return data?feedback(data):null;}
export async function leaderboard(client:Client,query:Query):Promise<Page<LeaderboardEntry>>{
 const after=decode(query.cursor,z.object({kind:z.literal('leaderboard'),average:z.string().regex(/^[1-5](?:\.\d{1,30})?$/).refine(v=>Number(v)<=5),count:z.number().int().min(3).max(2147483647),id:z.string().uuid()}).strict());
 const {data,error}=await client.rpc('community_leaderboard',{p_limit:query.limit+1,...(after?{p_after_average:after.average,p_after_count:after.count,p_after_id:after.id}:{})});
 if(error?.code==='22023')throw new HttpError(400,'VALIDATION_ERROR','Invalid ranking page.');if(error||!data)throw unavailable();
 const rows=data.slice(0,query.limit),last=rows.at(-1);
 return {items:rows.map(row=>({rank:row.rank,profile:{id:row.id,displayName:row.display_name,bio:row.bio,college:row.college,reputation:{averageRating:Number(row.average_rating),ratingCount:row.rating_count}}})),nextCursor:data.length>query.limit&&last?encode({kind:'leaderboard',average:last.average_rating,count:last.rating_count,id:last.id}):null};
}
