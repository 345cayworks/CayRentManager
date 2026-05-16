import { NextRequest } from 'next/server';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createCsvContent, createSafeCsvFilename } from '@/lib/utils/csv';
import { leaseExpiryRows } from '@/lib/finance/reports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_DAYS = [30, 60, 90, 180];

export async function GET(request: NextRequest) {
  try {
    const { landlordId } = await getCurrentLandlordWorkspace();

    const requested = Number(request.nextUrl.searchParams.get('days'));
    const days = ALLOWED_DAYS.includes(requested) ? requested : 90;

    const leases = await prisma.lease.findMany({
      where: { landlordId, status: 'ACTIVE' },
      include: {
        tenant: { select: { fullName: true } },
        property: { select: { name: true } },
        unit: { select: { unitName: true } },
      },
    });

    const rows = leaseExpiryRows(
      leases.map((l) => ({
        id: l.id,
        tenantName: l.tenant.fullName,
        propertyName: l.property.name,
        unitName: l.unit?.unitName ?? null,
        endDate: l.endDate,
        rentAmount: Number(l.rentAmount),
        status: l.status,
      })),
      days,
    );

    const csvHeaders = [
      'Tenant',
      'Property',
      'Unit',
      'End Date',
      'Days Until',
      'Monthly Rent',
    ];

    const csvRows = rows.map((r) => [
      r.tenantName,
      r.propertyName,
      r.unitName ?? '',
      r.endDate.toISOString().split('T')[0],
      r.daysUntil,
      r.rentAmount.toFixed(2),
    ]);

    const csvContent = createCsvContent(csvHeaders, csvRows);
    const filename = createSafeCsvFilename('lease-expiry');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting lease expiry:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
