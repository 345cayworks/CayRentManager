import { UserStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { AdminActionButton } from '@/components/admin-action-button';
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

  const actions = [
    {
      href: '/admin/users',
      title: 'Manage Users',
      description: 'Review roles, disabled accounts, and platform access.',
      badge: users,
      icon: '👥',
    },
    {
      href: '/admin/landlords',
      title: 'Manage Landlords',
      description: 'View landlord workspaces and portfolio ownership.',
      badge: landlords,
      icon: '🏢',
    },
    {
      href: '/admin/audit',
      title: 'Audit Logs',
      description: 'Review recent platform activity and admin actions.',
      icon: '📋',
    },
    {
      href: '/financials',
      title: 'Financial Overview',
      description: 'Inspect portfolio rent, expenses, balances, and cashflow.',
      icon: '💰',
    },
    {
      href: '/financials/rent-roll',
      title: 'Rent Roll',
      description: 'View detailed rent collection and tenant payments.',
      icon: '📊',
    },
    {
      href: '/api/health',
      title: 'Health Check',
      description: 'Check system status and database connectivity.',
      icon: '❤️',
    },
    {
      href: '/api/identity/me',
      title: 'Current Session',
      description: 'View your current authentication session details.',
      icon: '🔐',
    },
  ];

  return (
    <Shell title="Superadmin Dashboard">
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Platform Overview</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ['Users', users],
              ['Landlord Workspaces', landlords],
              ['Disabled Users', disabledUsers],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white border shadow-sm p-6">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-3xl font-semibold mt-2">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {actions.map((action) => (
              <AdminActionButton
                key={action.href}
                href={action.href}
                title={action.title}
                description={action.description}
                badge={action.badge}
                icon={action.icon}
              />
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
