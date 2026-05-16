import Link from 'next/link';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import { groupLandlordInbox, resolveParticipant } from '@/lib/messaging/threads';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const [landlord, memberships, messages, tenants, vendors] = await Promise.all([
    prisma.landlordProfile.findUnique({ where: { id: landlordId }, select: { ownerUserId: true } }),
    prisma.landlordMembership.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, select: { userId: true } }),
    prisma.message.findMany({
      where: { landlordId },
      select: { id: true, senderId: true, receiverId: true, readAt: true, createdAt: true, subject: true, message: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.tenant.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, select: { id: true, fullName: true, userId: true } }),
    prisma.maintenanceVendor.findMany({ where: { landlordId, archivedAt: null, userId: { not: null } }, select: { id: true, name: true, userId: true } }),
  ]);

  const landlordUserIds = new Set<string>(memberships.map((m) => m.userId));
  if (landlord) landlordUserIds.add(landlord.ownerUserId);

  const tenantsByUserId = new Map(tenants.filter((t) => t.userId).map((t) => [t.userId as string, t]));
  const vendorsByUserId = new Map(vendors.filter((v) => v.userId).map((v) => [v.userId as string, v]));
  const groups = groupLandlordInbox(
    messages.map((m) => ({ id: m.id, senderId: m.senderId, receiverId: m.receiverId, readAt: m.readAt, createdAt: m.createdAt })),
    landlordUserIds,
  );

  const conversationTenantIds = new Set<string>();
  const conversationVendorIds = new Set<string>();
  const rows = groups
    .map((group) => {
      const ref = resolveParticipant(group.participantUserId, tenantsByUserId, vendorsByUserId);
      if (!ref) return null;
      if (ref.kind === 'TENANT') conversationTenantIds.add(ref.id);
      else conversationVendorIds.add(ref.id);
      const last = messages.find((m) => m.id === group.messages[group.messages.length - 1]?.id);
      const href = ref.kind === 'TENANT' ? `/messages/${ref.id}` : `/messages/vendor/${ref.id}`;
      return { ref, href, group, snippet: last?.message ?? '' };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const tenantsWithoutMessages = tenants.filter((t) => t.userId && !conversationTenantIds.has(t.id));
  const vendorsWithoutMessages = vendors.filter((v) => v.userId && !conversationVendorIds.has(v.id));
  const hasStartTargets = tenantsWithoutMessages.length > 0 || vendorsWithoutMessages.length > 0;

  return (
    <Shell title="Messages">
      <div className="space-y-6">
        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Conversations</h3>
          </div>
          {rows.length === 0 ? (
            <p className="p-4 text-slate-600">No conversations yet.</p>
          ) : (
            <ul className="divide-y">
              {rows.map(({ ref, href, group, snippet }) => (
                <li key={`${ref.kind}-${ref.id}`}>
                  <Link href={href} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {ref.name}
                        <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ref.kind === 'VENDOR' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {ref.kind === 'VENDOR' ? 'Vendor' : 'Tenant'}
                        </span>
                      </p>
                      <p className="text-sm text-slate-500 truncate max-w-md">{snippet}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-slate-500">{formatDate(group.lastAt, tz)}</p>
                      {group.unreadForLandlord > 0 ? (
                        <span className="inline-flex rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white mt-1">
                          {group.unreadForLandlord} new
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Start a conversation</h3>
          </div>
          {!hasStartTargets ? (
            <p className="p-4 text-slate-600">All active tenants and vendors with a linked login already have a conversation.</p>
          ) : (
            <ul className="divide-y">
              {tenantsWithoutMessages.map((tenant) => (
                <li key={`tenant-${tenant.id}`}>
                  <Link href={`/messages/${tenant.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <span>
                      {tenant.fullName}
                      <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Tenant</span>
                    </span>
                    <span className="text-sm text-brand-navy underline">Start conversation</span>
                  </Link>
                </li>
              ))}
              {vendorsWithoutMessages.map((vendor) => (
                <li key={`vendor-${vendor.id}`}>
                  <Link href={`/messages/vendor/${vendor.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <span>
                      {vendor.name}
                      <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Vendor</span>
                    </span>
                    <span className="text-sm text-brand-navy underline">Start conversation</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}
