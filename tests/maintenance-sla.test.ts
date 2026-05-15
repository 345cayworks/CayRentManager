import { describe, expect, it } from 'vitest';
import { MaintenancePriority } from '@prisma/client';
import { computeSlaDueAt, formatSlaCountdown, getSlaStatus } from '@/lib/maintenance/sla';

const HOUR = 60 * 60 * 1000;

describe('maintenance SLA', () => {
  describe('computeSlaDueAt', () => {
    const from = new Date('2026-05-15T12:00:00Z');

    it('uses a 4h window for URGENT', () => {
      const due = computeSlaDueAt(MaintenancePriority.URGENT, from);
      expect(due.getTime() - from.getTime()).toBe(4 * HOUR);
    });

    it('uses a 24h window for HIGH', () => {
      const due = computeSlaDueAt(MaintenancePriority.HIGH, from);
      expect(due.getTime() - from.getTime()).toBe(24 * HOUR);
    });

    it('uses a 72h window for MEDIUM', () => {
      const due = computeSlaDueAt(MaintenancePriority.MEDIUM, from);
      expect(due.getTime() - from.getTime()).toBe(72 * HOUR);
    });

    it('uses a 168h window for LOW', () => {
      const due = computeSlaDueAt(MaintenancePriority.LOW, from);
      expect(due.getTime() - from.getTime()).toBe(168 * HOUR);
    });
  });

  describe('getSlaStatus', () => {
    const now = new Date('2026-05-15T12:00:00Z');

    it('returns BREACHED when slaDueAt is in the past and no resolvedAt', () => {
      expect(
        getSlaStatus({
          slaDueAt: new Date(now.getTime() - HOUR),
          resolvedAt: null,
          now,
        }),
      ).toBe('BREACHED');
    });

    it('returns MET when resolvedAt is before slaDueAt', () => {
      expect(
        getSlaStatus({
          slaDueAt: new Date(now.getTime() + HOUR),
          resolvedAt: new Date(now.getTime() - HOUR),
          now,
        }),
      ).toBe('MET');
    });

    it('returns BREACHED when resolvedAt is after slaDueAt', () => {
      expect(
        getSlaStatus({
          slaDueAt: new Date(now.getTime() - HOUR),
          resolvedAt: new Date(now.getTime() + HOUR),
          now,
        }),
      ).toBe('BREACHED');
    });

    it('returns AT_RISK when less than 2h remain', () => {
      expect(
        getSlaStatus({
          slaDueAt: new Date(now.getTime() + HOUR),
          resolvedAt: null,
          now,
        }),
      ).toBe('AT_RISK');
    });

    it('returns ON_TRACK when 24h remain', () => {
      expect(
        getSlaStatus({
          slaDueAt: new Date(now.getTime() + 24 * HOUR),
          resolvedAt: null,
          now,
        }),
      ).toBe('ON_TRACK');
    });

    it('returns ON_TRACK when slaDueAt is null', () => {
      expect(getSlaStatus({ slaDueAt: null, resolvedAt: null, now })).toBe('ON_TRACK');
    });
  });

  describe('formatSlaCountdown', () => {
    const now = new Date('2026-05-15T12:00:00Z');

    it('formats upcoming time under a day in hours and minutes', () => {
      const due = new Date(now.getTime() + 3 * HOUR + 30 * 60 * 1000);
      expect(formatSlaCountdown(due, now)).toBe('Due in 3h 30m');
    });

    it('formats upcoming time over a day in days and hours', () => {
      const due = new Date(now.getTime() + 26 * HOUR);
      expect(formatSlaCountdown(due, now)).toBe('Due in 1d 2h');
    });

    it('formats overdue time in hours and minutes', () => {
      const due = new Date(now.getTime() - 2 * HOUR - 15 * 60 * 1000);
      expect(formatSlaCountdown(due, now)).toBe('Overdue by 2h 15m');
    });

    it('formats overdue time over a day in days and hours', () => {
      const due = new Date(now.getTime() - 25 * HOUR);
      expect(formatSlaCountdown(due, now)).toBe('Overdue by 1d 1h');
    });
  });
});
