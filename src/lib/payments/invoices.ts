import { InvoiceStatus, LeaseStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { calculatePaymentBalance, calculatePaymentStatus } from '@/lib/validation/payments';

function createInvoiceNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');

  return `INV-${timestamp}-${random}`;
}

function createReceiptNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');

  return `RCT-${timestamp}-${random}`;
}

function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  return { start, end };
}

export async function createInvoiceForLease(params: {
  landlordId: string;
  leaseId: string;
  dueDate: Date;
  amount?: Prisma.Decimal | number;
  notes?: string;
}) {
  const lease = await prisma.lease.findFirst({
    where: {
      id: params.leaseId,
      landlordId: params.landlordId,
    },
  });

  if (!lease) {
    throw new Error('Lease not found for landlord workspace.');
  }

  const invoiceAmount = new Prisma.Decimal(
    params.amount ?? lease.rentAmount
  );

  return prisma.invoice.create({
    data: {
      invoiceNo: createInvoiceNumber(),
      landlordId: params.landlordId,
      tenantId: lease.tenantId,
      leaseId: lease.id,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      amount: invoiceAmount,
      amountPaid: new Prisma.Decimal(0),
      balance: invoiceAmount,
      dueDate: params.dueDate,
      status: InvoiceStatus.NEW,
      notes: params.notes,
    },
  });
}

export async function generateMonthlyRentInvoices(params: {
  landlordId: string;
  dueDate: Date;
}) {
  const { start, end } = monthRange(params.dueDate);

  const leases = await prisma.lease.findMany({
    where: {
      landlordId: params.landlordId,
      status: LeaseStatus.ACTIVE,
      startDate: {
        lte: params.dueDate,
      },
      endDate: {
        gte: params.dueDate,
      },
    },
    include: {
      tenant: true,
      unit: {
        include: {
          property: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  let created = 0;
  let skipped = 0;

  for (const lease of leases) {
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        landlordId: params.landlordId,
        leaseId: lease.id,
        dueDate: {
          gte: start,
          lt: end,
        },
        status: {
          not: InvoiceStatus.VOID,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingInvoice) {
      skipped += 1;
      continue;
    }

    await createInvoiceForLease({
      landlordId: params.landlordId,
      leaseId: lease.id,
      dueDate: params.dueDate,
      amount: lease.rentAmount,
      notes: `Monthly rent for ${params.dueDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
    });

    created += 1;
  }

  return {
    created,
    skipped,
    eligibleLeases: leases.length,
  };
}

export async function applyPaymentToInvoice(params: {
  landlordId: string;
  invoiceId: string;
  amountPaid: number;
  paymentDate?: Date | null;
  paymentMethod?: string | null;
  paymentMethodId?: string | null;
  notes?: string | null;
}) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: params.invoiceId,
      landlordId: params.landlordId,
    },
    include: {
      lease: true,
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  const totalPaid = new Prisma.Decimal(invoice.amountPaid).plus(
    params.amountPaid
  );

  const balance = calculatePaymentBalance(
    Number(invoice.amount),
    Number(totalPaid)
  );

  const paymentStatus = calculatePaymentStatus(
    Number(invoice.amount),
    Number(totalPaid)
  );

  const updatedInvoice = await prisma.invoice.update({
    where: {
      id: invoice.id,
    },
    data: {
      amountPaid: totalPaid,
      balance,
      paidAt: paymentStatus === 'PAID' ? new Date() : null,
      status:
        paymentStatus === 'PAID'
          ? InvoiceStatus.PAID
          : paymentStatus === 'PARTIAL'
            ? InvoiceStatus.PARTIAL
            : InvoiceStatus.SENT,
    },
  });

  const payment = await prisma.payment.create({
    data: {
      landlordId: invoice.landlordId,
      tenantId: invoice.tenantId,
      leaseId: invoice.leaseId,
      propertyId: invoice.propertyId,
      unitId: invoice.unitId,
      invoiceId: invoice.id,
      paymentMethodId: params.paymentMethodId,
      dueDate: invoice.dueDate,
      paymentDate: params.paymentDate ?? new Date(),
      amountDue: invoice.amount,
      amountPaid: new Prisma.Decimal(params.amountPaid),
      balance,
      paymentMethod: params.paymentMethod ?? null,
      status: paymentStatus as PaymentStatus,
      notes: params.notes ?? null,
    },
  });

  return {
    invoice: updatedInvoice,
    payment,
  };
}

export async function generateReceiptForPayment(params: {
  paymentId: string;
}) {
  const payment = await prisma.payment.findUnique({
    where: {
      id: params.paymentId,
    },
    include: {
      tenant: true,
      property: true,
      unit: true,
    },
  });

  if (!payment) {
    throw new Error('Payment not found.');
  }

  const existingReceipt = await prisma.receipt.findUnique({
    where: {
      paymentId: payment.id,
    },
  });

  if (existingReceipt) {
    return existingReceipt;
  }

  return prisma.receipt.create({
    data: {
      paymentId: payment.id,
      receiptNo: createReceiptNumber(),
      fileUrl: null,
    },
  });
}
