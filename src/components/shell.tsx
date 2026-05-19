import Link from 'next/link';
import { LeaseAlertSnapshotStatus, RecordStatus, UserRole } from '@prisma/client';
import { getActiveUser, getUserLandlordMemberships } from '@/lib/auth/guards';
import { getActiveLandlordWorkspace } from '@/lib/auth/workspace';
import { prisma } from '@/lib/db/prisma';
import { getOnboardingState } from '@/lib/onboarding/state';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { SignOutPanel } from '@/components/sign-out-panel';
import { MobileNav } from '@/components/mobile-nav';
import { Toaster } from '@/components/ui/toaster';

type NavLink = { href: string; label: string; badge?: number };

const adminLinks: NavLink[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/landlords', label: 'Landlords' },
  { href: '/admin/vendors', label: 'Vendors' },
  { href: '/admin/vendor-portal', label: 'Vendor Portal' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/growth', label: 'Growth' },
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
  { href: '/applications', label: 'Applications' },
  { href: '/messages', label: 'Messages' },
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
  { href: '/tenant/lease', label: 'Lease' },
  { href: '/tenant/payments', label: 'Payments' },
  { href: '/tenant/maintenance', label: 'Maintenance' },
  { href: '/tenant/documents', label: 'Documents' },
  { href: '/tenant/messages', label: 'Messages' },
  { href: '/account/profile', label: 'Profile' },
];

const operationalLinks: NavLink[] = [{ href: '/unauthorized', label: 'Access Pending' }];

const vendorLinks: NavLink[] = [
  { href: '/vendor/dashboard', label: 'Dashboard' },
  { href: '/vendor/dashboard?tab=completed', label: 'Completed Work' },
  { href: '/vendor/messages', label: 'Messages' },
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

  let unreadMessages = 0;
  try {
    const [landlord, memberships] = await Promise.all([
      prisma.landlordProfile.findUnique({ where: { id: landlordId }, select: { ownerUserId: true } }),
      prisma.landlordMembership.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, select: { userId: true } }),
    ]);
    const landlordUserIds = memberships.map((m) => m.userId);
    if (landlord) landlordUserIds.push(landlord.ownerUserId);
    unreadMessages = await prisma.message.count({
      where: { landlordId, receiverId: { in: landlordUserIds }, readAt: null },
    });
  } catch {
    unreadMessages = 0;
  }

  if (activeAlertCount === 0 && onboardingBadge === 0 && unreadMessages === 0) return baseLandlordLinks;

  return baseLandlordLinks.map((link) => {
    if (link.href === '/alerts' && activeAlertCount > 0) {
      return { ...link, badge: activeAlertCount };
    }
    if (link.href === '/onboarding' && onboardingBadge > 0) {
      return { ...link, badge: onboardingBadge };
    }
    if (link.href === '/messages' && unreadMessages > 0) {
      return { ...link, badge: unreadMessages };
    }
    return link;
  });
}

async function tenantLinksWithMessageBadge(userId: string): Promise<NavLink[]> {
  let unread = 0;
  try {
    unread = await prisma.message.count({ where: { receiverId: userId, readAt: null } });
  } catch {
    return tenantLinks;
  }
  if (unread === 0) return tenantLinks;
  return tenantLinks.map((link) =>
    link.href === '/tenant/messages' ? { ...link, badge: unread } : link,
  );
}

async function vendorLinksWithMessageBadge(userId: string): Promise<NavLink[]> {
  let unread = 0;
  try {
    unread = await prisma.message.count({ where: { receiverId: userId, readAt: null } });
  } catch {
    return vendorLinks;
  }
  if (unread === 0) return vendorLinks;
  return vendorLinks.map((link) =>
    link.href === '/vendor/messages' ? { ...link, badge: unread } : link,
  );
}

async function linksForRole(role: UserRole | undefined, userId: string | undefined): Promise<NavLink[]> {
  if (!role) return [];
  if (role === UserRole.SUPERADMIN) return adminLinks;
  if (role === UserRole.TENANT) {
    if (!userId) return tenantLinks;
    return tenantLinksWithMessageBadge(userId);
  }
  if (LANDLORD_ROLES.has(role)) {
    if (!userId) return baseLandlordLinks;
    return landlordLinksWithAlertBadge(userId);
  }
  if (VENDOR_PORTAL_ROLES.has(role)) {
    if (!userId) return vendorLinks;
    return vendorLinksWithMessageBadge(userId);
  }
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
  let timezone: string | null = null;
  if (user) {
    try {
      timezone = await getEffectiveTimezone();
    } catch {
      timezone = null;
    }
  }

  const navContent = (
    <>
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
          {timezone && (
            <p className="mb-2 text-xs text-slate-400">Times shown in {timezone}</p>
          )}
          <SignOutPanel email={user.email} role={user.role} name={user.name} />
        </div>
      )}
    </>
  );

  const brand = (
    <span className="inline-flex items-center gap-2">
      CayRentManager
      <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
        Beta
      </span>
    </span>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <MobileNav title={brand}>{navContent}</MobileNav>
      <aside className="hidden bg-brand-navy text-white p-4 md:flex md:flex-col">
        <h1 className="text-lg font-semibold mb-4">{brand}</h1>
        {navContent}
      </aside>
      <main className="w-full p-6">
        <Toaster />
        <h2 className="text-2xl font-semibold mb-6">{title}</h2>
        {children}
      </main>
    </div>
  );
}
