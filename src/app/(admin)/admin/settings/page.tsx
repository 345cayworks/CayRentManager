import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getPlatformSettings } from '@/lib/settings/platform';
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
  formatDateTime,
} from '@/lib/time/format';
import { updatePlatformSettingsAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireSuperadmin();

  const settings = await getPlatformSettings();
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: ['platform.timezone', 'platform.currency'] } },
  });

  const lastUpdatedRow = rows.reduce<{ updatedAt: Date; updatedBy: string | null } | null>(
    (latest, row) => {
      if (!latest || row.updatedAt > latest.updatedAt) {
        return { updatedAt: row.updatedAt, updatedBy: row.updatedBy };
      }
      return latest;
    },
    null,
  );

  let updatedByEmail: string | null = null;
  if (lastUpdatedRow?.updatedBy) {
    const actor = await prisma.user.findUnique({
      where: { id: lastUpdatedRow.updatedBy },
      select: { email: true },
    });
    updatedByEmail = actor?.email ?? null;
  }

  return (
    <Shell title="Superadmin Settings">
      <div className="space-y-6">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Platform defaults</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Platform defaults apply to superadmins and as fallbacks. Landlords override
            via their workspace settings (see Account Profile &rarr; Workspace Settings).
          </p>

          <form
            action={updatePlatformSettingsAction}
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Default timezone</span>
              <select
                name="timezone"
                defaultValue={settings.timezone}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
              >
                {SUPPORTED_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Default currency</span>
              <select
                name="currency"
                defaultValue={settings.currency}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white"
              >
                Save platform defaults
              </button>
            </div>
          </form>

          {lastUpdatedRow ? (
            <p className="mt-4 text-xs text-slate-500">
              Last updated{' '}
              {formatDateTime(lastUpdatedRow.updatedAt, settings.timezone)}
              {updatedByEmail ? ` by ${updatedByEmail}` : ''}.
            </p>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              No overrides recorded — falling back to built-in defaults
              (America/Cayman, KYD).
            </p>
          )}
        </section>
      </div>
    </Shell>
  );
}
