import Link from 'next/link';
import { LeaseAlertSnapshotStatus, RecordStatus, UserRole } from '@prisma/client';
import { getActiveUser, getUserLandlordMemberships } from '@/lib/auth/guards';
import { getActiveLandlordWorkspace } from '@/lib/auth/workspace';
import { prisma } from '@/lib/db/prisma';
import { getOnboardingState } from '@/lib/onboarding/state';
import { SignOutPanel } from '@/components/sign-out-panel';

type NavLink = { href: string; label: string; badge?: number };

const adminLinks: NavLink[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/landlords', label: 'Landlords' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/audit', label: 'Audit' },
  { href: '/admin/safety', label: 'Safety' },
  { href: '/account/profile', label: 'Profile' },
];

const baseLandlordLinks: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/properties', label: 'Properties' },
  { href: '/units', label: 'Units' },
  { href: '/tenants', label: 'Tenants' },
  { href: '/leases', label: 'Leases' },
  { href: '/payments', label: 'Rent Payments' },
  { href: '/payments/settings', label: 'Rent Payment Settings' },
  { href: '/account/billing', label: 'Account Billing' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/maintenance', label: 'Maintenance' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/documents', label: 'Documents' },
  { href: '/reports', label: 'Reports' },
];

const tenantLinks: NavLink[] = [
  { href: '/tenant/dashboard', label: 'Dashboard' },
  { href: '/tenant/maintenance', label: 'Maintenance' },
  { href: '/account/profile', label: 'Profile' },
];

const operationalLinks: NavLink[] = [{ href: '/unauthorized', label: 'Access Pending' }];

const vendorLinks: NavLink[] = [
  { href: '/vendor/dashboard', label: 'Dashboard' },
  { href: '/vendor/dashboard?tab=completed', label: 'Completed Work' },
  { href: '/account/profile', label: 'Profile' },
];

const LANDLORD_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.LANDLORD,
  UserRole.PROPERTY_MANAGER,
  UserRole.ACCOUNTANT,
]);

const VENDOR_PORTAL_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.VENDOR,
  UserRole.MAINTENANCE_PROVIDER,
]);

const OPERATIONAL_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.CONCIERGE_AGENT,
  UserRole.GUEST,
]);

async function landlordLinksWithAlertBadge(userId: string): Promise<NavLink[]> {
  const memberships = await getUserLandlordMemberships(userId);
  const landlordId = getActiveLandlordWorkspace(memberships.map((m) => m.landlordId));
  if (!landlordId) return baseLandlordLinks;

  let activeAlertCount = 0;
  try {
    activeAlertCount = await prisma.leaseAlertSnapshot.count({
      where: { landlordId, status: LeaseAlertSnapshotStatus.ACTIVE },
    });
  } catch {
    // Alerts table missing or unreachable → render nav without the badge.
    return baseLandlordLinks;
  }

  let onboardingBadge = 0;
  try {
    const state = await getOnboardingState(landlordId);
    if (state.shouldNudge && state.remainingCount > 0) {
      onboardingBadge = state.remainingCount;
    }
  } catch {
    // Onboarding state unreachable → render nav without the badge.
    onboardingBadge = 0;
  }

  if (activeAlertCount === 0 && onboardingBadge === 0) return baseLandlordLinks;

  return baseLandlordLinks.map((link) => {
    if (link.href === '/alerts' && activeAlertCount > 0) {
      return { ...link, badge: activeAlertCount };
    }
    if (link.href === '/onboarding' && onboardingBadge > 0) {
      return { ...link, badge: onboardingBadge };
    }
    return link;
  });
}

async function linksForRole(role: UserRole | undefined, userId: string | undefined): Promise<NavLink[]> {
  if (!role) return [];
  if (role === UserRole.SUPERADMIN) return adminLinks;
  if (role === UserRole.TENANT) return tenantLinks;
  if (LANDLORD_ROLES.has(role)) {
    if (!userId) return baseLandlordLinks;
    return landlordLinksWithAlertBadge(userId);
  }
  if (VENDOR_PORTAL_ROLES.has(role)) return vendorLinks;
  if (OPERATIONAL_ROLES.has(role)) return operationalLinks;
  return [];
}

function Badge({ count }: { count: number }) {
  return (
    <span
      className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
      aria-label={`${count} active alerts`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export async function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  const user = await getActiveUser();
  const links = await linksForRole(user?.role, user?.userId);

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-brand-navy text-white p-4 flex flex-col">
        <h1 className="text-lg font-semibold mb-4">CayRentManager</h1>
        <nav className="space-y-2">
          {links.map((link) => (
            <Link
              key={link.href}
              className="flex items-center justify-between text-sm hover:underline"
              href={link.href}
            >
              <span>{link.label}</span>
              {link.badge ? <Badge count={link.badge} /> : null}
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
