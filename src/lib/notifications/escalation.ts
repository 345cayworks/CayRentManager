import { SEVERITY_ORDER, isValidSeverity } from './preferences';

export type EscalationPolicyShape = {
  enabled: boolean;
  minSeverity: string;
  thresholdHours: number;
  repeatHours: number | null;
  notifyRoles: string[];
  channels: string[];
};

export const DEFAULT_ESCALATION_POLICY: EscalationPolicyShape = {
  enabled: true,
  minSeverity: 'URGENT',
  thresholdHours: 24,
  repeatHours: null,
  notifyRoles: ['LANDLORD', 'PROPERTY_MANAGER'],
  channels: ['EMAIL'],
};

function normaliseSeverity(value: string | null | undefined): string {
  if (value && isValidSeverity(value)) return value;
  return DEFAULT_ESCALATION_POLICY.minSeverity;
}

/**
 * Merge a stored escalation policy row (which may be null) with optional
 * platform-level defaults and finally the hard-coded defaults. Each layer only
 * supplies a value when the higher-priority layer left it absent, so existing
 * callers can treat "no row" as "use platform / built-in defaults" without
 * scattering null checks.
 */
export function resolveEscalationPolicy(
  stored: Partial<EscalationPolicyShape> | null | undefined,
  platformDefaults?: Partial<EscalationPolicyShape>,
): EscalationPolicyShape {
  const layered: Partial<EscalationPolicyShape> = {
    ...DEFAULT_ESCALATION_POLICY,
    ...(platformDefaults ?? {}),
    ...(stored ?? {}),
  };

  return {
    enabled:
      typeof layered.enabled === 'boolean'
        ? layered.enabled
        : DEFAULT_ESCALATION_POLICY.enabled,
    minSeverity: normaliseSeverity(layered.minSeverity),
    thresholdHours:
      typeof layered.thresholdHours === 'number' && layered.thresholdHours > 0
        ? layered.thresholdHours
        : DEFAULT_ESCALATION_POLICY.thresholdHours,
    repeatHours:
      typeof layered.repeatHours === 'number' && layered.repeatHours > 0
        ? layered.repeatHours
        : null,
    notifyRoles:
      Array.isArray(layered.notifyRoles) && layered.notifyRoles.length > 0
        ? layered.notifyRoles
        : [...DEFAULT_ESCALATION_POLICY.notifyRoles],
    channels:
      Array.isArray(layered.channels) && layered.channels.length > 0
        ? layered.channels
        : [...DEFAULT_ESCALATION_POLICY.channels],
  };
}

function severityRank(value: string): number {
  if (isValidSeverity(value)) return SEVERITY_ORDER[value];
  return SEVERITY_ORDER.INFO;
}

/**
 * Decide whether an ACTIVE, unreviewed alert should escalate now and to what
 * level. Levels start at 1 for the first escalation. With repeatHours set, the
 * level increments every repeatHours past the threshold. Returns
 * { escalate:false } when below threshold, when the severity gate excludes it,
 * when the policy is disabled, or when the computed level was already recorded.
 */
export function evaluateEscalation(params: {
  severity: string;
  firstSeenAt: Date;
  now: Date;
  policy: EscalationPolicyShape;
  highestSentLevel: number;
}): { escalate: boolean; level: number } {
  const { severity, firstSeenAt, now, policy, highestSentLevel } = params;

  if (!policy.enabled) return { escalate: false, level: 0 };

  if (severityRank(severity) < severityRank(policy.minSeverity)) {
    return { escalate: false, level: 0 };
  }

  const ageHours = (now.getTime() - firstSeenAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < policy.thresholdHours) return { escalate: false, level: 0 };

  let level: number;
  if (policy.repeatHours && policy.repeatHours > 0) {
    level = 1 + Math.floor((ageHours - policy.thresholdHours) / policy.repeatHours);
  } else {
    level = 1;
  }

  if (level <= highestSentLevel) return { escalate: false, level };

  return { escalate: true, level };
}

/**
 * Resolve escalation recipients from workspace memberships, filtered by the
 * policy's notifyRoles, deduped by userId, dropping inactive users and users
 * without an email. A null phone is kept (the caller decides which channels to
 * skip per recipient).
 */
export function selectEscalationRecipients(
  memberships: Array<{
    userId: string;
    role: string;
    status: string;
    user: { email: string | null; phone: string | null; status: string };
  }>,
  notifyRoles: string[],
): Array<{ userId: string; email: string; phone: string | null }> {
  const roleSet = new Set(notifyRoles);
  const seen = new Set<string>();
  const recipients: Array<{ userId: string; email: string; phone: string | null }> = [];

  for (const membership of memberships) {
    if (!roleSet.has(membership.role)) continue;
    if (membership.status !== 'ACTIVE') continue;
    if (membership.user.status !== 'ACTIVE') continue;

    const email = membership.user.email?.trim();
    if (!email) continue;

    if (seen.has(membership.userId)) continue;
    seen.add(membership.userId);

    recipients.push({
      userId: membership.userId,
      email,
      phone: membership.user.phone?.trim() || null,
    });
  }

  return recipients;
}
