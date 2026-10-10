import "server-only";
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database,Json } from '@/backend/supabase/database.types';
import type { Wallet,LedgerEntry,Reservation,Page } from '@/shared/contracts';
import { safeUnits } from '@/shared/credits';
import { HttpError } from '@/backend/http';
import { databaseInstantSchema } from '@/shared/validation';
type Client=SupabaseClient<Database>;
type TransactionRow={id:string;event_id:string;delta_units:string;created_at:string;kind:'starter_grant'|'session_transfer';booking_id:string|null};
type ReservationRow={booking_id:string;units:string;status:'held';created_at:string;updated_at:string;booking_state:Reservation['bookingState']};
function result(data:Json|null,error:{code?:string}|null) {
 if(error?.code==='P0001')throw new HttpError(403,'PROFILE_INCOMPLETE','Finish your profile to receive starter credits.');
 if(error||!data||typeof data!=='object'||Array.isArray(data))throw new HttpError(503,'DATABASE_UNAVAILABLE','Your wallet is unavailable. Please try again.');
 if(data.error)throw new HttpError(400,'VALIDATION_ERROR','Invalid wallet query.');
 return data;
}
function amount(value:unknown) {try{return safeUnits(value);}catch{throw new HttpError(503,'DATABASE_UNAVAILABLE','Could not safely read this credit amount.');}}
export async function wallet(client:Client):Promise<Wallet> {
 const {data,error}=await client.rpc('read_my_wallet',{});const row=result(data,error);
 return {settledUnits:amount(row.settledUnits),reservedUnits:amount(row.reservedUnits),availableUnits:amount(row.availableUnits)};
}
export async function walletPage<K extends 'transactions'|'reservations'>(client:Client,userId:string,kind:K,query:{limit:number;cursor?:string}):Promise<Page<K extends 'transactions'?LedgerEntry:Reservation>> {
 const context=`${userId}:${kind}`;let after:{created:string;id:string}|undefined;
 if(query.cursor)try{
  if(!/^[A-Za-z0-9_-]+$/.test(query.cursor))throw Error();
  after=z.object({created:databaseInstantSchema,id:z.string().uuid(),context:z.literal(context)}).strict().parse(JSON.parse(Buffer.from(query.cursor,'base64url').toString('utf8')));
 }catch{throw new HttpError(400,'VALIDATION_ERROR','Invalid wallet page cursor. Start again from the first page.');}
 const {data,error}=await client.rpc('read_my_wallet',{p_kind:kind,p_limit:query.limit+1,...(after?{p_after_created:after.created,p_after_id:after.id}:{})});
 const rows=result(data,error).items as unknown as (TransactionRow|ReservationRow)[];
 const entries=rows.slice(0,query.limit);
 const items=entries.map(row=>'delta_units' in row?{id:row.id,eventId:row.event_id,deltaUnits:amount(row.delta_units),createdAt:new Date(row.created_at).toISOString(),kind:row.kind,bookingId:row.booking_id}:{bookingId:row.booking_id,units:amount(row.units),status:row.status,bookingState:row.booking_state,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()});
 const last=entries.at(-1);const id=last?('id' in last?last.id:last.booking_id):null;
 return {items:items as (K extends 'transactions'?LedgerEntry:Reservation)[],nextCursor:rows.length>query.limit&&last?Buffer.from(JSON.stringify({created:last.created_at,id,context})).toString('base64url'):null};
}
