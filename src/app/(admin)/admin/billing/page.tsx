import Link from 'next/link';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export default async function AdminBillingPage() {
  await requireSuperadmin();
  const subs = await prisma.landlordSubscription.findMany({ include: { landlord: true, plan: true, invoices: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' } });

  return <div className="space-y-4 p-6"><h1 className="text-2xl font-semibold">Billing</h1><table className="w-full text-sm"><thead><tr><th>Landlord</th><th>Plan</th><th>Amount</th><th>Status</th><th>Period End</th><th>Grace</th><th>Latest Invoice</th><th>Payment Link</th><th>Actions</th></tr></thead><tbody>{subs.map((s)=>{const inv=s.invoices[0];const days=s.gracePeriodEndsAt?Math.max(0,Math.ceil((s.gracePeriodEndsAt.getTime()-Date.now())/86400000)):0;return <tr key={s.id}><td>{s.landlord.displayName}</td><td>{s.plan.name}</td><td>{Number(s.plan.amount).toFixed(2)} {s.plan.currency}</td><td>{s.status}</td><td>{s.currentPeriodEnd.toLocaleDateString()}</td><td>{days}</td><td>{inv?.invoiceNumber ?? '-'}</td><td>{inv?.fygaroPaymentUrl ? <Link href={inv.fygaroPaymentUrl}>Pay Link</Link> : '-'}</td><td>create_invoice | regenerate_fygaro_link | copy_payment_link | mark_paid_manually | waive_invoice | extend_subscription | deactivate_subscription | reactivate_subscription</td></tr>;})}</tbody></table></div>;
}
