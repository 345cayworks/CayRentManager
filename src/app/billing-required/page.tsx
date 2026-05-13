import Link from 'next/link';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { isBillingTableMissingError } from '@/lib/billing/safe-query';

export default async function BillingRequiredPage() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  let subscription: any = null;
  try {
    subscription = await prisma.landlordSubscription.findUnique({ where: { landlordId }, include: { invoices: { where: { status: { in: ['OPEN', 'OVERDUE', 'PENDING_VERIFICATION'] } }, orderBy: { createdAt: 'desc' }, take: 1 } } });
  } catch (error) {
    if (!isBillingTableMissingError(error)) throw error;
  }
  const invoice = subscription?.invoices[0];

  return <div className="max-w-2xl mx-auto p-8 space-y-4"><h1 className="text-2xl font-semibold">Payment required</h1><p>Your subscription is inactive due to non-payment.</p>{invoice && <div className="border rounded p-4"><p>Latest unpaid invoice: {invoice.invoiceNumber}</p><p>Amount: {Number(invoice.amount).toFixed(2)} {invoice.currency}</p>{invoice.fygaroPaymentUrl && <Link href={invoice.fygaroPaymentUrl} className="underline">Pay Now</Link>}</div>}<p>Need help? Contact support at support@cayrentmanager.com.</p></div>;
}
