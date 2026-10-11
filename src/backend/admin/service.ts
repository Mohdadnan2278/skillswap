import 'server-only';
import {notFound} from 'next/navigation';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/backend/supabase/database.types';
import {verifiedSession,requirePageSession} from '@/backend/auth/session';
import {HttpError} from '@/backend/http';
import {adminDataSchema,type AdminCommand,type AdminQuery} from '@/shared/admin';
export async function requireAdmin(writable=false){
 const session=await verifiedSession(writable);
 if(!session.isAdmin)throw new HttpError(403,'FORBIDDEN','Administrator access is required.');
 return session;
}
export async function requireAdminPage(){const session=await requirePageSession();if(!session.isAdmin)notFound();return session;}
export async function readAdmin(client:SupabaseClient<Database>,q:AdminQuery){
 const {data,error}=await client.rpc('admin_read',{p_section:q.section,p_page:q.page,p_search:q.search});
 if(error?.code==='42501')throw new HttpError(403,'FORBIDDEN','Administrator access is required.');
 const result=adminDataSchema.safeParse(data);if(error||!result.success)throw new HttpError(503,'DATABASE_UNAVAILABLE','Admin data is temporarily unavailable.');
 return result.data;
}
export async function manageAdmin(client:SupabaseClient<Database>,command:AdminCommand,key:string){
 const {action,reason}=command;const {data,error}=await client.rpc('admin_manage',{p_action:action,p_reason:reason,p_key:key,p_target:action==='create_skill'||action==='configure_demo'?null:command.target,p_value:action==='create_skill'?{name:command.name,slug:command.slug,category:command.category}:action==='configure_demo'?{enabled:command.enabled,durationMinutes:command.durationMinutes,costUnits:command.costUnits,version:command.version}:{}});
 if(error?.code==='42501')throw new HttpError(403,'FORBIDDEN','Administrator access is required.');
 if(error?.code==='22023')throw new HttpError(400,'VALIDATION_ERROR','Check the action and reason.');
 if(error?.code==='23505')throw new HttpError(409,'INVALID_STATE','A skill with this name or slug already exists. Find it in the catalogue instead.');
 if(error||!data||typeof data!=='object'||Array.isArray(data))throw new HttpError(503,'DATABASE_UNAVAILABLE','The action could not be confirmed. Review the audit log before retrying.');
 if(data.error==='IDEMPOTENCY_CONFLICT')throw new HttpError(409,'IDEMPOTENCY_CONFLICT','This retry key was already used for another action.');
 if(data.error==='NOT_FOUND')throw new HttpError(404,'NOT_FOUND','The selected item no longer exists.');
 if(data.error==='INVALID_STATE')throw new HttpError(409,'INVALID_STATE',action==='configure_demo'?'Demo settings changed. Refresh and review the current settings before saving again.':'This action is unavailable. Keep at least one admin, restore suspended members before promotion, and revoke admin access before suspension.');
 return {auditId:data.auditId,targetId:data.targetId};
}
