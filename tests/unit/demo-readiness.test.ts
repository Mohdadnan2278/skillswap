import {describe, expect, it} from 'vitest';
import {inspectDemoConfig} from '../../scripts/lib/demo-readiness.mjs';
const settings = {SITE_URL: 'https://skillswap.example', NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example', VIDEO_PROVIDER: 'jitsi_demo', GOOGLE_AUTH_ENABLED: 'false'};
const blocked = (env: Record<string, string>) => inspectDemoConfig(env).checks.filter((check: {status: string}) => check.status === 'blocked').map((check: {id: string}) => check.id);
describe('demo deployment configuration boundary', () => {
  it('accepts consistent public HTTPS configuration without treating it as deployed', () => expect(blocked(settings)).toEqual([]));
  it('rejects local/insecure/path origins and mismatched hosted projects', () => {
    for (const SITE_URL of ['http://skillswap.example', 'https://localhost', 'https://skillswap.example/path', 'https://user:pass@skillswap.example']) expect(blocked({...settings, SITE_URL})).toContain('https_app_origin');
    expect(blocked({...settings, SUPABASE_PROJECT_REF: 'differentprojectrefxx'})).toContain('hosted_supabase');
    expect(blocked({...settings, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321'})).toContain('hosted_supabase');
  });
  it('rejects secret and service-role keys without returning their values', () => {
    for (const key of ['sb_secret_test', `header.${Buffer.from(JSON.stringify({role: 'service_role'})).toString('base64url')}.signature`]) {
      const env = {...settings, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key};
      expect(blocked(env)).toContain('public_key');
      expect(JSON.stringify(inspectDemoConfig(env))).not.toContain(key);
    }
  });
});
