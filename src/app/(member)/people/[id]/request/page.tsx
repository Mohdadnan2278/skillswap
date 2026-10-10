import Link from "next/link";
import { redirect,notFound } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
import { allSkills,selections } from "@/backend/skills/service";
import { userIdSchema } from "@/shared/validation";
import { BookingNotice } from "@/frontend/components/booking-notice";
import { BookingRequestForm } from "@/frontend/components/booking-request-form";
import { wallet } from "@/backend/wallet/service";
import { HttpError } from "@/backend/http";
export default async function RequestSession({params}:{params:Promise<{id:string}>}) {
 const {client,user}=await requirePageSession();const {id}=await params;
 if (!userIdSchema.safeParse(id).success) notFound();if(id===user.id)redirect('/profile');
 const current=await getCurrentUser(client,user);if(!current.profile)redirect('/onboarding');
 const {data:teacher,error}=await client.from('profiles').select('display_name').eq('id',id).maybeSingle();
 if(error)throw new HttpError(503,'DATABASE_UNAVAILABLE','Member storage is unavailable.');if(!teacher)notFound();
 const balance=await wallet(client);
 const [catalogue,choices]=await Promise.all([allSkills(client),selections(client,id)]);const offered=catalogue.filter(skill=>choices.offeredSkillIds.includes(skill.id));
 return <section className="mx-auto max-w-xl"><Link href={`/people/${id}`} className="inline-flex min-h-11 items-center text-emerald-800 underline">Back to member</Link><h1 className="mt-4 break-words text-3xl font-bold">Request a session with {teacher.display_name}</h1><BookingNotice />{offered.length?<BookingRequestForm teacherId={id} teacherName={teacher.display_name} skills={offered} timezone={current.timezone} availableUnits={balance.availableUnits}/>:<p>This member does not currently offer any enabled skills.</p>}</section>;
}
