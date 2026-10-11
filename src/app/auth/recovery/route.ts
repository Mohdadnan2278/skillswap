import {NextResponse} from 'next/server';
import {createSupabaseServerClient} from '@/backend/supabase/server';
import {getSiteOrigin,isAuthConfigured} from '@/backend/config';
export async function GET(request:Request){
 const origin=getSiteOrigin();if(!origin||!isAuthConfigured())return NextResponse.redirect(new URL('/login?notice=setup',request.url));
 let valid=false;const url=new URL(request.url);
 try{const client=await createSupabaseServerClient(true);const code=url.searchParams.get('code'),hash=url.searchParams.get('token_hash');
  if(code&&!hash){const {error}=await client.auth.exchangeCodeForSession(code);valid=!error;}
  else if(hash&&url.searchParams.get('type')==='recovery'&&!code){const {error}=await client.auth.verifyOtp({token_hash:hash,type:'recovery'});valid=!error;}
 }catch{}
 return NextResponse.redirect(new URL(valid?'/reset-password':'/forgot-password?notice=expired',origin),{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
}
