export type PaymentRecord = {
  amountDue: number;
  amountPaid: number;
  dueDate: Date;
  paymentDate?: Date | null;
};

export type LeaseRecord = { endDate: Date; status: string };
export type UnitRecord = { status: string };

export function occupancyRate(totalUnits: number, occupiedUnits: number) {
  if (totalUnits === 0) return 0;
  return Math.round((occupiedUnits / totalUnits) * 10000) / 100;
}

export function rentCollectionRate(payments: PaymentRecord[]) {
  const due = payments.reduce((sum, payment) => sum + payment.amountDue, 0);
  const paid = payments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  if (due === 0) return 0;
  return Math.round((paid / due) * 10000) / 100;
}

export function outstandingBalance(payments: PaymentRecord[]) {
  return payments.reduce((sum, payment) => sum + Math.max(payment.amountDue - payment.amountPaid, 0), 0);
}

export function unitCashflow(rentCollected: number, expenseTotal: number) {
  return rentCollected - expenseTotal;
}

export function portfolioCashflow(units: Array<{ rentCollected: number; expenseTotal: number }>) {
  return units.reduce((sum, unit) => sum + unitCashflow(unit.rentCollected, unit.expenseTotal), 0);
}

export function leaseExpiringSoon(leases: LeaseRecord[], withinDays = 60) {
  const now = new Date();
  const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  return leases.filter((lease) => lease.status === 'active' && lease.endDate >= now && lease.endDate <= threshold);
}

export function paymentStatus(payment: PaymentRecord) {
  if (payment.amountPaid >= payment.amountDue) return 'paid';
  if (payment.dueDate < new Date()) return 'overdue';
  return 'pending';
}

export function expenseTotalsByCategory(expenses: Array<{ category: string; amount: number }>) {
  return expenses.reduce<Record<string, number>>((acc, expense) => {
    acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
    return acc;
  }, {});
}
