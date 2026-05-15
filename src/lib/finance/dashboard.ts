import { LeaseStatus, MaintenanceStatus, PaymentStatus, RecordStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  CashflowPoint,
  ComparisonDelta,
  RentCollectionStatusCounts,
  getMonthRange,
  getRecentCashflowSeries,
  getRentCollectionStatusCounts,
  monthOverMonthDelta,
  overdueBalanceAsOf,
} from './landlord-financials';

export interface LandlordDashboardMetrics {
  monthlyRentExpected: number;
  monthlyRentCollected: number;
  outstandingBalance: number;
  overdueAmount: number;
  occupancyRate: number;
  netCashflow: number;
  activeTenants: number;
  openMaintenance: number;
  leaseExpirations: number;
  comparison: {
    rentCollected: ComparisonDelta;
    overdueAmount: ComparisonDelta;
    occupancyRate: ComparisonDelta;
    activeTenants: ComparisonDelta;
  };
  cashflowSeries: CashflowPoint[];
  rentCollectionStatus: RentCollectionStatusCounts;
}

export async function getLandlordDashboardMetrics(landlordId: string): Promise<LandlordDashboardMetrics> {
  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(0);
  const { start: prevMonthStart, end: prevMonthEnd } = getMonthRange(1);
  const sixMonthsStart = getMonthRange(5).start;
  const sixtyDays = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);

  const [
    units,
    leases,
    paymentsThisMonth,
    paymentsPrevMonth,
    paymentsForOverdueCurrent,
    paymentsForOverduePrev,
    expensesThisMonth,
    expensesSixMonths,
    paymentsSixMonths,
    activeTenants,
    openMaintenance,
    tenantsAsOfPrevMonth,
    leasesActivePrevMonth,
  ] = await Promise.all([
    prisma.unit.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
      select: { id: true },
    }),
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
      select: {
        status: true,
        amountDue: true,
        amountPaid: true,
        balance: true,
        dueDate: true,
        paymentDate: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        landlordId,
        status: { not: PaymentStatus.VOID },
        paymentDate: { gte: prevMonthStart, lt: prevMonthEnd },
      },
      select: { amountPaid: true },
    }),
    prisma.payment.findMany({
      where: {
        landlordId,
        status: { not: PaymentStatus.VOID },
        dueDate: { lt: now },
        balance: { gt: 0 },
      },
      select: { balance: true },
    }),
    prisma.payment.findMany({
      where: {
        landlordId,
        status: { not: PaymentStatus.VOID },
        dueDate: { lt: prevMonthEnd },
      },
      select: { amountDue: true, amountPaid: true, dueDate: true, paymentDate: true, status: true, balance: true },
    }),
    prisma.expense.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE, expenseDate: { gte: monthStart, lt: monthEnd } },
      select: { amount: true },
    }),
    prisma.expense.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE, expenseDate: { gte: sixMonthsStart, lt: monthEnd } },
      select: { amount: true, expenseDate: true, status: true },
    }),
    prisma.payment.findMany({
      where: {
        landlordId,
        status: { not: PaymentStatus.VOID },
        paymentDate: { gte: sixMonthsStart, lt: monthEnd },
      },
      select: { amountPaid: true, paymentDate: true, status: true },
    }),
    prisma.tenant.count({ where: { landlordId, status: RecordStatus.ACTIVE } }),
    prisma.maintenanceRequest.count({
      where: { landlordId, status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS] } },
    }),
    prisma.tenant.count({
      where: {
        landlordId,
        createdAt: { lt: prevMonthEnd },
        OR: [
          { deactivatedAt: null },
          { deactivatedAt: { gte: prevMonthEnd } },
        ],
      },
    }),
    prisma.lease.findMany({
      where: {
        landlordId,
        startDate: { lt: prevMonthEnd },
        endDate: { gte: prevMonthStart },
        OR: [
          { terminatedAt: null },
          { terminatedAt: { gte: prevMonthEnd } },
        ],
        status: { notIn: [LeaseStatus.DRAFT] },
      },
      select: { unitId: true },
    }),
  ]);

  const occupiedUnits = new Set(leases.map((lease) => lease.unitId)).size;
  const totalUnits = units.length;
  const occupancyRate = totalUnits === 0 ? 0 : Math.round((occupiedUnits / totalUnits) * 10000) / 100;

  const monthlyRentExpected = leases.reduce((sum, lease) => sum + Number(lease.rentAmount), 0);
  const monthlyRentCollected = paymentsThisMonth.reduce(
    (sum, payment) => sum + Number(payment.amountPaid ?? 0),
    0,
  );
  const outstandingBalance = paymentsThisMonth.reduce((sum, p) => sum + Number(p.balance), 0);
  const expenseTotal = expensesThisMonth.reduce((sum, e) => sum + Number(e.amount), 0);

  const overdueAmount = paymentsForOverdueCurrent.reduce(
    (sum, p) => sum + Number(p.balance ?? 0),
    0,
  );

  // Previous-month snapshots for the four headline comparisons.
  const prevRentCollected = paymentsPrevMonth.reduce(
    (sum, p) => sum + Number(p.amountPaid ?? 0),
    0,
  );
  const prevOverdueAmount = overdueBalanceAsOf(paymentsForOverduePrev as never, prevMonthEnd);
  const occupiedUnitsPrev = new Set(leasesActivePrevMonth.map((l) => l.unitId)).size;
  // Denominator is the current active unit count — unit archival history is
  // not reconstructed. Acceptable for MoM trend on a slow-moving denominator.
  const occupancyRatePrev =
    totalUnits === 0 ? 0 : Math.round((occupiedUnitsPrev / totalUnits) * 10000) / 100;

  const cashflowSeries = getRecentCashflowSeries(
    paymentsSixMonths as never,
    expensesSixMonths as never,
    6,
  );

  const rentCollectionStatus = getRentCollectionStatusCounts(paymentsThisMonth);

  const leaseExpirations = leases.filter(
    (lease) => lease.endDate >= now && lease.endDate <= sixtyDays,
  ).length;

  return {
    monthlyRentExpected,
    monthlyRentCollected,
    outstandingBalance,
    overdueAmount,
    occupancyRate,
    netCashflow: monthlyRentCollected - expenseTotal,
    activeTenants,
    openMaintenance,
    leaseExpirations,
    comparison: {
      rentCollected: monthOverMonthDelta(monthlyRentCollected, prevRentCollected),
      overdueAmount: monthOverMonthDelta(overdueAmount, prevOverdueAmount),
      occupancyRate: monthOverMonthDelta(occupancyRate, occupancyRatePrev),
      activeTenants: monthOverMonthDelta(activeTenants, tenantsAsOfPrevMonth),
    },
    cashflowSeries,
    rentCollectionStatus,
  };
}
