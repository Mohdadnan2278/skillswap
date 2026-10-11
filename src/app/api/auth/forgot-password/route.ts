import {createSupabaseServerClient} from '@/backend/supabase/server';
import {getSiteOrigin,emailDeliveryEnabled} from '@/backend/config';
import {apiHandler,parseJson,requireConfiguration,requireSameOrigin,success,HttpError} from '@/backend/http';
import {resendSchema} from '@/shared/validation';
export async function POST(request:Request){return apiHandler(async()=>{
 requireConfiguration();requireSameOrigin(request);const {email}=await parseJson(request,resendSchema);
 if(!emailDeliveryEnabled())throw new HttpError(503,'PROVIDER_UNAVAILABLE','Email recovery is currently unavailable. Use Google if linked to your account, or contact your administrator.');
 const client=await createSupabaseServerClient(true);const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${getSiteOrigin()}/auth/recovery`});
 if(error?.status===429)throw new HttpError(429,'RATE_LIMITED','Wait a moment before requesting another link.');
 if(error&&(error.name==='AuthRetryableFetchError'||(error.status??0)>=500))throw new HttpError(502,'PROVIDER_UNAVAILABLE','Email recovery is temporarily unavailable. Try again later.');
 return success({message:'If this address can receive recovery email, a link has been sent. Open it in this browser.'});
});}
