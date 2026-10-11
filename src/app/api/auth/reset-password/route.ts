import {verifiedSession} from '@/backend/auth/session';
import {apiHandler,parseJson,requireConfiguration,requireSameOrigin,success,HttpError} from '@/backend/http';
import {resetPasswordSchema} from '@/shared/validation';
export async function POST(request:Request){return apiHandler(async()=>{
 requireConfiguration();requireSameOrigin(request);const {password}=await parseJson(request,resetPasswordSchema);const {client}=await verifiedSession(true);
 const {error}=await client.auth.updateUser({password});
 if(error?.status===429)throw new HttpError(429,'RATE_LIMITED','Wait before changing your password again.');
 if(error?.code==='weak_password'||error?.code==='same_password')throw new HttpError(400,'VALIDATION_ERROR','Choose a new, stronger password with at least 8 characters.');
 if(error)throw new HttpError(502,'PROVIDER_UNAVAILABLE','Could not change your password. Request a fresh recovery link and try again.');
 const {error:logoutError}=await client.auth.signOut({scope:'global'});
 // Do not report a saved password as failed if revocation temporarily fails.
 return success({saved:true,sessionsRevoked:!logoutError,message:logoutError?'Password saved. Sign in with the new password. Other sessions could not be signed out; retry signing out of other devices.':'Password saved. Sign in again with your new password.'});
});}
