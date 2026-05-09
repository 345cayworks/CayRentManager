import { UserStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireSuperadmin();
  const [users, landlords, disabledUsers] = await Promise.all([
    prisma.user.count(),
    prisma.landlordProfile.count(),
    prisma.user.count({ where: { status: UserStatus.DISABLED } }),
  ]);

  return (
    <Shell title="Superadmin Dashboard">
      <div className="grid md:grid-cols-3 gap-4">
        {[['Users', users], ['Landlord Workspaces', landlords], ['Disabled Users', disabledUsers]].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white border shadow-sm p-6">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-3xl font-semibold mt-2">{value}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}
