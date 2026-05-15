import Link from 'next/link';
import { Shell } from '@/components/shell';
import { requireAuthAllowPasswordChange } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { updateUserProfileAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const auth = await requireAuthAllowPasswordChange();

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      name: true,
      fullName: true,
      phone: true,
      role: true,
      status: true,
      mustChangePassword: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    return (
      <Shell title="Profile">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Profile not found.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Profile">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-950">Account</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                <p className="text-sm text-slate-900">{user.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
                <p className="text-sm text-slate-900">{user.role}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <p className="text-sm text-slate-900">{user.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Member since</p>
                <p className="text-sm text-slate-900">
                  {user.createdAt.toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Last login</p>
                <p className="text-sm text-slate-900">
                  {user.lastLoginAt ? user.lastLoginAt.toLocaleString() : '—'}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Email, role, and status are managed by the platform and cannot be edited here. To
              change your sign-in email, contact a platform administrator.
            </p>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-950">Edit profile</h3>
            <form action={updateUserProfileAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-slate-500">Display name</span>
                <input
                  name="name"
                  defaultValue={user.name ?? ''}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Full legal name</span>
                <input
                  name="fullName"
                  defaultValue={user.fullName ?? ''}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-slate-500">Phone</span>
                <input
                  name="phone"
                  type="tel"
                  defaultValue={user.phone ?? ''}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white"
                >
                  Save profile
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-950">Security</h3>
            <div className="mt-3 space-y-2">
              <Link href="/change-password" className="block text-sm text-brand-navy">
                Change password
              </Link>
              {user.mustChangePassword && (
                <p className="text-xs text-amber-700">
                  A password change is required before continuing.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </Shell>
  );
}
