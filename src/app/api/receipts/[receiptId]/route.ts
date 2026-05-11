import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { getActiveUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value: unknown) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export async function GET(_request: Request, { params }: { params: { receiptId: string } }) {
  const user = await getActiveUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id: params.receiptId },
    include: {
      payment: {
        include: {
          invoice: true,
          tenant: true,
          property: true,
          unit: true,
          landlord: true,
        },
      },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }

  const isTenantOwner = receipt.payment.tenant.userId === user.userId;
  const isSuperadmin = user.role === UserRole.SUPERADMIN;
  const landlordAccess = await prisma.landlordMembership.findFirst({
    where: {
      landlordId: receipt.payment.landlordId,
      userId: user.userId,
      status: 'ACTIVE',
      landlord: { status: 'ACTIVE' },
    },
  });

  if (!isTenantOwner && !isSuperadmin && !landlordAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(receipt.receiptNo)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #0f172a; }
    .receipt { max-width: 760px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    .muted { color: #64748b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; }
    .right { text-align: right; }
    .footer { margin-top: 28px; font-size: 12px; color: #64748b; line-height: 1.5; }
    @media print { body { margin: 0; } .receipt { border: none; } }
  </style>
</head>
<body>
  <main class="receipt">
    <h1>Rent Payment Receipt</h1>
    <p class="muted">Receipt No. ${escapeHtml(receipt.receiptNo)}</p>

    <div class="grid">
      <div class="box">
        <strong>Landlord</strong><br />
        ${escapeHtml(receipt.payment.landlord.displayName)}<br />
        ${escapeHtml(receipt.payment.landlord.companyName)}
      </div>
      <div class="box">
        <strong>Tenant</strong><br />
        ${escapeHtml(receipt.payment.tenant.fullName)}<br />
        ${escapeHtml(receipt.payment.tenant.email)}
      </div>
    </div>

    <table>
      <tbody>
        <tr><th>Invoice</th><td>${escapeHtml(receipt.payment.invoice?.invoiceNo ?? 'Manual payment')}</td></tr>
        <tr><th>Property</th><td>${escapeHtml(receipt.payment.property.name)}</td></tr>
        <tr><th>Unit</th><td>${escapeHtml(receipt.payment.unit.unitName)}</td></tr>
        <tr><th>Payment Date</th><td>${escapeHtml(receipt.payment.paymentDate?.toLocaleDateString() ?? '—')}</td></tr>
        <tr><th>Payment Method</th><td>${escapeHtml(receipt.payment.paymentMethod ?? '—')}</td></tr>
        <tr><th>Amount Paid</th><td class="right">${escapeHtml(money(receipt.payment.amountPaid))}</td></tr>
        <tr><th>Remaining Balance</th><td class="right">${escapeHtml(money(receipt.payment.balance))}</td></tr>
      </tbody>
    </table>

    <div class="footer">
      <p>This receipt confirms payment recorded in CayRentManager. Please retain it for your records.</p>
      <p>For Cayman Islands short-term tourist accommodation transactions, tourist accommodation tax treatment should be reviewed separately according to the property type and licensing status.</p>
      <p>Generated on ${escapeHtml(new Date().toLocaleString())}</p>
    </div>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${receipt.receiptNo}.html"`,
    },
  });
}
