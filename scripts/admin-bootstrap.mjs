import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {randomBytes,randomUUID} from 'node:crypto';
const {values}=parseArgs({options:{demo:{type:'boolean'},email:{type:'string'},'project-ref':{type:'string'}}});
const ref=values['project-ref']??process.env.SUPABASE_PROJECT_REF??JSON.parse(readFileSync('.local/hosted-management.json','utf8')).projectRef;
if(!/^[a-z]{20}$/.test(ref??''))throw Error('Choose a valid hosted project.');
if(!values.demo&&!values.email)throw Error('Use --demo only for an explicitly authorized demo account, or --email for an existing verified member.');
if(!process.env.SUPABASE_ACCESS_TOKEN)throw Error('Supply the management token securely through environment settings.');
const email=values.demo?'admin@skillswap.example':values.email.trim().toLowerCase();
if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw Error('Invalid account email.');
async function request(url,headers,body,method=body?'POST':'GET'){
 const r=await fetch(url,{method,headers:{...headers,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!r.ok)throw Error('Provisioning returned HTTP '+r.status+'; sensitive response withheld.');
 const text=await r.text();return text?JSON.parse(text):null;
}
const management=(path,body)=>request('https://api.supabase.com/v1/'+path,{Authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN},body);
const query=sql=>management('projects/'+ref+'/database/query',{query:sql});
const literal=s=>"'"+s.replaceAll("'","''")+"'";
let users=await query('select id,email_confirmed_at from auth.users where lower(email)='+literal(email));
if(users.length>1)throw Error('Ambiguous member identity.');
mkdirSync('.local',{recursive:true});const file='.local/demo-admin-credentials.txt';
if(values.demo&&!users.length){
 if(existsSync(file))throw Error('Preserved an existing credentials file. Inspect it before provisioning.');
 const password=randomBytes(30).toString('base64url')+'Aa1!';
 const keys=await management('projects/'+ref+'/api-keys');const secret=keys.find(k=>k.name==='service_role')?.api_key;
 if(!secret)throw Error('Trusted Auth provisioning key is unavailable.');
 const base='https://'+ref+'.supabase.co';
 const user=await request(base+'/auth/v1/admin/users',{apikey:secret,Authorization:'Bearer '+secret},{email,password,email_confirm:true,user_metadata:{demo_account:true}});
 if(!/^[0-9a-f-]{36}$/.test(user.id??''))throw Error('Provisioning did not return a valid identity.');
 writeFileSync(file,'SkillSwap demo administrator — private, never commit or share publicly\nSite: https://skillswap-delta-taupe.vercel.app\nEmail: '+email+'\nPassword: '+password+'\nThis reserved address cannot receive mail. This demo-only account was explicitly provisioned; no email delivery was verified.\n',{mode:0o600});
 const tokens=await request(base+'/auth/v1/token?grant_type=password',{apikey:secret},{email,password});
 await request(base+'/rest/v1/rpc/save_my_profile',{apikey:secret,Authorization:'Bearer '+tokens.access_token},{p_display_name:'Demo Administrator',p_bio:'Demo-only management account',p_college:'Semester demo',p_timezone:'Asia/Kolkata'});
 users=await query('select id,email_confirmed_at from auth.users where id='+literal(user.id));
 console.log('Created the explicitly authorized demo identity. Login details are in the ignored private credentials file.');
}
const user=users[0];if(!user?.email_confirmed_at||! /^[0-9a-f-]{36}$/.test(user.id))throw Error('An existing confirmed account is required.');
if(!(await query('select id from public.profiles where id='+literal(user.id))).length)throw Error('Complete onboarding before granting admin access.');
const key=randomUUID();const uid=literal(user.id);
await query(`begin;select pg_advisory_xact_lock(552041005);
 insert into private.admin_members(user_id) values(${uid}) on conflict do nothing;
 insert into private.admin_audit(actor,action,target,reason,before_value,after_value,request_key,input,result)
 values(${uid},'bootstrap_admin',${uid},'Owner-authorized trusted administrator provisioning',null,'{"isAdmin":true}',${literal(key)},'{"trustedBootstrap":true}','{"isAdmin":true}');commit;`);
console.log('Administrator membership provisioned and audited. Ordinary signup confirmation and wallet rules were preserved.');
