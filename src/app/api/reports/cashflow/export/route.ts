import { NextRequest } from 'next/server';
import { PaymentStatus, RecordStatus } from '@prisma/client';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { createCsvContent, createSafeCsvFilename } from '@/lib/utils/csv';
import { getRecentCashflowSeries } from '@/lib/finance/landlord-financials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_MONTHS = [6, 12, 24];

export async function GET(request: NextRequest) {
  try {
    const { landlordId } = await getCurrentLandlordWorkspace();
    const tz = await getEffectiveTimezone();

    const requested = Number(request.nextUrl.searchParams.get('months'));
    const months = ALLOWED_MONTHS.includes(requested) ? requested : 12;

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: { landlordId, status: { not: PaymentStatus.VOID } },
      }),
      prisma.expense.findMany({
        where: { landlordId, status: RecordStatus.ACTIVE },
      }),
    ]);

    const series = getRecentCashflowSeries(payments, expenses, months, tz);

    const csvHeaders = ['Month', 'Collected', 'Expenses', 'Net'];

    const csvRows = series.map((s) => [
      s.label,
      s.rentCollected.toFixed(2),
      s.expenses.toFixed(2),
      s.net.toFixed(2),
    ]);

    const csvContent = createCsvContent(csvHeaders, csvRows);
    const filename = createSafeCsvFilename('cashflow');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting cashflow:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
