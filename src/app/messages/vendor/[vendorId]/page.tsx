import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { sendVendorMessageAction, markMessagesReadAction } from '@/server/actions';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import { sortChronological } from '@/lib/messaging/threads';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { vendorId: string } }) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const vendor = await prisma.maintenanceVendor.findFirst({ where: { id: params.vendorId, landlordId } });
  if (!vendor) notFound();

  if (!vendor.userId) {
    return (
      <Shell title={`Messages · ${vendor.name}`}>
        <div className="rounded-xl bg-white border shadow-sm p-6 text-slate-600">
          This vendor has no linked portal login yet — enable their portal access to start messaging.
        </div>
      </Shell>
    );
  }

  const vendorUserId = vendor.userId;
  const [landlord, memberships, messages] = await Promise.all([
    prisma.landlordProfile.findUnique({ where: { id: landlordId }, select: { ownerUserId: true } }),
    prisma.landlordMembership.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, select: { userId: true } }),
    prisma.message.findMany({
      where: {
        landlordId,
        OR: [{ senderId: vendorUserId }, { receiverId: vendorUserId }],
      },
      include: { sender: { select: { id: true, name: true, email: true, role: true } } },
    }),
  ]);

  const landlordUserIds = new Set<string>(memberships.map((m) => m.userId));
  if (landlord) landlordUserIds.add(landlord.ownerUserId);

  const ordered = sortChronological(messages);

  return (
    <Shell title={`Messages · ${vendor.name}`}>
      <div className="space-y-6">
        <Link href="/messages" className="text-sm text-brand-navy underline">← Back to Messages</Link>

        <section className="rounded-xl bg-white border shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Conversation with {vendor.name}</h3>
            <form action={markMessagesReadAction}>
              <input type="hidden" name="withSenderId" value={vendorUserId} />
              <button className="rounded border px-3 py-1.5 text-sm">Mark read</button>
            </form>
          </div>

          <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto">
            {ordered.length === 0 ? (
              <p className="text-sm text-slate-600">No messages yet. Send the first message below.</p>
            ) : (
              ordered.map((message) => {
                const fromLandlord = landlordUserIds.has(message.senderId);
                return (
                  <div key={message.id} className={`flex ${fromLandlord ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg border p-3 text-sm ${fromLandlord ? 'bg-brand-navy text-white border-brand-navy' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${fromLandlord ? 'text-slate-200' : 'text-slate-500'}`}>
                        {fromLandlord ? message.sender.name ?? 'Landlord' : vendor.name} · {formatDate(message.createdAt, tz)}
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
          <form action={sendVendorMessageAction} className="mt-4 space-y-3">
            <input type="hidden" name="vendorId" value={vendor.id} />
            <input name="subject" placeholder="Subject (optional)" maxLength={150} className="w-full border rounded px-3 py-2" />
            <textarea required name="message" placeholder="Write your message…" maxLength={4000} rows={4} className="w-full border rounded px-3 py-2" />
            <button className="rounded bg-brand-navy text-white px-4 py-2">Send</button>
          </form>
        </section>
      </div>
    </Shell>
  );
}
