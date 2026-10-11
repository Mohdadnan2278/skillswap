"use client";
import {useEffect,useRef,useState} from 'react';
import type {ApiResponse,MeetingAccess,Booking} from '@/shared/contracts';
type JitsiApi={addEventListeners:(events:Record<string,()=>void>)=>void;executeCommand:(command:string)=>void;dispose:()=>void};
type JitsiConstructor=new(domain:string,options:{roomName:string;parentNode:HTMLElement;width:string;height:string;configOverwrite:Record<string,unknown>})=>JitsiApi;
declare global{interface Window{JitsiMeetExternalAPI?:JitsiConstructor}}
let scriptPromise:Promise<JitsiConstructor>|null=null;
function loadJitsi():Promise<JitsiConstructor>{
 if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://meet.jit.si/external_api.js';script.async=true;script.referrerPolicy='no-referrer';
  const timeout=setTimeout(()=>failed(),15000);
  const failed=()=>{clearTimeout(timeout);script.remove();scriptPromise=null;reject(Error('Jitsi could not load'));};
  script.onerror=failed;script.onload=()=>{clearTimeout(timeout);if(window.JitsiMeetExternalAPI)resolve(window.JitsiMeetExternalAPI);else failed();};document.head.appendChild(script);
 });return scriptPromise;
}
export function MeetingClient({id,allowed,configured}:{id:string;allowed:boolean;configured:boolean}){
 const host=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),call=useRef<JitsiApi|null>(null),alive=useRef(true),deadline=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [blocked,setBlocked]=useState(false);
 const [camera,setCamera]=useState(true),[mic,setMic]=useState(true),[busy,setBusy]=useState(false),[active,setActive]=useState(false),[checking,setChecking]=useState(false),[message,setMessage]=useState(''),[roomUrl,setRoomUrl]=useState<string|null>(null);
 function stopPreview(){stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;}
 function destroy(){const frame=call.current;call.current=null;if(deadline.current)clearTimeout(deadline.current);deadline.current=null;frame?.dispose();if(alive.current){setActive(false);setBusy(false);}}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;stream.current?.getTracks().forEach(track=>track.stop());if(deadline.current)clearTimeout(deadline.current);call.current?.dispose();call.current=null;};},[]);
 useEffect(()=>{
  if(!active)return;
  const controller=new AbortController();let reading=false;
  const inspect=async()=>{if(reading)return;reading=true;try{const r=await fetch(`/api/v1/bookings/${id}`,{cache:'no-store',signal:controller.signal});const result:ApiResponse<Booking>=await r.json();if([401,403,404].includes(r.status)||('data' in result&&(result.data.state!=='accepted'||result.data.creditReservationStatus!=='held'))){destroy();setRoomUrl(null);if(alive.current){setBlocked(true);setMessage('This booking is no longer available for calls through SkillSwap. Return to the booking to see its status.');}}}catch{}finally{reading=false;}};
  const interval=setInterval(inspect,15000);const online=()=>setMessage('Connection restored. Jitsi will try to reconnect; leave and rejoin if needed.');const offline=()=>setMessage('Your connection dropped. Keep this page open to reconnect, or leave and rejoin.');window.addEventListener('online',online);window.addEventListener('offline',offline);
  return()=>{clearInterval(interval);controller.abort();window.removeEventListener('online',online);window.removeEventListener('offline',offline);};
 },[active,id]);
 async function checkDevices(){stopPreview();setChecking(true);setMessage('');try{
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('unsupported');
  if(!camera&&!mic){setMessage('Camera and microphone are off. You can enable them in Jitsi.');return;}
  const media=await navigator.mediaDevices.getUserMedia({video:camera,audio:mic});if(!alive.current){media.getTracks().forEach(track=>track.stop());return;}stream.current=media;if(video.current)video.current.srcObject=media;setMessage('Device check ready. Your preview stays on this device; join when you are ready.');
 }catch(error){if(alive.current)setMessage(error instanceof DOMException&&error.name==='NotAllowedError'?'Camera or microphone permission was denied. Allow access in browser settings, or switch off that device and retry.':'Could not access the selected devices. Check your browser, HTTPS connection and device settings, then retry.');}finally{if(alive.current)setChecking(false);}}
 async function join(){setBusy(true);setMessage('');stopPreview();try{
  if(!window.isSecureContext){setMessage('Video needs a secure HTTPS connection. Open SkillSwap in a supported browser.');return;}
  const r=await fetch(`/api/v1/bookings/${id}/meeting-access`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const result:ApiResponse<MeetingAccess>=await r.json();if('error' in result){setMessage(result.error.message);if([401,403,404,409].includes(r.status))setBlocked(true);return;}if(!alive.current)return;
  const receivedAt=performance.now();const access=result.data;if(access.provider!=='jitsi_demo'||access.serverOrigin!=='https://meet.jit.si'||!/^skillswap-[0-9a-f]{32}$/.test(access.roomReference))throw Error('Invalid call');
  const url=`https://meet.jit.si/${access.roomReference}`;setRoomUrl(url);const Jitsi=await loadJitsi();if(!alive.current||!host.current)return;
  destroy();const frame=new Jitsi('meet.jit.si',{roomName:access.roomReference,parentNode:host.current,width:'100%',height:'100%',configOverwrite:{prejoinConfig:{enabled:true},startWithAudioMuted:!mic,startWithVideoMuted:!camera,disableDeepLinking:true,disableInviteFunctions:true,disableThirdPartyRequests:true,analytics:{disabled:true},toolbarButtons:['microphone','camera','hangup','settings','tileview','fullscreen']}});call.current=frame;setActive(true);setBusy(true);
  const left=()=>{if(call.current!==frame)return;destroy();if(alive.current)setMessage('You left the call. Rejoin while eligible, or return to confirm completion after its scheduled end.');};
  frame.addEventListeners({videoConferenceJoined:()=>{if(alive.current){setBusy(false);setMessage('Connected to Jitsi. Leaving transfers no credits.');}},videoConferenceLeft:left,readyToClose:left,errorOccurred:()=>{if(alive.current){setBusy(false);setMessage('Jitsi reported a problem. Check your connection, or try the new-tab option.');}},cameraError:()=>{if(alive.current)setMessage('Camera unavailable. Check permissions or choose another device in Jitsi.');},micError:()=>{if(alive.current)setMessage('Microphone unavailable. Check permissions or choose another device in Jitsi.');}});
  const remaining=Date.parse(access.roomClosesAt)-Date.parse(access.serverNow)-(performance.now()-receivedAt);deadline.current=setTimeout(()=>{destroy();setRoomUrl(null);if(alive.current){setBlocked(true);setMessage('The SkillSwap call window has ended. Return to your booking.');}},Math.max(0,remaining));
 }catch{destroy();if(alive.current)setMessage('Could not load the call. Check your connection, retry, or open Jitsi in a new tab.');}finally{if(alive.current)setBusy(false);}}
 return <div><p className="mt-4 rounded-xl bg-amber-50 p-4 leading-6" role="note">This call uses public Jitsi Meet. Anyone who obtains the room link may be able to join outside SkillSwap. Do not share private information. The first participant may need to sign in to Jitsi to start the room.</p><p className="mt-4 leading-7 text-slate-600">Check your camera and microphone before joining. You can change devices or mute in Jitsi. If your connection drops, keep the page open to reconnect or leave and rejoin.</p>
 {!configured&&<p role="status" className="mt-5 rounded-xl bg-amber-50 p-4">Video setup is pending. Your booking and reserved credits are safe.</p>}
 {!active&&<section className="mt-6 rounded-2xl border border-emerald-900/15 bg-white p-5"><h2 className="text-xl font-semibold">Before you join</h2><div className="my-4 flex flex-wrap gap-6"><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={camera} disabled={busy||checking} onChange={e=>{stopPreview();setCamera(e.target.checked);}}/>Use camera</label><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={mic} disabled={busy||checking} onChange={e=>{stopPreview();setMic(e.target.checked);}}/>Use microphone</label></div><video ref={video} autoPlay muted playsInline aria-label="Your local camera preview" className="aspect-video w-full rounded-xl bg-slate-900"/><div className="mt-4 flex flex-wrap gap-3"><button type="button" className="secondary-button" disabled={busy||checking} onClick={checkDevices}>{checking?'Checking devices…':'Check devices'}</button><button type="button" className="secondary-button" onClick={stopPreview}>Stop preview</button><button type="button" className="secondary-button" disabled={busy||checking} onClick={()=>window.location.reload()}>Refresh access</button><button type="button" className="primary-button" disabled={busy||checking||!allowed||!configured||blocked} onClick={join}>{busy?'Connecting…':'Join call'}</button></div></section>}
 <div ref={host} className={active?'mt-6 h-[70vh] min-h-96 w-full':'hidden'}/>{active&&<button className="secondary-button mt-4" type="button" onClick={()=>{destroy();setMessage('You left the call. No credits were transferred.');}}>Leave call</button>}
 {roomUrl&&<a className="mt-4 inline-flex min-h-11 items-center text-emerald-800 underline" href={roomUrl} target="_blank" rel="noopener noreferrer">Open Jitsi in a new tab</a>}
 {message&&<p role="status" className="mt-5 rounded-xl bg-slate-100 p-4 leading-6">{message}</p>}<p className="mt-6 text-sm leading-6 text-slate-600">SkillSwap allows joining your call from 10 minutes before start to 15 minutes after end. A public Jitsi link can remain usable outside that window. Joining or leaving transfers no credits; both people must confirm on the booking after its scheduled end.</p></div>;
}
