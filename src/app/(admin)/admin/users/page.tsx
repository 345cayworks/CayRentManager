import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { assignUserRoleAction, disableUserAction, reactivateUserAction } from '@/server/actions';
import { UserRole, UserStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  PENDING_INVITE: 'bg-amber-50 text-amber-700 ring-amber-100',
  INVITED: 'bg-amber-50 text-amber-700 ring-amber-100',
  SUSPENDED: 'bg-red-50 text-red-700 ring-red-100',
  DISABLED: 'bg-slate-100 text-slate-700 ring-slate-200',
  INACTIVE: 'bg-slate-50 text-slate-600 ring-slate-200',
};

function formatDate(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default async function Page() {
  await requireSuperadmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });

  const activeCount = users.filter((user) => user.status === UserStatus.ACTIVE).length;
  const disabledCount = users.filter((user) => user.status === UserStatus.DISABLED).length;
  const landlordCount = users.filter((user) => user.role === UserRole.LANDLORD).length;

  return (
    <Shell title="Superadmin Users">
      <div className="space-y-4">
        <section className="grid gap-3 md:grid-cols-3">
          {[
            ['Active', activeCount],
            ['Landlords', landlordCount],
            ['Disabled', disabledCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">User Directory</h3>
              <p className="text-xs text-slate-500">Showing latest {users.length} platform users.</p>
            </div>
          </div>

          {users.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No users yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">User</th>
                    <th className="px-4 py-2 font-semibold">Role</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 font-semibold">Created</th>
                    <th className="px-4 py-2 font-semibold text-right">Role Action</th>
                    <th className="px-4 py-2 font-semibold text-right">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <div className="font-medium leading-5 text-slate-950">{user.fullName ?? user.name ?? user.email}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{user.role}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusStyles[user.status] ?? 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <form action={assignUserRoleAction} className="flex justify-end gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <select name="role" defaultValue={user.role} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700">
                            {Object.values(UserRole).map((role) => <option key={role} value={role}>{role}</option>)}
                          </select>
                          <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Save</button>
                        </form>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <form action={user.status === UserStatus.DISABLED ? reactivateUserAction : disableUserAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            {user.status === UserStatus.DISABLED ? 'Reactivate' : 'Disable'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
