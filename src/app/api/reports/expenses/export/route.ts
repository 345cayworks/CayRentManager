import { NextRequest } from 'next/server';
import { RecordStatus } from '@prisma/client';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createCsvContent, createSafeCsvFilename } from '@/lib/utils/csv';
import { parseReportRange, inRange } from '@/lib/finance/reports';

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
    const propertyId = params.get('propertyId') ?? '';

    const expenses = await prisma.expense.findMany({
      where: {
        landlordId,
        status: RecordStatus.ACTIVE,
        ...(propertyId ? { propertyId } : {}),
      },
      include: { property: { select: { name: true } } },
      orderBy: { expenseDate: 'desc' },
    });

    const detail = expenses.filter((e) => inRange(e.expenseDate, range));

    const csvHeaders = [
      'Date',
      'Category',
      'Property',
      'Vendor',
      'Amount',
      'Description',
    ];

    const csvRows = detail.map((e) => [
      e.expenseDate.toISOString().split('T')[0],
      e.category,
      e.property.name,
      e.vendor ?? '',
      Number(e.amount).toFixed(2),
      e.description ?? '',
    ]);

    const csvContent = createCsvContent(csvHeaders, csvRows);
    const filename = createSafeCsvFilename('expenses');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting expenses report:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
