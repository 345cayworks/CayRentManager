import { UserRole } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireRole } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { sendTenantMessageAction, markMessagesReadAction } from '@/server/actions';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import { unreadCount } from '@/lib/messaging/threads';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireRole([UserRole.TENANT, UserRole.SUPERADMIN]);
  const tz = await getEffectiveTimezone();
  const tenant = await prisma.tenant.findFirst({
    where: user.role === UserRole.SUPERADMIN ? {} : { userId: user.userId },
    include: { landlord: true },
  });

  if (!tenant || !tenant.userId) {
    return (
      <Shell title="Tenant Messages">
        <div className="rounded-xl bg-white border shadow-sm p-6 text-slate-600">No tenant profile is linked to this account.</div>
      </Shell>
    );
  }

  const tenantUserId = tenant.userId;
  const messages = await prisma.message.findMany({
    where: {
      landlordId: tenant.landlordId,
      OR: [{ senderId: tenantUserId }, { receiverId: tenantUserId }],
    },
    include: { sender: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const unread = unreadCount(
    messages.map((m) => ({ id: m.id, senderId: m.senderId, receiverId: m.receiverId, readAt: m.readAt, createdAt: m.createdAt })),
    tenantUserId,
  );

  return (
    <Shell title="Tenant Messages">
      <div className="space-y-6">
        <section className="rounded-xl bg-white border shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Conversation with {tenant.landlord.displayName}</h3>
              <p className="text-sm text-slate-500">{unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'All messages read'}</p>
            </div>
            {unread > 0 ? (
              <form action={markMessagesReadAction}>
                <button className="rounded border px-3 py-1.5 text-sm">Mark read</button>
              </form>
            ) : null}
          </div>

          <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-600">No messages yet. Start the conversation below.</p>
            ) : (
              messages.map((message) => {
                const mine = message.senderId === tenantUserId;
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg border p-3 text-sm ${mine ? 'bg-brand-navy text-white border-brand-navy' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${mine ? 'text-slate-200' : 'text-slate-500'}`}>
                        {mine ? 'You' : message.sender.name ?? message.sender.email} · {formatDate(message.createdAt, tz)}
                      </p>
                      {message.subject ? <p className="font-medium mt-1">{message.subject}</p> : null}
                      <p className="mt-1 whitespace-pre-wrap">{message.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white border shadow-sm p-6">
          <h3 className="font-semibold">Send a message</h3>
          <form action={sendTenantMessageAction} className="mt-4 space-y-3">
            <input name="subject" placeholder="Subject (optional)" maxLength={150} className="w-full border rounded px-3 py-2" />
            <textarea required name="message" placeholder="Write your message…" maxLength={4000} rows={4} className="w-full border rounded px-3 py-2" />
            <button className="rounded bg-brand-navy text-white px-4 py-2">Send</button>
          </form>
        </section>
      </div>
    </Shell>
  );
}
