import { execFileSync } from "node:child_process";
import { expect,type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { signupAndConfirm,origin,supabaseUrl } from './local-auth';
export const bookingSkill='41000000-0000-4000-8000-000000000004';
export async function bookingAccount(context:APIRequestContext,label:string) {
 const account=await signupAndConfirm(context,label);
 const result=await context.patch('/api/v1/me/profile',{headers:{origin},data:{displayName:label,bio:'Scheduling test account',college:'',timezone:'Asia/Kolkata'}});
 expect(result.status()).toBe(200);const id=(await result.json()).data.id as string;
 expect((await context.put('/api/v1/me/skills',{headers:{origin},data:{offeredSkillIds:[bookingSkill],wantedSkillIds:[bookingSkill]}})).status()).toBe(200);
 return {...account,id};
}
export function startsAfter(minutes:number) {return new Date(Math.ceil(Date.now()/60000)*60000+minutes*60000).toISOString();}
export async function requestBooking(context:APIRequestContext,teacherId:string,startsAt:string,durationMinutes:30|60|90=30,key=randomUUID()) {
 return context.post('/api/v1/bookings',{headers:{origin,'Idempotency-Key':key},data:{teacherId,skillId:bookingSkill,startsAt,durationMinutes}});
}
export async function bookingAction(context:APIRequestContext,id:string,action:string,key=randomUUID()) {
 return context.post(`/api/v1/bookings/${id}/${action}`,{headers:{origin,'Idempotency-Key':key},data:{}});
}
/** Local-only fixtures advance deadlines without pretending real elapsed time or credits. */
export function deadlineFixture(id:string,started=false) {
 if(!['127.0.0.1','localhost'].includes(new URL(supabaseUrl).hostname)||! /^[0-9a-f-]{36}$/.test(id))throw Error('Unsafe fixture target');
 const sql=started?`begin; update public.bookings set starts_at=now()-interval '5 minutes',ends_at=now()+interval '25 minutes',request_expires_at=now()-interval '5 minutes' where id='${id}'; update private.booking_occupancy set during=tstzrange(now()-interval '5 minutes',now()+interval '25 minutes','[)') where booking_id='${id}'; commit;`:`update public.bookings set request_expires_at=now()-interval '1 minute' where id='${id}';`;
 execFileSync('docker',['exec','-i','supabase_db_skillswap','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'],{input:sql,stdio:['pipe','pipe','pipe']});
}
export async function cleanupBookings(context:APIRequestContext) {
 const response=await context.get('/api/v1/bookings?limit=50');
 if(response.ok())for(const row of (await response.json()).data.items)if(['pending','accepted'].includes(row.state)&&Date.parse(row.startsAt)>Date.now())await bookingAction(context,row.id,'cancel');
 await context.put('/api/v1/me/skills',{headers:{origin},data:{offeredSkillIds:[],wantedSkillIds:[]}});
}
