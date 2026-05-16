import { NextRequest } from 'next/server';
import { PaymentStatus, RecordStatus } from '@prisma/client';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createCsvContent, createSafeCsvFilename } from '@/lib/utils/csv';
import { parseReportRange, computePropertyPL } from '@/lib/finance/reports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { landlordId } = await getCurrentLandlordWorkspace();

    const params = request.nextUrl.searchParams;
    const range = parseReportRange({
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
    });

    const [properties, payments, expenses] = await Promise.all([
      prisma.property.findMany({
        where: { landlordId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.payment.findMany({
        where: {
          landlordId,
          status: { not: PaymentStatus.VOID },
          paymentDate: { gte: range.start, lte: range.end },
        },
        select: { propertyId: true, amountPaid: true, paymentDate: true },
      }),
      prisma.expense.findMany({
        where: {
          landlordId,
          status: RecordStatus.ACTIVE,
          expenseDate: { gte: range.start, lte: range.end },
        },
        select: { propertyId: true, amount: true, expenseDate: true },
      }),
    ]);

    const { rows } = computePropertyPL(
      properties,
      payments.map((p) => ({
        propertyId: p.propertyId,
        amountPaid: Number(p.amountPaid ?? 0),
        paymentDate: p.paymentDate,
      })),
      expenses.map((e) => ({
        propertyId: e.propertyId,
        amount: Number(e.amount),
        expenseDate: e.expenseDate,
      })),
      range,
    );

    const csvHeaders = ['Property', 'Income', 'Expense', 'Net'];

    const csvRows = rows.map((r) => [
      r.name,
      r.income.toFixed(2),
      r.expense.toFixed(2),
      r.net.toFixed(2),
    ]);

    const csvContent = createCsvContent(csvHeaders, csvRows);
    const filename = createSafeCsvFilename('property-pl');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting property P&L:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
