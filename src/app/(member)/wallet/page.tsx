import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {requirePageSession} from '@/backend/auth/session';
import {getCurrentUser} from '@/backend/profiles/service';
import {wallet,walletPage} from '@/backend/wallet/service';
import {catalogueQuerySchema} from '@/shared/validation';
import {creditsLabel} from '@/shared/credits';
import {formatSessionTime} from '@/shared/time';
import {HttpError} from '@/backend/http';
const querySchema=catalogueQuerySchema.extend({kind:z.enum(['transactions','reservations']).default('transactions')});
export default async function WalletPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const {client,user}=await requirePageSession();const current=await getCurrentUser(client,user);if(!current.profile)redirect('/onboarding');
 const balance=await wallet(client);const parsed=querySchema.safeParse(Object.fromEntries(Object.entries(await searchParams).filter(([,value])=>value!==undefined&&value!=='')));
 let transactions;let holds;let cursor;let message='';
 if(!parsed.success)message='Invalid wallet filter or page. Reset the view to continue.';
 else try {
  if(parsed.data.kind==='transactions'){const page=await walletPage(client,user.id,'transactions',parsed.data);transactions=page.items;cursor=page.nextCursor;}
  else{const page=await walletPage(client,user.id,'reservations',parsed.data);holds=page.items;cursor=page.nextCursor;}
 }catch(error){if(error instanceof HttpError&&error.status===400)message=error.message;else throw error;}
 return <section><h1 className="text-3xl font-bold">Your wallet</h1><p className="mt-3 leading-7 text-slate-600">Verified members receive 3 starter credits once after onboarding. Earn credits by teaching; use them to learn. One credit equals 60 minutes.</p><div className="my-7 grid gap-4 sm:grid-cols-3">{[['Available',balance.availableUnits],['Reserved',balance.reservedUnits],['Total',balance.settledUnits]].map(([name,units])=><article key={name} className="rounded-2xl border border-emerald-900/15 bg-white p-6"><h2 className="font-semibold">{name}</h2><p data-testid={`wallet-${String(name).toLowerCase()}`} className="mt-3 text-2xl font-bold text-emerald-800">{creditsLabel(Number(units))}</p></article>)}</div><p className="rounded-xl bg-amber-50 p-4 text-sm leading-6">Reservations reduce available credits without transferring them. Disputed credits stay held indefinitely until both participants agree to complete or cancel. Ending a call transfers nothing.</p><nav aria-label="Wallet views" className="my-6 flex flex-wrap gap-4"><Link href="/wallet" className="min-h-11 py-3 font-semibold text-emerald-800 underline">History</Link><Link href="/wallet?kind=reservations" className="min-h-11 py-3 font-semibold text-emerald-800 underline">Active reservations</Link><Link href="/bookings" className="min-h-11 py-3 text-emerald-800 underline">Your bookings</Link></nav>{message&&<p role="status">{message} <Link href="/wallet" className="underline">Reset wallet</Link></p>}
 {transactions&&<section><h2 className="text-xl font-semibold">Credit history</h2>{!transactions.length&&<p className="mt-4">No credit entries yet.</p>}<ul className="mt-5 space-y-3">{transactions.map(entry=><li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-5"><div><p className="font-semibold">{entry.kind==='starter_grant'?'Starter credits':entry.deltaUnits>0?'Teaching session earned':'Learning session spent'}</p><p className="mt-1 text-sm text-slate-500">{formatSessionTime(entry.createdAt,current.timezone)} · {current.timezone}</p>{entry.bookingId&&<Link className="mt-2 inline-flex min-h-11 items-center text-emerald-800 underline" href={`/bookings/${entry.bookingId}`}>View booking</Link>}</div><p className="font-bold">{entry.deltaUnits>0?'+':''}{creditsLabel(entry.deltaUnits)}</p></li>)}</ul></section>}
 {holds&&<section><h2 className="text-xl font-semibold">Active credit reservations</h2>{!holds.length&&<p className="mt-4">No credits are currently reserved.</p>}<ul className="mt-5 space-y-3">{holds.map(hold=><li key={hold.bookingId} className="rounded-xl bg-white p-5"><p className="font-semibold">{creditsLabel(hold.units)} · {hold.bookingState}</p>{hold.bookingState==='disputed'&&<p className="mt-2 text-sm">Held until both agree; no automatic timeout.</p>}<Link href={`/bookings/${hold.bookingId}`} className="mt-2 inline-flex min-h-11 items-center text-emerald-800 underline">View reserved booking</Link></li>)}</ul></section>}
 {cursor&&parsed.success&&<Link className="mt-6 inline-flex min-h-11 items-center underline" href={`/wallet?${new URLSearchParams({kind:parsed.data.kind,cursor,limit:String(parsed.data.limit)})}`}>Next entries</Link>}
 </section>;
}
