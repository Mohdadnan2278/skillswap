import {requireAdminPage,readAdmin} from '@/backend/admin/service';
import {adminQuerySchema} from '@/shared/admin';
import {AdminPanel} from '@/frontend/components/admin-panel';
export default async function AdminPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {client,user}=await requireAdminPage();const parsed=adminQuerySchema.safeParse(await searchParams);
 if(!parsed.success)return <section><h1 className="text-3xl font-bold">Administration</h1><p className="mt-4">This page filter is invalid.</p><a className="mt-4 inline-block underline" href="/admin">Start again</a></section>;
 const q=parsed.data;return <AdminPanel query={q} data={await readAdmin(client,q)} actorId={user.id}/>;
}
