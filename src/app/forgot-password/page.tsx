import {AuthShell} from '@/frontend/components/auth-shell';
import {PasswordRecoveryForm} from '@/frontend/components/password-recovery-form';
import {emailDeliveryEnabled,isAuthConfigured} from '@/backend/config';
export const dynamic='force-dynamic';
export default async function ForgotPassword({searchParams}:{searchParams:Promise<{notice?:string}>}){const {notice}=await searchParams;return <AuthShell title="Recover your account" description="Request a link to choose a new password.">{notice==='expired'&&<p role="status" className="mb-4">That recovery link is invalid or expired. Request a new one.</p>}<PasswordRecoveryForm configured={isAuthConfigured()&&emailDeliveryEnabled()}/></AuthShell>;}
