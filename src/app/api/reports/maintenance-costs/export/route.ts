import { NextRequest } from 'next/server';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createCsvContent, createSafeCsvFilename } from '@/lib/utils/csv';
import {
  parseReportRange,
  aggregateMaintenanceCosts,
} from '@/lib/finance/reports';

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
    const by: 'property' | 'category' =
      params.get('by') === 'category' ? 'category' : 'property';

    const workOrders = await prisma.maintenanceWorkOrder.findMany({
      where: { maintenanceRequest: { landlordId } },
      include: {
        maintenanceRequest: {
          select: {
            category: true,
            createdAt: true,
            property: { select: { name: true } },
          },
        },
      },
    });

    const mapped = workOrders.map((wo) => ({
      propertyName: wo.maintenanceRequest.property.name,
      category: String(wo.maintenanceRequest.category),
      estimatedCost: wo.estimatedCost == null ? null : Number(wo.estimatedCost),
      actualCost: wo.actualCost == null ? null : Number(wo.actualCost),
      createdAt: wo.maintenanceRequest.createdAt,
    }));

    const { rows } = aggregateMaintenanceCosts(mapped, by, range);

    const csvHeaders = [
      by === 'property' ? 'Property' : 'Category',
      'Estimated',
      'Actual',
      'Count',
    ];

    const csvRows = rows.map((r) => [
      r.key,
      r.estimated.toFixed(2),
      r.actual.toFixed(2),
      r.count,
    ]);

    const csvContent = createCsvContent(csvHeaders, csvRows);
    const filename = createSafeCsvFilename('maintenance-costs');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting maintenance costs:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
