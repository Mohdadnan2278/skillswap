import {readFileSync,writeFileSync,existsSync,mkdirSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),local=join(root,'.local');mkdirSync(local,{recursive:true});
const mode=process.argv[2];if(!['local','hosted','prepare-tests'].includes(mode))throw Error('Choose local, hosted or prepare-tests.');
const target=join(root,'.env.local');
if(mode==='local'||mode==='prepare-tests'){
 const result=spawnSync(process.execPath,[join(root,'scripts/supabase-local.mjs'),'status','--output','json'],{cwd:root,encoding:'utf8'});if(result.status!==0)throw Error('Start local Supabase first.');
 const data=JSON.parse(result.stdout),url=new URL(data.API_URL),key=data.PUBLISHABLE_KEY||data.ANON_KEY;if(!['127.0.0.1','localhost'].includes(url.hostname)||!key)throw Error('Expected local Supabase credentials.');
 const content=`# Generated local Supabase settings by SkillSwap; no hosted credentials.\nNEXT_PUBLIC_SUPABASE_URL=${url.origin}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nSITE_URL=http://127.0.0.1:3000\nGOOGLE_AUTH_ENABLED=false\nVIDEO_PROVIDER=jitsi_demo\n`;
 const file=join(local,'local.env');writeFileSync(file,content,{mode:0o600});chmodSync(file,0o600);
 if(mode==='prepare-tests'){console.log('Isolated local test configuration prepared; active app configuration preserved.');process.exit(0);}
}
const source=join(local,mode+'.env');if(!existsSync(source))throw Error('Prepare the '+mode+' environment first.');
const content=readFileSync(source,'utf8'),env=parseEnv(content),url=new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if(mode==='hosted'&&(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')))throw Error('Expected HTTPS hosted Supabase.');
if(existsSync(target)&&!/^# Generated (local|hosted) Supabase settings by SkillSwap/.test(readFileSync(target,'utf8')))throw Error('User-managed .env.local was preserved. Back it up before switching.');
writeFileSync(target,content,{mode:0o600});chmodSync(target,0o600);console.log('Active app environment:',mode+'. Restart the app; rebuild before production because public variables are compiled.');
