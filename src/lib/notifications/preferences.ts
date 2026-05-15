export type AlertSeverity = 'INFO' | 'WARNING' | 'URGENT' | 'CRITICAL';

export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  URGENT: 2,
  CRITICAL: 3,
};

export type AlertPreferenceInput = {
  digestEnabled: boolean;
  minSeverity: AlertSeverity;
  suppressedTypes: string[];
};

export const DEFAULT_ALERT_PREFERENCE: AlertPreferenceInput = {
  digestEnabled: true,
  minSeverity: 'WARNING',
  suppressedTypes: [],
};

export function isValidSeverity(value: string): value is AlertSeverity {
  return value === 'INFO' || value === 'WARNING' || value === 'URGENT' || value === 'CRITICAL';
}

/**
 * Compare two severities. Returns true when `severity` meets or exceeds the
 * configured `minimum`.
 */
export function severityMeetsMinimum(severity: AlertSeverity, minimum: AlertSeverity) {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[minimum];
}

export type FilterableAlert = {
  type: string;
  severity: string;
};

/**
 * Apply a user's alert preferences to a list of alerts. Returns the subset
 * that should be surfaced to the user given their minimum severity and the
 * types they've suppressed. Unknown severities are treated as INFO (the
 * lowest tier) so they are never silently elevated above the cutoff.
 */
export function filterAlertsForUser<A extends FilterableAlert>(
  alerts: A[],
  preference: AlertPreferenceInput,
): A[] {
  const suppressed = new Set(preference.suppressedTypes);

  return alerts.filter((alert) => {
    if (suppressed.has(alert.type)) return false;

    const sev = isValidSeverity(alert.severity) ? alert.severity : 'INFO';
    return severityMeetsMinimum(sev, preference.minSeverity);
  });
}

/**
 * Merge a stored preference row with the defaults. Used when fetching a row
 * that may not exist yet — the caller can treat absence as "use defaults"
 * without scattering null checks through the codebase.
 */
export type StoredPreferenceShape = {
  digestEnabled?: boolean | null;
  minSeverity?: string | null;
  suppressedTypes?: string[] | null;
};

export function resolvePreference(
  stored: StoredPreferenceShape | null | undefined,
): AlertPreferenceInput {
  if (!stored) return { ...DEFAULT_ALERT_PREFERENCE };

  const minSeverity =
    stored.minSeverity && isValidSeverity(stored.minSeverity)
      ? stored.minSeverity
      : DEFAULT_ALERT_PREFERENCE.minSeverity;

  return {
    digestEnabled:
      stored.digestEnabled === undefined || stored.digestEnabled === null
        ? DEFAULT_ALERT_PREFERENCE.digestEnabled
        : !!stored.digestEnabled,
    minSeverity,
    suppressedTypes: Array.isArray(stored.suppressedTypes) ? stored.suppressedTypes : [],
  };
}
