import 'server-only';
import {HttpError} from '@/backend/http';
export type MeetingContext={roomName:string|null;actorId:string;displayName:string;teacherId:string;learnerId:string;opensAt:string;closesAt:string;serverNow:string};
export function requireVideoConfiguration(){if(process.env.VIDEO_PROVIDER!=='jitsi_demo')throw new HttpError(503,'CONFIGURATION_REQUIRED','Video setup is pending. Your booking and reserved credits are safe.');}
export function demoAccess(context:MeetingContext){
 if(!context.roomName||!/^skillswap-[0-9a-f]{32}$/.test(context.roomName))throw new HttpError(503,'DATABASE_UNAVAILABLE','Could not safely prepare the call.');
 return {provider:'jitsi_demo' as const,roomReference:context.roomName,serverOrigin:'https://meet.jit.si' as const,roomClosesAt:new Date(context.closesAt).toISOString(),serverNow:new Date(context.serverNow).toISOString()};
}
