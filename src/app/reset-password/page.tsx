import {AuthShell} from '@/frontend/components/auth-shell';
import {PasswordRecoveryForm} from '@/frontend/components/password-recovery-form';
import {requirePageSession} from '@/backend/auth/session';
export const dynamic='force-dynamic';
export default async function ResetPassword(){await requirePageSession();return <AuthShell title="Choose a new password" description="Use a unique password with at least 8 characters."><PasswordRecoveryForm reset/></AuthShell>;}
