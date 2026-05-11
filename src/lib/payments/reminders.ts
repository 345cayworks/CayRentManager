import { InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type InvoiceReminderBucket = 'DUE_SOON' | 'DUE_TODAY' | 'OVERDUE';

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function getInvoiceReminderCandidates(params: {
  landlordId?: string;
  asOf?: Date;
  dueSoonDays?: number;
}) {
  const asOf = startOfDay(params.asOf ?? new Date());
  const dueSoonEnd = addDays(asOf, params.dueSoonDays ?? 3);

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(params.landlordId ? { landlordId: params.landlordId } : {}),
      status: { in: [InvoiceStatus.NEW, InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
      balance: { gt: 0 },
    },
    include: {
      tenant: true,
      property: true,
      unit: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  return invoices.map((invoice) => {
    const due = startOfDay(invoice.dueDate);
    let bucket: InvoiceReminderBucket | null = null;

    if (due < asOf) bucket = 'OVERDUE';
    if (due.getTime() === asOf.getTime()) bucket = 'DUE_TODAY';
    if (due > asOf && due <= dueSoonEnd) bucket = 'DUE_SOON';

    return {
      invoice,
      bucket,
      daysFromDue: Math.round((due.getTime() - asOf.getTime()) / 86_400_000),
    };
  }).filter((item) => item.bucket !== null);
}

export async function getInvoiceAgingSummary(params: { landlordId: string; asOf?: Date }) {
  const asOf = startOfDay(params.asOf ?? new Date());
  const invoices = await prisma.invoice.findMany({
    where: {
      landlordId: params.landlordId,
      status: { not: InvoiceStatus.VOID },
      balance: { gt: 0 },
    },
  });

  return invoices.reduce(
    (summary, invoice) => {
      const daysPastDue = Math.max(0, Math.floor((asOf.getTime() - startOfDay(invoice.dueDate).getTime()) / 86_400_000));
      const balance = Number(invoice.balance);

      if (daysPastDue === 0) summary.current += balance;
      else if (daysPastDue <= 30) summary.days1to30 += balance;
      else if (daysPastDue <= 60) summary.days31to60 += balance;
      else if (daysPastDue <= 90) summary.days61to90 += balance;
      else summary.days90plus += balance;

      summary.total += balance;
      return summary;
    },
    { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 }
  );
}
