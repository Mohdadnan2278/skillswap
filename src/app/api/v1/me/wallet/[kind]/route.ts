import {apiHandler,requireConfiguration,success,HttpError} from '@/backend/http';
import {verifiedSession} from '@/backend/auth/session';
import {walletPage} from '@/backend/wallet/service';
import {queryFields} from '@/backend/skills/service';
import {catalogueQuerySchema} from '@/shared/validation';
export async function GET(request:Request,{params}:{params:Promise<{kind:string}>}){return apiHandler(async()=>{
 requireConfiguration();const {client,user}=await verifiedSession(true);const {kind}=await params;
 if(kind!=='transactions'&&kind!=='reservations')throw new HttpError(404,'NOT_FOUND','Wallet view not found.');
 return success(await walletPage(client,user.id,kind,catalogueQuerySchema.parse(queryFields(new URL(request.url)))));
});}
