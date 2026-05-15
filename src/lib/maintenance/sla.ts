import { MaintenancePriority } from '@prisma/client';

export const SLA_HOURS: Record<MaintenancePriority, number> = {
  URGENT: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

export function computeSlaDueAt(priority: MaintenancePriority, from: Date = new Date()): Date {
  const hours = SLA_HOURS[priority];
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export type SlaStatus = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'MET';

export function getSlaStatus(opts: {
  slaDueAt: Date | null;
  resolvedAt: Date | null;
  now?: Date;
}): SlaStatus {
  const now = opts.now ?? new Date();
  if (!opts.slaDueAt) return 'ON_TRACK';
  if (opts.resolvedAt) {
    return opts.resolvedAt.getTime() <= opts.slaDueAt.getTime() ? 'MET' : 'BREACHED';
  }
  const msRemaining = opts.slaDueAt.getTime() - now.getTime();
  if (msRemaining <= 0) return 'BREACHED';
  // At-risk = less than 2h remaining (the helper does not know the original window size).
  if (msRemaining <= 2 * 60 * 60 * 1000) return 'AT_RISK';
  return 'ON_TRACK';
}

export function formatSlaCountdown(slaDueAt: Date, now: Date = new Date()): string {
  const ms = slaDueAt.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  const prefix = ms < 0 ? 'Overdue by ' : 'Due in ';
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    return `${prefix}${days}d ${rem}h`;
  }
  return `${prefix}${hours}h ${minutes}m`;
}
