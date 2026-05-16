import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ESCALATION_POLICY,
  evaluateEscalation,
  resolveEscalationPolicy,
  selectEscalationRecipients,
  type EscalationPolicyShape,
} from '@/lib/notifications/escalation';

const HOUR = 1000 * 60 * 60;

describe('resolveEscalationPolicy', () => {
  it('returns hard defaults when nothing is stored', () => {
    expect(resolveEscalationPolicy(null)).toEqual(DEFAULT_ESCALATION_POLICY);
    expect(resolveEscalationPolicy(undefined)).toEqual(DEFAULT_ESCALATION_POLICY);
  });

  it('lets stored fields override defaults', () => {
    const resolved = resolveEscalationPolicy({
      enabled: false,
      minSeverity: 'CRITICAL',
      thresholdHours: 48,
      repeatHours: 12,
      notifyRoles: ['ACCOUNTANT'],
      channels: ['SMS'],
    });
    expect(resolved.enabled).toBe(false);
    expect(resolved.minSeverity).toBe('CRITICAL');
    expect(resolved.thresholdHours).toBe(48);
    expect(resolved.repeatHours).toBe(12);
    expect(resolved.notifyRoles).toEqual(['ACCOUNTANT']);
    expect(resolved.channels).toEqual(['SMS']);
  });

  it('applies the platform defaults layer between stored and hard defaults', () => {
    const resolved = resolveEscalationPolicy(null, {
      minSeverity: 'WARNING',
      thresholdHours: 6,
    });
    expect(resolved.minSeverity).toBe('WARNING');
    expect(resolved.thresholdHours).toBe(6);
    // unspecified by platform → hard default
    expect(resolved.channels).toEqual(['EMAIL']);
  });

  it('falls back when stored severity is invalid', () => {
    const resolved = resolveEscalationPolicy({ minSeverity: 'TRIVIAL' });
    expect(resolved.minSeverity).toBe(DEFAULT_ESCALATION_POLICY.minSeverity);
  });
});

describe('evaluateEscalation', () => {
  const base: EscalationPolicyShape = {
    enabled: true,
    minSeverity: 'URGENT',
    thresholdHours: 24,
    repeatHours: null,
    notifyRoles: ['LANDLORD'],
    channels: ['EMAIL'],
  };
  const now = new Date('2026-05-16T12:00:00Z');

  it('does not escalate below the threshold', () => {
    const result = evaluateEscalation({
      severity: 'URGENT',
      firstSeenAt: new Date(now.getTime() - 10 * HOUR),
      now,
      policy: base,
      highestSentLevel: 0,
    });
    expect(result.escalate).toBe(false);
  });

  it('escalates to level 1 at the threshold when none sent', () => {
    const result = evaluateEscalation({
      severity: 'URGENT',
      firstSeenAt: new Date(now.getTime() - 24 * HOUR),
      now,
      policy: base,
      highestSentLevel: 0,
    });
    expect(result).toEqual({ escalate: true, level: 1 });
  });

  it('does not escalate when policy is disabled', () => {
    const result = evaluateEscalation({
      severity: 'CRITICAL',
      firstSeenAt: new Date(now.getTime() - 100 * HOUR),
      now,
      policy: { ...base, enabled: false },
      highestSentLevel: 0,
    });
    expect(result.escalate).toBe(false);
  });

  it('does not escalate when severity is below minSeverity', () => {
    const result = evaluateEscalation({
      severity: 'WARNING',
      firstSeenAt: new Date(now.getTime() - 100 * HOUR),
      now,
      policy: base,
      highestSentLevel: 0,
    });
    expect(result.escalate).toBe(false);
  });

  it('produces increasing levels with repeatHours cadence', () => {
    const policy = { ...base, repeatHours: 12 };
    // age 24h → level 1
    expect(
      evaluateEscalation({
        severity: 'URGENT',
        firstSeenAt: new Date(now.getTime() - 24 * HOUR),
        now,
        policy,
        highestSentLevel: 0,
      }),
    ).toEqual({ escalate: true, level: 1 });
    // age 36h → level 2
    expect(
      evaluateEscalation({
        severity: 'URGENT',
        firstSeenAt: new Date(now.getTime() - 36 * HOUR),
        now,
        policy,
        highestSentLevel: 1,
      }),
    ).toEqual({ escalate: true, level: 2 });
    // age 48h → level 3
    expect(
      evaluateEscalation({
        severity: 'URGENT',
        firstSeenAt: new Date(now.getTime() - 48 * HOUR),
        now,
        policy,
        highestSentLevel: 2,
      }),
    ).toEqual({ escalate: true, level: 3 });
  });

  it('suppresses when the computed level was already sent', () => {
    const result = evaluateEscalation({
      severity: 'URGENT',
      firstSeenAt: new Date(now.getTime() - 30 * HOUR),
      now,
      policy: base,
      highestSentLevel: 1,
    });
    expect(result.escalate).toBe(false);
  });
});

describe('selectEscalationRecipients', () => {
  const memberships = [
    {
      userId: 'u1',
      role: 'LANDLORD',
      status: 'ACTIVE',
      user: { email: 'l@x.com', phone: '+1345', status: 'ACTIVE' },
    },
    {
      userId: 'u1',
      role: 'PROPERTY_MANAGER',
      status: 'ACTIVE',
      user: { email: 'l@x.com', phone: '+1345', status: 'ACTIVE' },
    },
    {
      userId: 'u2',
      role: 'PROPERTY_MANAGER',
      status: 'ACTIVE',
      user: { email: 'pm@x.com', phone: null, status: 'ACTIVE' },
    },
    {
      userId: 'u3',
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
      user: { email: 'a@x.com', phone: '+1999', status: 'ACTIVE' },
    },
    {
      userId: 'u4',
      role: 'LANDLORD',
      status: 'ACTIVE',
      user: { email: '', phone: '+1', status: 'ACTIVE' },
    },
    {
      userId: 'u5',
      role: 'LANDLORD',
      status: 'ACTIVE',
      user: { email: 'inactive@x.com', phone: '+1', status: 'SUSPENDED' },
    },
  ];

  it('filters by role, dedupes by userId, keeps null phone', () => {
    const result = selectEscalationRecipients(memberships, [
      'LANDLORD',
      'PROPERTY_MANAGER',
    ]);
    expect(result.map((r) => r.userId).sort()).toEqual(['u1', 'u2']);
    const u2 = result.find((r) => r.userId === 'u2');
    expect(u2?.phone).toBeNull();
  });

  it('drops inactive users and empty emails', () => {
    const result = selectEscalationRecipients(memberships, ['LANDLORD']);
    expect(result.map((r) => r.userId)).toEqual(['u1']);
  });

  it('honours the accountant role filter', () => {
    const result = selectEscalationRecipients(memberships, ['ACCOUNTANT']);
    expect(result.map((r) => r.userId)).toEqual(['u3']);
  });
});
