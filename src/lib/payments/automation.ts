import { InvoiceStatus, LeaseStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { createInvoiceForLease } from '@/lib/payments/invoices';

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function rentDueDateForMonth(baseDate: Date, dueDay = 1) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(dueDay, 1), lastDay));
}

export async function markOverdueInvoices(params?: { landlordId?: string; asOf?: Date }) {
  const asOf = params?.asOf ?? new Date();

  const result = await prisma.invoice.updateMany({
    where: {
      ...(params?.landlordId ? { landlordId: params.landlordId } : {}),
      dueDate: { lt: asOf },
      balance: { gt: new Prisma.Decimal(0) },
      status: { in: [InvoiceStatus.NEW, InvoiceStatus.SENT, InvoiceStatus.PARTIAL] },
    },
    data: {
      status: InvoiceStatus.OVERDUE,
    },
  });

  return result.count;
}

export async function generateMonthlyRentInvoices(params: {
  landlordId: string;
  month?: Date;
  dueDay?: number;
}) {
  const month = params.month ?? new Date();
  const dueDate = rentDueDateForMonth(month, params.dueDay ?? 1);
  const key = monthKey(dueDate);

  const activeLeases = await prisma.lease.findMany({
    where: {
      landlordId: params.landlordId,
      status: LeaseStatus.ACTIVE,
      startDate: { lte: dueDate },
      endDate: { gte: dueDate },
    },
  });

  const created = [];
  const skipped = [];

  for (const lease of activeLeases) {
    const existing = await prisma.invoice.findFirst({
      where: {
        landlordId: params.landlordId,
        leaseId: lease.id,
        dueDate: {
          gte: new Date(dueDate.getFullYear(), dueDate.getMonth(), 1),
          lt: new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 1),
        },
        status: { not: InvoiceStatus.VOID },
      },
    });

    if (existing) {
      skipped.push({ leaseId: lease.id, reason: `Invoice already exists for ${key}` });
      continue;
    }

    const invoice = await createInvoiceForLease({
      landlordId: params.landlordId,
      leaseId: lease.id,
      dueDate,
      amount: lease.rentAmount,
      notes: `Auto-generated rent invoice for ${key}`,
    });

    created.push(invoice);
  }

  return {
    month: key,
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
  };
}
