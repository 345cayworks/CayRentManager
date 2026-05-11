import { z } from 'zod';

export const recordPaymentSchema = z.object({
  leaseId: z.string().min(1),
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  unitId: z.string().min(1),
  amountDue: z.coerce.number().positive(),
  amountPaid: z.coerce.number().nonnegative(),
  dueDate: z.string().min(1),
  paymentDate: z.string().optional(),
  paymentMethod: z.string().min(1).max(100),
  notes: z.string().max(2000).optional(),
});

export function validatePaymentDates(dueDate: Date, paymentDate?: Date | null) {
  if (!paymentDate) return true;

  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(paymentDate.getTime())) {
    throw new Error('Invalid payment date values.');
  }

  return true;
}

export function calculatePaymentStatus(amountDue: number, amountPaid: number) {
  if (amountPaid <= 0) return 'PENDING';
  if (amountPaid < amountDue) return 'PARTIAL';
  return 'PAID';
}

export function calculatePaymentBalance(amountDue: number, amountPaid: number) {
  return Math.max(0, amountDue - amountPaid);
}
