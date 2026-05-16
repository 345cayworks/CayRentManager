import { prisma } from '@/lib/db/prisma';

export type PlatformSettings = {
  timezone: string;
  currency: string;
};

export type EscalationDefaults = {
  enabled: boolean;
  minSeverity: string;
  thresholdHours: number;
};

const DEFAULTS: PlatformSettings = {
  timezone: 'America/Cayman',
  currency: 'KYD',
};

const ESCALATION_DEFAULTS: EscalationDefaults = {
  enabled: true,
  minSeverity: 'URGENT',
  thresholdHours: 24,
};

const KEYS = {
  timezone: 'platform.timezone',
  currency: 'platform.currency',
  escalationEnabled: 'platform.escalation.enabled',
  escalationMinSeverity: 'platform.escalation.minSeverity',
  escalationThresholdHours: 'platform.escalation.thresholdHours',
} as const;

export type PlatformSettingKey = keyof typeof KEYS;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: [KEYS.timezone, KEYS.currency] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      timezone: map.get(KEYS.timezone) ?? DEFAULTS.timezone,
      currency: map.get(KEYS.currency) ?? DEFAULTS.currency,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function getEscalationDefaults(): Promise<EscalationDefaults> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            KEYS.escalationEnabled,
            KEYS.escalationMinSeverity,
            KEYS.escalationThresholdHours,
          ],
        },
      },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const enabledRaw = map.get(KEYS.escalationEnabled);
    const thresholdRaw = map.get(KEYS.escalationThresholdHours);
    const thresholdParsed = thresholdRaw ? Number(thresholdRaw) : NaN;

    return {
      enabled:
        enabledRaw === undefined
          ? ESCALATION_DEFAULTS.enabled
          : enabledRaw === 'true',
      minSeverity: map.get(KEYS.escalationMinSeverity) ?? ESCALATION_DEFAULTS.minSeverity,
      thresholdHours:
        Number.isFinite(thresholdParsed) && thresholdParsed > 0
          ? thresholdParsed
          : ESCALATION_DEFAULTS.thresholdHours,
    };
  } catch {
    return ESCALATION_DEFAULTS;
  }
}

export async function setPlatformSetting(
  key: PlatformSettingKey,
  value: string,
  actorUserId?: string,
) {
  const dbKey = KEYS[key];
  await prisma.systemSetting.upsert({
    where: { key: dbKey },
    create: { key: dbKey, value, updatedBy: actorUserId },
    update: { value, updatedBy: actorUserId },
  });
}

export async function getPlatformSettingRows() {
  try {
    return await prisma.systemSetting.findMany({
      where: { key: { in: [KEYS.timezone, KEYS.currency] } },
    });
  } catch {
    return [];
  }
}
