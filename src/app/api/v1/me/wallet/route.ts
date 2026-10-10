import {apiHandler,requireConfiguration,success} from '@/backend/http';
import {verifiedSession} from '@/backend/auth/session';
import {wallet} from '@/backend/wallet/service';
export async function GET(){return apiHandler(async()=>{requireConfiguration();const {client}=await verifiedSession(true);return success(await wallet(client));});}
