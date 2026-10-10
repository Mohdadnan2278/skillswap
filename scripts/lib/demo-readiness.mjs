/** Configuration checks only. Never return credentials in the public report. */
export function inspectDemoConfig(env) {
  const checks = [];
  const add = (id, passed, message) => checks.push({id, status: passed ? 'pass' : 'blocked', message});
  let siteOrigin = null, supabaseOrigin = null, projectRef = null;
  try {
    const url = new URL(env.SITE_URL);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error();
    if (!['https:', 'http:'].includes(url.protocol)) throw Error();
    siteOrigin = url.origin;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    add('https_app_origin', url.protocol === 'https:' && !local, 'The phone demo needs a public HTTPS SITE_URL, with no path or credentials.');
  } catch { add('https_app_origin', false, 'Set SITE_URL to the exact public HTTPS application origin.'); }
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !/^[a-z]{20}\.supabase\.co$/.test(url.hostname)) throw Error();
    supabaseOrigin = url.origin;
    projectRef = url.hostname.split('.')[0];
    add('hosted_supabase', !env.SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_REF === projectRef, 'The hosted URL must match the selected Supabase project.');
  } catch { add('hosted_supabase', false, 'Use the hosted project HTTPS URL; local services cannot serve the phone demo.'); }
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey) {
    try {
      const parts = key.split('.');
      publicKey = parts.length === 3 && parts.every(Boolean) && JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role === 'anon';
    } catch { publicKey = false; }
  }
  add('public_key', publicKey && !key.startsWith('sb_secret_') && key !== 'your-publishable-key', 'Only a publishable key or legacy anon key belongs in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  add('video_option', env.VIDEO_PROVIDER === 'jitsi_demo', 'VIDEO_PROVIDER=jitsi_demo enables Jitsi alongside manually added Google Meet links.');
  add('google_flag', ['false', 'true'].includes(env.GOOGLE_AUTH_ENABLED ?? 'false'), 'Google OAuth is optional; use an explicit true/false setting.');
  return {checks, siteOrigin, supabaseOrigin, projectRef};
}
