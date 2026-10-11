import {verifiedSession} from '@/backend/auth/session';
import {apiHandler,parseJson,requireConfiguration,requireSameOrigin,success} from '@/backend/http';
import {notifications,markNotificationsRead} from '@/backend/notifications/service';
import {catalogueQuerySchema} from '@/shared/validation';
import {readNotificationsSchema} from '@/shared/notifications';
import {queryFields} from '@/backend/skills/service';
export async function GET(request:Request){return apiHandler(async()=>{requireConfiguration();const {client,user}=await verifiedSession(true);return success(await notifications(client,user.id,catalogueQuerySchema.parse(queryFields(new URL(request.url)))));});}
export async function PUT(request:Request){return apiHandler(async()=>{requireConfiguration();requireSameOrigin(request);const {client}=await verifiedSession(true);const {ids}=await parseJson(request,readNotificationsSchema);await markNotificationsRead(client,ids);return success({read:true});});}
