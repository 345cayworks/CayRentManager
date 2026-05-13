import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { isBillingTableMissingError } from '@/lib/billing/safe-query';
import { markSubscriptionPaid } from '@/lib/billing/subscriptions';
import { verifyFygaroWebhookSignature } from '@/lib/billing/fygaro';

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-fygaro-signature');
  if (!verifyFygaroWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = JSON.parse(raw) as Record<string, string>;
  const customRef = body.custom_reference ?? body.customReference;
  const reference = body.reference;
  if (!customRef) return NextResponse.json({ ok: true, ignored: true });

  let invoice = null;
  try {
    invoice = await prisma.subscriptionInvoice.findFirst({ where: { OR: [{ fygaroCustomRef: customRef }, { invoiceNumber: customRef }] } });
  } catch (error) {
    if (isBillingTableMissingError(error)) return NextResponse.json({ ok: true, ignored: true, reason: 'billing_tables_missing' });
    throw error;
  }
  if (!invoice) return NextResponse.json({ ok: true, ignored: true });

  await markSubscriptionPaid(invoice.id, reference, body);
  return NextResponse.json({ ok: true });
}
