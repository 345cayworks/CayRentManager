export type LeaseAlertSeverity = 'INFO' | 'WARNING' | 'URGENT' | 'CRITICAL';

export type LeaseAlertType =
  | 'LEASE_EXPIRED'
  | 'LEASE_EXPIRING'
  | 'RENEWAL_NOT_STARTED'
  | 'RENEWAL_PENDING'
  | 'VACANT_UNIT'
  | 'HIGH_BALANCE'
  | 'NO_NOTICE_RECORDED';

export type LeaseAlert = {
  type: LeaseAlertType;
  severity: LeaseAlertSeverity;
  title: string;
  description: string;
  leaseId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  daysRemaining?: number;
  amount?: number;
};

export type LeaseAlertLease = {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenant?: { fullName?: string | null } | null;
  property?: { name?: string | null } | null;
  unit?: { unitName?: string | null } | null;
  renewals?: Array<{ status: string; createdAt?: Date | null }>;
  notices?: Array<{ noticeType: string; noticeDate?: Date | null }>;
  payments?: Array<{ balance: unknown; status?: string | null }>;
};

export type LeaseAlertUnit = {
  id: string;
  unitName?: string | null;
  propertyId?: string | null;
  property?: { name?: string | null } | null;
  leases?: Array<{ id: string; status: string }>;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysUntil(date: Date, from = new Date()) {
  return Math.ceil((date.getTime() - from.getTime()) / MS_PER_DAY);
}

function leaseLabel(lease: LeaseAlertLease) {
  const tenant = lease.tenant?.fullName ?? 'Tenant';
  const property = lease.property?.name ?? 'property';
  const unit = lease.unit?.unitName ? ` / ${lease.unit.unitName}` : '';
  return `${tenant} at ${property}${unit}`;
}

function severityForExpiration(daysRemaining: number): LeaseAlertSeverity {
  if (daysRemaining < 0) return 'CRITICAL';
  if (daysRemaining <= 7) return 'CRITICAL';
  if (daysRemaining <= 14) return 'URGENT';
  if (daysRemaining <= 30) return 'WARNING';
  return 'INFO';
}

export function getLeaseExpirationAlerts(leases: LeaseAlertLease[], from = new Date()): LeaseAlert[] {
  return leases.flatMap((lease): LeaseAlert[] => {
    if (lease.status !== 'ACTIVE') return [];

    const remaining = daysUntil(lease.endDate, from);

    if (remaining > 90) return [];

    if (remaining < 0) {
      return [{
        type: 'LEASE_EXPIRED',
        severity: 'CRITICAL',
        title: 'Active lease has expired',
        description: `${leaseLabel(lease)} expired ${Math.abs(remaining)} day(s) ago but is still marked active.`,
        leaseId: lease.id,
        tenantId: lease.tenantId ?? undefined,
        propertyId: lease.propertyId ?? undefined,
        unitId: lease.unitId ?? undefined,
        daysRemaining: remaining,
      }];
    }

    return [{
      type: 'LEASE_EXPIRING',
      severity: severityForExpiration(remaining),
      title: `Lease expires in ${remaining} day(s)`,
      description: `${leaseLabel(lease)} should be reviewed for renewal, notice, or turnover planning.`,
      leaseId: lease.id,
      tenantId: lease.tenantId ?? undefined,
      propertyId: lease.propertyId ?? undefined,
      unitId: lease.unitId ?? undefined,
      daysRemaining: remaining,
    }];
  });
}

export function getRenewalAlerts(leases: LeaseAlertLease[], from = new Date()): LeaseAlert[] {
  return leases.flatMap((lease): LeaseAlert[] => {
    if (lease.status !== 'ACTIVE') return [];

    const remaining = daysUntil(lease.endDate, from);

    if (remaining > 90) return [];

    const renewals = lease.renewals ?? [];

    if (renewals.length === 0) {
      return [{
        type: 'RENEWAL_NOT_STARTED',
        severity: remaining <= 30 ? 'URGENT' : 'WARNING',
        title: 'Renewal workflow not started',
        description: `${leaseLabel(lease)} is within the renewal window with no renewal record started.`,
        leaseId: lease.id,
        tenantId: lease.tenantId ?? undefined,
        propertyId: lease.propertyId ?? undefined,
        unitId: lease.unitId ?? undefined,
        daysRemaining: remaining,
      }];
    }

    const latestRenewal = renewals[0];

    if (['DRAFT', 'PROPOSED'].includes(latestRenewal.status)) {
      return [{
        type: 'RENEWAL_PENDING',
        severity: remaining <= 14 ? 'URGENT' : 'INFO',
        title: 'Renewal workflow pending',
        description: `${leaseLabel(lease)} has a renewal in ${latestRenewal.status.toLowerCase()} status.`,
        leaseId: lease.id,
        tenantId: lease.tenantId ?? undefined,
        propertyId: lease.propertyId ?? undefined,
        unitId: lease.unitId ?? undefined,
        daysRemaining: remaining,
      }];
    }

    return [];
  });
}

export function getComplianceAlerts(leases: LeaseAlertLease[], from = new Date()): LeaseAlert[] {
  return leases.flatMap((lease): LeaseAlert[] => {
    if (lease.status !== 'ACTIVE') return [];

    const remaining = daysUntil(lease.endDate, from);

    if (remaining > 60) return [];

    const notices = lease.notices ?? [];

    if (notices.length > 0) return [];

    return [{
      type: 'NO_NOTICE_RECORDED',
      severity: remaining <= 30 ? 'WARNING' : 'INFO',
      title: 'No lease notice recorded',
      description: `${leaseLabel(lease)} is approaching expiration with no renewal, non-renewal, or move-out notice recorded.`,
      leaseId: lease.id,
      tenantId: lease.tenantId ?? undefined,
      propertyId: lease.propertyId ?? undefined,
      unitId: lease.unitId ?? undefined,
      daysRemaining: remaining,
    }];
  });
}

export function getDelinquencyAlerts(leases: LeaseAlertLease[], highBalanceThreshold = 1000): LeaseAlert[] {
  return leases.flatMap((lease): LeaseAlert[] => {
    const totalBalance = (lease.payments ?? []).reduce((sum, payment) => sum + Number(payment.balance ?? 0), 0);

    if (totalBalance < highBalanceThreshold) return [];

    return [{
      type: 'HIGH_BALANCE',
      severity: totalBalance >= highBalanceThreshold * 2 ? 'URGENT' : 'WARNING',
      title: 'High lease balance',
      description: `${leaseLabel(lease)} has an outstanding lease balance of $${totalBalance.toFixed(2)}.`,
      leaseId: lease.id,
      tenantId: lease.tenantId ?? undefined,
      propertyId: lease.propertyId ?? undefined,
      unitId: lease.unitId ?? undefined,
      amount: totalBalance,
    }];
  });
}

export function getVacancyAlerts(units: LeaseAlertUnit[]): LeaseAlert[] {
  return units.flatMap((unit): LeaseAlert[] => {
    const activeLeases = (unit.leases ?? []).filter((lease) => lease.status === 'ACTIVE');

    if (activeLeases.length > 0) return [];

    return [{
      type: 'VACANT_UNIT',
      severity: 'INFO',
      title: 'Vacant unit',
      description: `${unit.property?.name ?? 'Property'} / ${unit.unitName ?? 'Unit'} has no active lease.`,
      propertyId: unit.propertyId ?? undefined,
      unitId: unit.id,
    }];
  });
}

const severityRank: Record<LeaseAlertSeverity, number> = {
  CRITICAL: 4,
  URGENT: 3,
  WARNING: 2,
  INFO: 1,
};

export function sortLeaseAlerts(alerts: LeaseAlert[]) {
  return [...alerts].sort((a, b) => {
    const severityDelta = severityRank[b.severity] - severityRank[a.severity];

    if (severityDelta !== 0) return severityDelta;

    return (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999);
  });
}

export function buildLeaseAlertFeed(params: {
  leases: LeaseAlertLease[];
  units?: LeaseAlertUnit[];
  from?: Date;
  highBalanceThreshold?: number;
}) {
  const from = params.from ?? new Date();

  const alerts = [
    ...getLeaseExpirationAlerts(params.leases, from),
    ...getRenewalAlerts(params.leases, from),
    ...getComplianceAlerts(params.leases, from),
    ...getDelinquencyAlerts(params.leases, params.highBalanceThreshold),
    ...getVacancyAlerts(params.units ?? []),
  ];

  return sortLeaseAlerts(alerts);
}
