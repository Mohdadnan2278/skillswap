import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {parseArgs, parseEnv} from 'node:util';
import {inspectDemoConfig} from './lib/demo-readiness.mjs';

const root = resolve(import.meta.dirname, '..');
const {values} = parseArgs({options: {'env-file': {type: 'string', default: '.env.local'}}});
const file = resolve(root, values['env-file']);
const settings = {...(existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {}), ...process.env};
const report = inspectDemoConfig(settings);
const add = (id, passed, message) => report.checks.push({id, status: passed ? 'pass' : 'blocked', message});
let googleAvailable=false;
async function request(url, headers, body) {
  const response = await fetch(url, {method: body ? 'POST' : 'GET', headers, ...(body ? {body: JSON.stringify(body)} : {}), redirect: 'error', signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return response.json();
}
if (report.supabaseOrigin && report.checks.find(c => c.id === 'public_key').status === 'pass') {
  try {
    const auth = await request(`${report.supabaseOrigin}/auth/v1/settings`, {apikey: settings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY});
    googleAvailable=auth.external?.google===true;
    add('public_auth', auth.external?.email === true, 'Hosted email Auth must be enabled and reachable.');
  } catch { add('public_auth', false, 'Hosted Auth could not be verified; check the public configuration and network.'); }
}
if (settings.SUPABASE_ACCESS_TOKEN && report.projectRef && report.checks.find(c => c.id === 'hosted_supabase').status === 'pass') {
  const management = (path, body) => request(`https://api.supabase.com/v1/projects/${report.projectRef}${path}`, {Authorization: `Bearer ${settings.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json'}, body);
  try {
    const [project, auth, history, security] = await Promise.all([
      management(''), management('/config/auth'),
      management('/database/query', {query: 'select version from supabase_migrations.schema_migrations order by version;'}),
      management('/database/query', {query: "select relname,relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r';"}),
    ]);
    add('project_health', project.status === 'ACTIVE_HEALTHY', 'Hosted Supabase must be healthy.');
    const expected = readdirSync(join(root, 'supabase/migrations')).filter(f => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).map(f => f.slice(0, 14));
    const applied = new Set(history.map(row => row.version));
    add('migrations', expected.length > 0 && expected.every(version => applied.has(version)), `${expected.length} repository migrations must be applied; this check never applies them.`);
    const tables = ['profiles', 'account_preferences', 'skills', 'user_skills', 'bookings', 'wallets', 'reservations', 'ledger_entries', 'booking_confirmations', 'booking_disputes', 'booking_dispute_votes', 'feedback','member_availability','booking_notifications'];
    add('row_security', tables.every(name => security.some(row => row.relname === name && row.relrowsecurity === true)), 'All 14 exposed application tables must retain row security.');
    add('confirmed_email', auth.mailer_autoconfirm === false && auth.external_email_enabled === true, 'Signup must require confirmed email.');
    const callbacks = String(auth.uri_allow_list ?? '').split(',').map(value => value.trim());
    const emailEnabled=settings.EMAIL_DELIVERY_ENABLED==='true';
    const requiredCallbacks=['auth/callback','auth/confirm',...(emailEnabled?['auth/recovery']:[])];
    add('auth_origin', Boolean(report.siteOrigin) && auth.site_url === report.siteOrigin && requiredCallbacks.every(path => callbacks.includes(`${report.siteOrigin}/${path}`)), 'Auth site URL and required exact callbacks must match SITE_URL.');
    const smtpConfigured=Boolean(auth.smtp_host && auth.smtp_user && auth.smtp_admin_email);
    add('student_email', (emailEnabled && smtpConfigured) || (googleAvailable && auth.external_google_enabled===true), 'Student access needs explicitly enabled SMTP email signup or configured Google sign-in. Verify the chosen flow with real accounts.');
    if(emailEnabled)add('email_delivery',smtpConfigured,'Email signup/recovery opt-in requires a configured SMTP sender and manual delivery testing.');
    const [worker]=await management('/database/query',{query:"select to_regprocedure('private.sweep_booking_requests()') is not null as worker_present,to_regclass('cron.job') is not null as cron_present;"});
    add('expiry_worker',worker?.worker_present===true,'The restricted expiry worker must be applied.');
    let expiryScheduled=false;
    if(worker?.cron_present){const jobs=await management('/database/query',{query:"select active,schedule,command from cron.job where jobname='skillswap-expire-pending';"});expiryScheduled=jobs.some(job=>job.active&&job.schedule==='* * * * *'&&job.command==='select private.sweep_booking_requests();');}
    add('expiry_schedule',expiryScheduled,'The named one-minute pending-request expiry job must be enabled; this check never schedules it.');
    if (googleAvailable) add('google_oauth', auth.external_google_enabled === true, 'Google is available in Supabase; a real Google callback still needs manual testing.');
  } catch { add('management_checks', false, 'Hosted management checks could not complete; credentials and error responses are withheld.'); }
} else add('management_checks', false, 'Migration/Auth/SMTP checks need the existing management token and matching hosted project.');
const configurationReady = report.checks.every(check => check.status === 'pass');
console.log(JSON.stringify({configurationReady, siteOrigin: report.siteOrigin, supabaseOrigin: report.supabaseOrigin, checks: report.checks,
  manualChecks: ['Authorized deployment on the selected branch', 'Two real email confirmation/login flows or Google sign-in flows', 'Two physical phones over HTTPS with camera, microphone and reconnect', 'A real scheduled session, both completion confirmations, transfer and feedback'],
  note: 'Read-only configuration check. Passing does not verify deployment, email delivery or live video.'}, null, 2));
process.exitCode = configurationReady ? 0 : 1;
