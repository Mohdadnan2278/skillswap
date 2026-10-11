'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export function usePageRefresh(enabled=true,seconds=15){
 const router=useRouter();
 useEffect(()=>{if(!enabled)return;let refreshing=false;const refresh=()=>{if(document.visibilityState==='visible'&&!refreshing){refreshing=true;router.refresh();queueMicrotask(()=>{refreshing=false;});}};const timer=setInterval(refresh,seconds*1000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[enabled,seconds,router]);
}
export function LiveRefresh({seconds=15}:{seconds?:number}){usePageRefresh(true,seconds);return null;}
