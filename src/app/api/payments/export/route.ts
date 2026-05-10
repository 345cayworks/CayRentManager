import { NextRequest } from 'next/server';
import { PaymentStatus } from '@prisma/client';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createCsvContent, createSafeCsvFilename } from '@/lib/utils/csv';

export async function GET(request: NextRequest) {
  try {
    const { landlordId } = await getCurrentLandlordWorkspace();
    const payments = await prisma.payment.findMany({
      where: { landlordId, status: { not: PaymentStatus.VOID } },
      include: { tenant: true, unit: { include: { property: true } }, lease: true },
      orderBy: { dueDate: 'desc' },
    });

    const csvHeaders = [
      'Due Date',
      'Payment Date',
      'Tenant',
      'Property',
      'Unit',
      'Amount Due',
      'Amount Paid',
      'Balance',
      'Status',
      'Payment Method',
      'Notes'
    ];

    const csvRows = payments.map(payment => [
      payment.dueDate.toISOString().split('T')[0],
      payment.paymentDate?.toISOString().split('T')[0] ?? '',
      payment.tenant.fullName,
      payment.unit.property.name,
      payment.unit.unitName,
      payment.amountDue.toString(),
      (payment.amountPaid ?? 0).toString(),
      payment.balance.toString(),
      payment.status,
      payment.paymentMethod ?? '',
      payment.notes ?? ''
    ]);

    const csvContent = createCsvContent(csvHeaders, csvRows);
    const filename = createSafeCsvFilename('payments');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error('Error exporting payments:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}