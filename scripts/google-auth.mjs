// Owner-run configuration helper. Credentials are injected only on the management destination.
import {readFileSync} from 'node:fs';
const ref=process.env.SUPABASE_PROJECT_REF??JSON.parse(readFileSync('.local/hosted-management.json','utf8')).projectRef;
const id=process.env.GOOGLE_OAUTH_CLIENT_ID,secret=process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if(!/^[a-z]{20}$/.test(ref??''))throw Error('Invalid hosted project.');
if(!id||!/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id)||!secret)throw Error('Supply GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET securely.');
if(!process.env.SUPABASE_ACCESS_TOKEN)throw Error('Management access is required.');
const r=await fetch('https://api.supabase.com/v1/projects/'+ref+'/config/auth',{method:'PATCH',headers:{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({external_google_enabled:true,external_google_client_id:id,external_google_secret:secret,external_google_skip_nonce_check:false}),signal:AbortSignal.timeout(30000),redirect:'error'});
if(!r.ok)throw Error('Google configuration returned HTTP '+r.status+'; sensitive response withheld.');
console.log('Google provider configuration saved. The app detects Supabase provider availability automatically. Verify a real Google sign-in before claiming completion.');
