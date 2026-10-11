'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {ApiResponse} from '@/shared/contracts';
import {notificationLabels,type BookingNotification} from '@/shared/notifications';
import {formatSessionTime} from '@/shared/time';
import {usePageRefresh} from './live-refresh';
export function useUnreadNotifications(){
 const [count,setCount]=useState(0);
 useEffect(()=>{const controller=new AbortController();let reading=false;async function refresh(){if(reading||document.visibilityState!=='visible')return;reading=true;try{const r=await fetch('/api/v1/me/notifications?limit=1',{cache:'no-store',signal:controller.signal});const result:ApiResponse<{unreadCount:number}>=await r.json();if(!controller.signal.aborted&&'data'in result)setCount(result.data.unreadCount);else if([401,403].includes(r.status))setCount(0);}catch{}finally{reading=false;}}
 void refresh();const timer=setInterval(()=>void refresh(),15000);window.addEventListener('focus',refresh);window.addEventListener('skillswap-notifications-changed',refresh);document.addEventListener('visibilitychange',refresh);return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('skillswap-notifications-changed',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);
 return count;
}
export function NotificationInbox({items,unreadCount,nextCursor,timezone}:{items:BookingNotification[];unreadCount:number;nextCursor:string|null;timezone:string}){
 const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState('');usePageRefresh(!busy);
 async function markRead(ids:string[]){setBusy(true);setMessage('');try{const r=await fetch('/api/v1/me/notifications',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});const result:ApiResponse<{read:boolean}>=await r.json();if('error'in result)setMessage(result.error.message);else{window.dispatchEvent(new Event('skillswap-notifications-changed'));router.refresh();}}catch{setMessage('Could not mark notifications as read. Retry when connected.');}finally{setBusy(false);}}
 const unread=items.filter(item=>!item.read_at);
 return <section className="mx-auto max-w-2xl"><h1 className="text-3xl font-bold">Notifications</h1><p className="mt-3">{unreadCount} unread. This page updates while you are here.</p>{unread.length>0&&<button className="secondary-button mt-4" disabled={busy} onClick={()=>void markRead(unread.map(item=>item.id))}>Mark this page as read</button>}<ul className="mt-6 space-y-4">{items.map(item=><li key={item.id} className={`rounded-xl border p-5 ${item.read_at?'bg-white':'border-emerald-600 bg-emerald-50'}`}><p className="font-semibold">{notificationLabels[item.kind]}</p><p className="mt-2 break-words">{item.skill_name}</p><p className="mt-2 text-sm text-slate-600">{formatSessionTime(item.created_at,timezone)}</p><div className="mt-3 flex flex-wrap gap-3"><Link className="secondary-button" href={`/bookings/${item.booking_id}`}>View booking</Link>{!item.read_at&&<button className="secondary-button" disabled={busy} onClick={()=>void markRead([item.id])}>Mark as read</button>}</div></li>)}</ul>{!items.length&&<p className="mt-6 rounded-xl bg-white p-5">Your booking updates will appear here.</p>}{nextCursor&&<Link className="secondary-button mt-5" href={`/notifications?cursor=${encodeURIComponent(nextCursor)}`}>Older notifications</Link>}{message&&<p role="status" className="mt-4">{message}</p>}</section>;
}
