import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SubscriptionInvoiceStatus } from '@prisma/client';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get('reference');
  const customRef = url.searchParams.get('custom_reference') ?? url.searchParams.get('customReference');

  if (customRef) {
    const invoice = await prisma.subscriptionInvoice.findFirst({ where: { OR: [{ fygaroCustomRef: customRef }, { invoiceNumber: customRef }] } });
    if (invoice) {
      await prisma.subscriptionInvoice.update({
        where: { id: invoice.id },
        data: {
          fygaroPaymentId: reference ?? undefined,
          status: process.env.FYGARO_WEBHOOK_SECRET ? invoice.status : SubscriptionInvoiceStatus.PENDING_VERIFICATION,
        },
      });
    }
  }

  return NextResponse.redirect(new URL('/billing-required?payment=processing', url.origin));
}
