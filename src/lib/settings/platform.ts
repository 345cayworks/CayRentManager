import { prisma } from '@/lib/db/prisma';

export type PlatformSettings = {
  timezone: string;
  currency: string;
};

const DEFAULTS: PlatformSettings = {
  timezone: 'America/Cayman',
  currency: 'KYD',
};

const KEYS = {
  timezone: 'platform.timezone',
  currency: 'platform.currency',
};

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

export async function setPlatformSetting(key: keyof PlatformSettings, value: string, actorUserId?: string) {
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
