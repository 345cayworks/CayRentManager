import { PaymentStatus } from '@prisma/client';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createCsvContent, createSafeCsvFilename } from '@/lib/utils/csv';
import { tenantBalanceRows } from '@/lib/finance/reports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { landlordId } = await getCurrentLandlordWorkspace();

    const [tenants, payments] = await Promise.all([
      prisma.tenant.findMany({
        where: { landlordId },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.payment.findMany({
        where: { landlordId, status: { not: PaymentStatus.VOID } },
        select: {
          tenantId: true,
          amountDue: true,
          amountPaid: true,
          balance: true,
          dueDate: true,
        },
      }),
    ]);

    const rows = tenantBalanceRows(
      tenants,
      payments.map((p) => ({
        tenantId: p.tenantId,
        amountDue: Number(p.amountDue),
        amountPaid: Number(p.amountPaid ?? 0),
        balance: Number(p.balance),
        dueDate: p.dueDate,
      })),
    );

    const csvHeaders = [
      'Tenant',
      'Email',
      'Total Due',
      'Total Paid',
      'Balance',
      'Overdue',
    ];

    const csvRows = rows.map((r) => [
      r.fullName,
      r.email,
      r.totalDue.toFixed(2),
      r.totalPaid.toFixed(2),
      r.balance.toFixed(2),
      r.overdue.toFixed(2),
    ]);

    const csvContent = createCsvContent(csvHeaders, csvRows);
    const filename = createSafeCsvFilename('tenant-balances');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting tenant balances:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
