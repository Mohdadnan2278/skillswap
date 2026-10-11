import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requirePageSession} from '@/backend/auth/session';
import {getCurrentUser} from '@/backend/profiles/service';
import {notifications} from '@/backend/notifications/service';
import {catalogueQuerySchema} from '@/shared/validation';
import {NotificationInbox} from '@/frontend/components/notification-inbox';
import {HttpError} from '@/backend/http';
export default async function Notifications({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {client,user}=await requirePageSession();const current=await getCurrentUser(client,user);if(!current.profile)redirect('/onboarding');const query=catalogueQuerySchema.safeParse(await searchParams);
 if(!query.success)return <p>Invalid notification page. <Link className="secondary-button" href="/notifications">Start again</Link></p>;
 let inbox;try{inbox=await notifications(client,user.id,query.data);}catch(e){if(e instanceof HttpError&&e.status===400)return <p>Invalid notification page. <Link className="secondary-button" href="/notifications">Start again</Link></p>;throw e;}
 return <NotificationInbox timezone={current.timezone} {...inbox}/>;
}
