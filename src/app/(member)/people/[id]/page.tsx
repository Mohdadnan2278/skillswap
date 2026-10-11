import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { selectedSkills, selections } from "@/backend/skills/service";
import { userIdSchema } from "@/shared/validation";
import { HttpError } from "@/backend/http";
import {receivedFeedback,reputations} from '@/backend/feedback/service';
import {ReputationLabel} from '@/frontend/components/reputation';
import {catalogueQuerySchema} from '@/shared/validation';
export default async function MemberProfile({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<Record<string,string|string[]|undefined>> }) {
  const { client, user } = await requirePageSession();
  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) notFound();
  if (id === user.id) redirect("/profile");
  const { data: profile, error } = await client.from("profiles").select("display_name,bio,college").eq("id", id).maybeSingle();
  if (error) throw new HttpError(503, "DATABASE_UNAVAILABLE", "Profile storage is temporarily unavailable.");
  if (!profile) notFound();
  const query=catalogueQuerySchema.safeParse(await searchParams);
  if(!query.success)return <section><p>Invalid feedback page link.</p><Link href={`/people/${id}`} className="secondary-button inline-flex">Start again</Link></section>;
  let scores,reviews;try{[scores,reviews]=await Promise.all([reputations(client,[id]),receivedFeedback(client,id,query.data)]);}catch(e){if(e instanceof HttpError&&e.status===400)return <section><p>Invalid feedback page link.</p><Link href={`/people/${id}`} className="secondary-button inline-flex">Start again</Link></section>;throw e;}
  const reviewerIds=[...new Set(reviews.items.map(item=>item.reviewerId))];
  const reviewers=reviewerIds.length?await client.from('profiles').select('id,display_name').in('id',reviewerIds):{data:[],error:null};
  if(reviewers.error)throw new HttpError(503,'DATABASE_UNAVAILABLE','Reviewer names are unavailable.');
  const own=await selections(client,id);
  const offered=await selectedSkills(client,own.offeredSkillIds);
  return <section className="mx-auto max-w-2xl"><Link className="inline-flex min-h-11 items-center text-accent-strong underline" href="/discover">Back to discovery</Link><h1 className="mt-5 break-words text-3xl font-bold">{profile.display_name}</h1>{profile.college && <p className="mt-3 break-words text-subtle">{profile.college}</p>}<p className="mt-5 break-words whitespace-pre-wrap leading-7">{profile.bio || "This member has not added a bio yet."}</p><h2 className="mt-8 text-xl font-semibold">Can teach</h2>{offered.length ? <ul className="mt-4 flex flex-wrap gap-2">{offered.map(skill => <li key={skill.id} className="rounded-full bg-selected px-4 py-2 text-accent-deep">{skill.name}</li>)}</ul> : <p className="mt-3">No offered skills selected yet.</p>}{offered.length>0&&<Link href={`/people/${id}/request`} className="primary-button mt-7 inline-flex">Request a session</Link>}<ReputationLabel value={scores.get(id)??{averageRating:null,ratingCount:0}}/><h2 className="mt-8 text-xl font-semibold">Session feedback</h2>{reviews.items.length?<ul className="mt-4 space-y-4">{reviews.items.map(review=><li key={review.id} className="rounded-xl border p-4"><p className="font-semibold">{review.rating} / 5 stars · {reviewers.data?.find(p=>p.id===review.reviewerId)?.display_name??'Member'}</p>{review.comment&&<p className="mt-3 break-words whitespace-pre-wrap">{review.comment}</p>}</li>)}</ul>:<p className="mt-4">No feedback on this page yet.</p>}{reviews.nextCursor&&<Link className="secondary-button mt-5 inline-flex" href={`/people/${id}?cursor=${encodeURIComponent(reviews.nextCursor)}&limit=${query.data.limit}`}>More feedback</Link>}</section>;
}
