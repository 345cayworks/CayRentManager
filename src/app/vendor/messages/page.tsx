import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireVendorUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { sendVendorPortalMessageAction, markMessagesReadAction } from '@/server/actions';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import { sortChronological, unreadCount } from '@/lib/messaging/threads';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { user, vendor } = await requireVendorUser();
  const tz = await getEffectiveTimezone();

  const [landlord, memberships, messages] = await Promise.all([
    prisma.landlordProfile.findUnique({ where: { id: vendor.landlordId }, select: { ownerUserId: true } }),
    prisma.landlordMembership.findMany({ where: { landlordId: vendor.landlordId, status: RecordStatus.ACTIVE }, select: { userId: true } }),
    prisma.message.findMany({
      where: {
        landlordId: vendor.landlordId,
        OR: [{ senderId: user.userId }, { receiverId: user.userId }],
      },
      include: { sender: { select: { id: true, name: true, email: true, role: true } } },
    }),
  ]);

  const landlordUserIds = new Set<string>(memberships.map((m) => m.userId));
  if (landlord) landlordUserIds.add(landlord.ownerUserId);

  const ordered = sortChronological(messages);
  const unread = unreadCount(
    messages.map((m) => ({ id: m.id, senderId: m.senderId, receiverId: m.receiverId, readAt: m.readAt, createdAt: m.createdAt })),
    user.userId,
  );

  return (
    <Shell title="Messages">
      <div className="space-y-6">
        <section className="rounded-xl bg-white border shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Conversation with {vendor.landlord.displayName ?? 'your landlord'}</h3>
            <div className="flex items-center gap-3">
              {unread > 0 ? (
                <span className="inline-flex rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {unread} new
                </span>
              ) : null}
              <form action={markMessagesReadAction}>
                <button className="rounded border px-3 py-1.5 text-sm">Mark read</button>
              </form>
            </div>
          </div>

          <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto">
            {ordered.length === 0 ? (
              <p className="text-sm text-slate-600">No messages yet. Send the first message below.</p>
            ) : (
              ordered.map((message) => {
                const fromVendor = message.senderId === user.userId;
                return (
                  <div key={message.id} className={`flex ${fromVendor ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg border p-3 text-sm ${fromVendor ? 'bg-brand-navy text-white border-brand-navy' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${fromVendor ? 'text-slate-200' : 'text-slate-500'}`}>
                        {fromVendor ? 'You' : message.sender.name ?? 'Landlord'} · {formatDate(message.createdAt, tz)}
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
          <h3 className="font-semibold">Reply</h3>
          <form action={sendVendorPortalMessageAction} className="mt-4 space-y-3">
            <input name="subject" placeholder="Subject (optional)" maxLength={150} className="w-full border rounded px-3 py-2" />
            <textarea required name="message" placeholder="Write your message…" maxLength={4000} rows={4} className="w-full border rounded px-3 py-2" />
            <button className="rounded bg-brand-navy text-white px-4 py-2">Send</button>
          </form>
        </section>
      </div>
    </Shell>
  );
}
