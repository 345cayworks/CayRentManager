import { UserStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { AdminActionButton } from '@/components/admin-action-button';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireSuperadmin();
  const [users, landlords, disabledUsers, auditEntries] = await Promise.all([
    prisma.user.count(),
    prisma.landlordProfile.count(),
    prisma.user.count({ where: { status: UserStatus.DISABLED } }),
    prisma.auditLog.count(),
  ]);

  const actions = [
    {
      href: '/admin/users',
      title: 'Manage Users',
      description: 'Roles, disabled accounts, and platform access.',
      badge: users,
      icon: '👥',
    },
    {
      href: '/admin/landlords',
      title: 'Manage Landlords',
      description: 'Workspaces, account status, and owner tools.',
      badge: landlords,
      icon: '🏢',
    },
    {
      href: '/admin/analytics',
      title: 'Platform Analytics',
      description: 'Growth, role distribution, top workspaces, and financial KPIs.',
      icon: '📈',
    },
    {
      href: '/admin/audit',
      title: 'Audit Logs',
      description: 'Filterable activity timeline by actor, action, and entity.',
      badge: auditEntries,
      icon: '📋',
    },
    {
      href: '/admin/safety',
      title: 'Safety Review',
      description: 'Live audit of platform guardrails and bootstrap policy state.',
      icon: '🛡️',
    },
    {
      href: '/admin/billing',
      title: 'Platform Financials',
      description: 'Subscription revenue, paid invoices, outstanding billing, and complimentary accounts.',
      icon: '💰',
    },
    {
      href: '/financials/rent-roll',
      title: 'Rent Roll',
      description: 'Rent collection and tenant payments.',
      icon: '📊',
    },
    {
      href: '/api/health',
      title: 'Health Check',
      description: 'System status and database connectivity.',
      icon: '❤️',
    },
    {
      href: '/api/identity/me',
      title: 'Current Session',
      description: 'Authentication session details.',
      icon: '🔐',
    },
  ];

  return (
    <Shell title="Superadmin Dashboard">
      <div className="space-y-6">
        <section className="grid gap-3 md:grid-cols-3">
          {[
            ['Users', users],
            ['Landlord Workspaces', landlords],
            ['Disabled Users', disabledUsers],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Quick Actions</h2>
              <p className="text-xs text-slate-500">Compact admin shortcuts for the most common control tasks.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
        </section>
      </div>
    </Shell>
  );
}
