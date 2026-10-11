import {parseArgs} from 'node:util';
import {existsSync,readFileSync} from 'node:fs';
const {values}=parseArgs({options:{apply:{type:'boolean',default:false}}});
const savedPath=new URL('../.local/hosted-management.json',import.meta.url);
const saved=existsSync(savedPath)?JSON.parse(readFileSync(savedPath,'utf8')):{};
const ref=process.env.SUPABASE_PROJECT_REF??saved.projectRef;
if(!/^[a-z]{20}$/.test(ref??'')||!process.env.SUPABASE_ACCESS_TOKEN)throw Error('Existing hosted project and management token are required.');
const check="select exists(select 1 from pg_extension where extname='pg_cron') as cron_enabled,to_regprocedure('private.sweep_booking_requests()') is not null as worker_present;";
const apply="begin;create extension if not exists pg_cron with schema pg_catalog;select cron.schedule('skillswap-expire-pending','* * * * *','select private.sweep_booking_requests();');commit;";
async function query(sql){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(30000),redirect:'error'});if(!r.ok)throw Error(`Hosted scheduler returned HTTP ${r.status}; response withheld.`);return r.json();}
const [status]=await query(check);console.log(JSON.stringify({workerPresent:status.worker_present,cronEnabled:status.cron_enabled,applyRequested:values.apply}));
if(values.apply){if(!status.worker_present)throw Error('Apply the reviewed additive migrations before enabling expiry.');await query(apply);console.log('The named one-minute expiry job is configured. Re-running updates the same job.');}
