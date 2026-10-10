import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
const root=resolve(import.meta.dirname,'..'),local=join(root,'.local');mkdirSync(local,{recursive:true});
const {positionals,values}=parseArgs({allowPositionals:true,options:{'project-ref':{type:'string'},'site-url':{type:'string'}}});
const command=positionals[0]??'check';let saved={};
if(existsSync(join(local,'hosted-management.json')))saved=JSON.parse(readFileSync(join(local,'hosted-management.json'),'utf8'));
const ref=values['project-ref']??process.env.SUPABASE_PROJECT_REF??saved.projectRef;
if(!/^[a-z]{20}$/.test(ref??''))throw Error('Set SUPABASE_PROJECT_REF or pass --project-ref.');
if(!process.env.SUPABASE_ACCESS_TOKEN)throw Error('Save SUPABASE_ACCESS_TOKEN securely in environment settings.');
async function api(path,body,method=body?'POST':'GET'){
 let response;try{response=await fetch('https://api.supabase.com/v1/'+path,{method,headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000),redirect:'error'});}catch{throw Error('Management API connection failed; check HTTPS proxy and network access.');}
 if(!response.ok)throw Error(`Management API returned HTTP ${response.status}; response withheld to protect credentials.`);
 return response.json();
}
const query=sql=>api(`projects/${ref}/database/query`,{query:sql});
const project=await api(`projects/${ref}`);console.log('Hosted project:',project.name,ref,project.region,project.status);
if(command==='check'){
 const rows=await query("select count(*)::integer as app_tables from information_schema.tables where table_schema='public' and table_type='BASE TABLE';");console.log('Application tables:',rows[0]?.app_tables);
 const auth=await api(`projects/${ref}/config/auth`);console.log('Email confirmation:',auth.mailer_autoconfirm===false?'required':'not required');
}else if(command==='migrate'){
 const history=await query("select to_regclass('supabase_migrations.schema_migrations') is not null as present;");
 let applied=[];
 if(history[0]?.present)applied=await query('select version from supabase_migrations.schema_migrations order by version;');
 if(!applied.length){const rows=await query("select count(*)::integer as total from information_schema.tables where table_schema='public' and table_type='BASE TABLE';");if(rows[0]?.total!==0)throw Error('Untracked existing application tables: inspect migration history before applying.');}
 await query('create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);');
 for(const file of readdirSync(join(root,'supabase/migrations')).filter(x=>/^\d{14}_[a-z0-9_]+\.sql$/.test(x)).sort()){
  const [version]=file.split('_');if(applied.some(x=>x.version===version)){console.log('Already applied:',file);continue;}
  const sql=readFileSync(join(root,'supabase/migrations',file),'utf8');if(!/^(?:\s*--[^\n]*\n)*\s*begin;/i.test(sql)||!/commit;\s*$/i.test(sql))throw Error('Migrations must use an explicit transaction.');
  const name=file.slice(version.length+1,-4);const migration=sql.replace(/commit;\s*$/i,`insert into supabase_migrations.schema_migrations(version,name) values('${version}','${name}');\ncommit;`);
  await query(migration);console.log('Applied:',file);
 }
}else if(command==='configure'){
 if(!values['site-url'])throw Error('Pass --site-url with the exact app origin. Use HTTPS on a deployed site.');
 const origin=new URL(values['site-url']);if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||(origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['127.0.0.1','localhost'].includes(origin.hostname))))throw Error('Invalid app origin.');
 const template=readFileSync(join(root,'supabase/templates/confirmation.html'),'utf8');
 const currentAuth=await api(`projects/${ref}/config/auth`);
 const smtpConfigured=Boolean(currentAuth.smtp_host);
 console.log('Custom SMTP:',smtpConfigured?'configured':'absent; default hosted email limits apply. Default template uses the existing PKCE callback.');
 await api(`projects/${ref}/config/auth`,{site_url:origin.origin,uri_allow_list:[`${origin.origin}/auth/callback`,`${origin.origin}/auth/confirm`].join(','),mailer_autoconfirm:false,external_email_enabled:true,...(smtpConfigured?{mailer_templates_confirmation_content:template}:{})},'PATCH');
 const keys=await api(`projects/${ref}/api-keys`);const key=keys.find(x=>x.name==='anon')?.api_key;if(!key)throw Error('No public anon key returned.');
 const file=join(local,'hosted.env'),marker='# Generated hosted Supabase settings by SkillSwap';
 if(existsSync(file)&&!readFileSync(file,'utf8').startsWith(marker))throw Error('User-managed hosted.env was preserved.');
 writeFileSync(file,`${marker}\nNEXT_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nSITE_URL=${origin.origin}\nGOOGLE_AUTH_ENABLED=false\nVIDEO_PROVIDER=jitsi_demo\n`,{mode:0o600});console.log('Hosted Auth and ignored public configuration prepared. No service-role key retained.');
}else throw Error('Use check, migrate or configure.');
