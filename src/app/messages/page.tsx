import Link from 'next/link';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import { groupLandlordInbox } from '@/lib/messaging/threads';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const [landlord, memberships, messages, tenants] = await Promise.all([
    prisma.landlordProfile.findUnique({ where: { id: landlordId }, select: { ownerUserId: true } }),
    prisma.landlordMembership.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, select: { userId: true } }),
    prisma.message.findMany({
      where: { landlordId },
      select: { id: true, senderId: true, receiverId: true, readAt: true, createdAt: true, subject: true, message: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.tenant.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, select: { id: true, fullName: true, userId: true } }),
  ]);

  const landlordUserIds = new Set<string>(memberships.map((m) => m.userId));
  if (landlord) landlordUserIds.add(landlord.ownerUserId);

  const tenantsByUserId = new Map(tenants.filter((t) => t.userId).map((t) => [t.userId as string, t]));
  const groups = groupLandlordInbox(
    messages.map((m) => ({ id: m.id, senderId: m.senderId, receiverId: m.receiverId, readAt: m.readAt, createdAt: m.createdAt })),
    landlordUserIds,
  );

  const conversationTenantIds = new Set<string>();
  const rows = groups
    .map((group) => {
      const tenant = tenantsByUserId.get(group.tenantUserId);
      if (!tenant) return null;
      conversationTenantIds.add(tenant.id);
      const last = messages.find((m) => m.id === group.messages[group.messages.length - 1]?.id);
      return { tenant, group, snippet: last?.message ?? '' };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const withoutMessages = tenants.filter((t) => t.userId && !conversationTenantIds.has(t.id));

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
              {rows.map(({ tenant, group, snippet }) => (
                <li key={tenant.id}>
                  <Link href={`/messages/${tenant.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="font-medium">{tenant.fullName}</p>
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
          {withoutMessages.length === 0 ? (
            <p className="p-4 text-slate-600">All active tenants with a linked login already have a conversation.</p>
          ) : (
            <ul className="divide-y">
              {withoutMessages.map((tenant) => (
                <li key={tenant.id}>
                  <Link href={`/messages/${tenant.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <span>{tenant.fullName}</span>
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
