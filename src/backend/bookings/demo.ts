import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/backend/supabase/database.types';
import {demoPolicySchema} from '@/shared/demo';
import {HttpError} from '@/backend/http';
export async function demoPolicy(client:SupabaseClient<Database>){
 const {data,error}=await client.rpc('read_demo_policy');
 const result=demoPolicySchema.safeParse(data);
 if(error||!result.success)throw new HttpError(503,'DATABASE_UNAVAILABLE','Demo settings are temporarily unavailable.');
 return result.data;
}
