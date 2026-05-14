import Link from 'next/link';
import { UserRole } from '@prisma/client';
import { getActiveUser } from '@/lib/auth/guards';
import { SignOutPanel } from '@/components/sign-out-panel';

const adminLinks = [
  ['/admin', 'Dashboard'],
  ['/admin/users', 'Users'],
  ['/admin/landlords', 'Landlords'],
  ['/admin/billing', 'Billing'],
  ['/admin/audit', 'Audit'],
];

const landlordLinks = [
  ['/dashboard', 'Dashboard'],
  ['/onboarding', 'Onboarding'],
  ['/alerts', 'Alerts'],
  ['/properties', 'Properties'],
  ['/units', 'Units'],
  ['/tenants', 'Tenants'],
  ['/leases', 'Leases'],
  ['/payments', 'Rent Payments'],
  ['/payments/settings', 'Rent Payment Settings'],
  ['/account/billing', 'Account Billing'],
  ['/maintenance', 'Maintenance'],
  ['/expenses', 'Expenses'],
  ['/documents', 'Documents'],
  ['/reports', 'Reports'],
];

const tenantLinks = [
  ['/tenant/dashboard', 'Dashboard'],
  ['/tenant/maintenance', 'Maintenance'],
];

const operationalLinks = [['/unauthorized', 'Access Pending']];

function linksForRole(role?: UserRole) {
  if (role === UserRole.SUPERADMIN) return adminLinks;
  if (role === UserRole.TENANT) return tenantLinks;
  if (role === UserRole.LANDLORD || role === UserRole.PROPERTY_MANAGER || role === UserRole.ACCOUNTANT) return landlordLinks;
  if (role === UserRole.VENDOR || role === UserRole.MAINTENANCE_PROVIDER || role === UserRole.CONCIERGE_AGENT || role === UserRole.GUEST) return operationalLinks;
  return [];
}

export async function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  const user = await getActiveUser();
  const links = linksForRole(user?.role);

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-brand-navy text-white p-4 flex flex-col">
        <h1 className="text-lg font-semibold mb-4">CayRentManager</h1>
        <nav className="space-y-2">
          {links.map(([href, label]) => (
            <Link key={href} className="block text-sm hover:underline" href={href}>
              {label}
            </Link>
          ))}
        </nav>
        {user && (
          <div className="mt-auto">
            <SignOutPanel email={user.email} role={user.role} name={user.name} />
          </div>
        )}
      </aside>
      <main className="p-6">
        <h2 className="text-2xl font-semibold mb-6">{title}</h2>
        {children}
      </main>
    </div>
  );
}
