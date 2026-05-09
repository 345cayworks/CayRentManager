import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { assignUserRoleAction, disableUserAction, reactivateUserAction } from '@/server/actions';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireSuperadmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });

  return (
    <Shell title="Superadmin Users">
      <div className="rounded-xl bg-white border shadow-sm divide-y">
        {users.length === 0 ? <p className="p-4 text-slate-600">No users yet.</p> : null}
        {users.map((user) => (
          <div key={user.id} className="p-4 flex justify-between gap-4">
            <div>
              <p className="font-medium">{user.fullName ?? user.name ?? user.email}</p>
              <p className="text-sm text-slate-600">{user.email}</p>
            </div>
            <div className="text-right space-y-2">
              <p className="text-sm">{user.role} / {user.status}</p>
              <form action={assignUserRoleAction} className="flex gap-2 justify-end">
                <input type="hidden" name="userId" value={user.id} />
                <select name="role" defaultValue={user.role} className="text-sm rounded border px-2 py-1">
                  {Object.values(UserRole).map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <button className="text-sm rounded border px-3 py-1">Save</button>
              </form>
              <form action={user.status === 'DISABLED' ? reactivateUserAction : disableUserAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button className="text-sm rounded border px-3 py-1">{user.status === 'DISABLED' ? 'Reactivate' : 'Disable'}</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
