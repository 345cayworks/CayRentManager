import { LeaseStatus, MaintenanceStatus, PaymentStatus, RecordStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getCurrentMonthRange } from './landlord-financials';

export interface LandlordDashboardMetrics {
  monthlyRentExpected: number;
  monthlyRentCollected: number;
  outstandingBalance: number;
  occupancyRate: number;
  netCashflow: number;
  activeTenants: number;
  openMaintenance: number;
  leaseExpirations: number;
}

export async function getLandlordDashboardMetrics(landlordId: string): Promise<LandlordDashboardMetrics> {
  const now = new Date();
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();
  const sixtyDays = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);

  const [units, leases, payments, expenses, activeTenants, openMaintenance] = await Promise.all([
    prisma.unit.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, select: { id: true } }),
    prisma.lease.findMany({
      where: { landlordId, status: LeaseStatus.ACTIVE },
      select: { unitId: true, rentAmount: true, endDate: true },
    }),
    prisma.payment.findMany({
      where: {
        landlordId,
        status: { not: PaymentStatus.VOID },
        dueDate: { gte: monthStart, lt: monthEnd },
      },
      select: { amountDue: true, amountPaid: true, balance: true },
    }),
    prisma.expense.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE, expenseDate: { gte: monthStart, lt: monthEnd } },
      select: { amount: true },
    }),
    prisma.tenant.count({ where: { landlordId, status: RecordStatus.ACTIVE } }),
    prisma.maintenanceRequest.count({
      where: { landlordId, status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS] } },
    }),
  ]);

  const occupiedUnits = new Set(leases.map((lease) => lease.unitId)).size;
  const monthlyRentExpected = leases.reduce((sum, lease) => sum + Number(lease.rentAmount), 0);
  const monthlyRentCollected = payments.reduce((sum, payment) => sum + Number(payment.amountPaid ?? 0), 0);
  const outstandingBalance = payments.reduce((sum, payment) => sum + Number(payment.balance), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const leaseExpirations = leases.filter((lease) => lease.endDate >= now && lease.endDate <= sixtyDays).length;

  return {
    monthlyRentExpected,
    monthlyRentCollected,
    outstandingBalance,
    occupancyRate: units.length === 0 ? 0 : Math.round((occupiedUnits / units.length) * 10000) / 100,
    netCashflow: monthlyRentCollected - expenseTotal,
    activeTenants,
    openMaintenance,
    leaseExpirations,
  };
}
