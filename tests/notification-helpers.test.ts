import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALERT_PREFERENCE,
  filterAlertsForUser,
  isValidSeverity,
  resolvePreference,
  severityMeetsMinimum,
} from '@/lib/notifications/preferences';
import { buildAlertDigest, type DigestAlert } from '@/lib/notifications/digest';

describe('severity helpers', () => {
  it('recognises valid severities and rejects others', () => {
    expect(isValidSeverity('INFO')).toBe(true);
    expect(isValidSeverity('WARNING')).toBe(true);
    expect(isValidSeverity('URGENT')).toBe(true);
    expect(isValidSeverity('CRITICAL')).toBe(true);
    expect(isValidSeverity('TRIVIAL')).toBe(false);
    expect(isValidSeverity('')).toBe(false);
  });

  it('orders severities correctly', () => {
    expect(severityMeetsMinimum('CRITICAL', 'WARNING')).toBe(true);
    expect(severityMeetsMinimum('WARNING', 'WARNING')).toBe(true);
    expect(severityMeetsMinimum('INFO', 'WARNING')).toBe(false);
    expect(severityMeetsMinimum('URGENT', 'CRITICAL')).toBe(false);
  });
});

describe('resolvePreference', () => {
  it('falls back to defaults when no row is stored', () => {
    expect(resolvePreference(null)).toEqual(DEFAULT_ALERT_PREFERENCE);
    expect(resolvePreference(undefined)).toEqual(DEFAULT_ALERT_PREFERENCE);
  });

  it('falls back to default severity when stored value is invalid', () => {
    const resolved = resolvePreference({
      digestEnabled: true,
      minSeverity: 'TRIVIAL' as never,
      suppressedTypes: [],
    });
    expect(resolved.minSeverity).toBe(DEFAULT_ALERT_PREFERENCE.minSeverity);
  });

  it('coerces null suppressedTypes to an empty list', () => {
    const resolved = resolvePreference({
      digestEnabled: false,
      minSeverity: 'URGENT',
      suppressedTypes: null,
    });
    expect(resolved.suppressedTypes).toEqual([]);
    expect(resolved.digestEnabled).toBe(false);
    expect(resolved.minSeverity).toBe('URGENT');
  });
});

describe('filterAlertsForUser', () => {
  const alerts = [
    { type: 'LEASE_EXPIRING', severity: 'CRITICAL' },
    { type: 'LEASE_EXPIRING', severity: 'INFO' },
    { type: 'VACANT_UNIT', severity: 'WARNING' },
    { type: 'HIGH_BALANCE', severity: 'URGENT' },
  ];

  it('drops alerts below the minimum severity', () => {
    const result = filterAlertsForUser(alerts, {
      digestEnabled: true,
      minSeverity: 'WARNING',
      suppressedTypes: [],
    });
    expect(result).toHaveLength(3);
    expect(result.map((a) => a.severity)).not.toContain('INFO');
  });

  it('drops alerts whose type is suppressed', () => {
    const result = filterAlertsForUser(alerts, {
      digestEnabled: true,
      minSeverity: 'INFO',
      suppressedTypes: ['VACANT_UNIT'],
    });
    expect(result.map((a) => a.type)).not.toContain('VACANT_UNIT');
  });

  it('treats unknown severities as the lowest tier', () => {
    const result = filterAlertsForUser(
      [{ type: 'X', severity: 'EXTRA' as never }],
      { digestEnabled: true, minSeverity: 'WARNING', suppressedTypes: [] },
    );
    expect(result).toHaveLength(0);
  });
});

describe('buildAlertDigest', () => {
  const sampleAlerts: DigestAlert[] = [
    {
      alertKey: 'k1',
      type: 'LEASE_EXPIRING',
      severity: 'WARNING',
      title: 'Lease expiring in 30 days',
      description: 'Tenant Smith at Bay Lofts / B-201',
      daysRemaining: 30,
    },
    {
      alertKey: 'k2',
      type: 'LEASE_EXPIRED',
      severity: 'CRITICAL',
      title: 'Lease expired',
      description: 'Tenant Jones at Bay Lofts / A-101',
      daysRemaining: -3,
    },
    {
      alertKey: 'k3',
      type: 'VACANT_UNIT',
      severity: 'INFO',
      title: 'Unit vacant',
      description: 'C-301 has no active lease',
    },
  ];

  it('returns an empty result when digest is disabled', () => {
    const result = buildAlertDigest({
      workspaceName: 'Acme',
      alerts: sampleAlerts,
      preference: {
        digestEnabled: false,
        minSeverity: 'INFO',
        suppressedTypes: [],
      },
    });
    expect(result.alertCount).toBe(0);
    expect(result.body).toBe('');
  });

  it('returns an empty result when nothing meets the minimum severity', () => {
    const result = buildAlertDigest({
      workspaceName: 'Acme',
      alerts: [{ alertKey: 'k', type: 'X', severity: 'INFO', title: 't', description: 'd' }],
      preference: {
        digestEnabled: true,
        minSeverity: 'CRITICAL',
        suppressedTypes: [],
      },
    });
    expect(result.alertCount).toBe(0);
  });

  it('sorts critical alerts to the top and respects the type suppressed list', () => {
    const result = buildAlertDigest({
      workspaceName: 'Acme',
      alerts: sampleAlerts,
      preference: {
        digestEnabled: true,
        minSeverity: 'WARNING',
        suppressedTypes: ['VACANT_UNIT'],
      },
    });
    expect(result.alertCount).toBe(2);
    expect(result.alertKeys[0]).toBe('k2');
    expect(result.alertKeys).not.toContain('k3');
    expect(result.subject).toContain('Acme');
    expect(result.subject).toContain('2 alert');
    expect(result.body).toContain('Lease expired');
    expect(result.bodyHtml).toContain('Lease expired');
  });

  it('escapes HTML special characters in alert content', () => {
    const result = buildAlertDigest({
      workspaceName: 'A<b>cme</b>',
      alerts: [
        {
          alertKey: 'k',
          type: 'X',
          severity: 'CRITICAL',
          title: '<script>alert(1)</script>',
          description: 'Tenant "Smith" & Co.',
        },
      ],
      preference: {
        digestEnabled: true,
        minSeverity: 'WARNING',
        suppressedTypes: [],
      },
    });
    expect(result.bodyHtml).not.toContain('<script>alert(1)</script>');
    expect(result.bodyHtml).toContain('&lt;script&gt;');
    expect(result.bodyHtml).toContain('&quot;Smith&quot;');
    expect(result.bodyHtml).toContain('A&lt;b&gt;cme&lt;/b&gt;');
  });

  it('includes the configured app URL in the CTA link', () => {
    const result = buildAlertDigest({
      workspaceName: 'Acme',
      alerts: sampleAlerts,
      preference: {
        digestEnabled: true,
        minSeverity: 'WARNING',
        suppressedTypes: [],
      },
      appUrl: 'https://app.example.com/',
    });
    expect(result.bodyHtml).toContain('https://app.example.com/alerts');
    expect(result.body).toContain('https://app.example.com/alerts');
  });
});
