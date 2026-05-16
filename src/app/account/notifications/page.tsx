import Link from 'next/link';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  DEFAULT_ALERT_PREFERENCE,
  resolvePreference,
} from '@/lib/notifications/preferences';
import {
  updateAlertPreferencesAction,
  updateEscalationPolicyAction,
} from '@/server/notification-preference-actions';
import { resolveEscalationPolicy } from '@/lib/notifications/escalation';

export const dynamic = 'force-dynamic';

const SEVERITY_OPTIONS = [
  { value: 'INFO', label: 'INFO — every alert, including low-priority' },
  { value: 'WARNING', label: 'WARNING — skip INFO-only alerts (default)' },
  { value: 'URGENT', label: 'URGENT — only urgent and critical alerts' },
  { value: 'CRITICAL', label: 'CRITICAL — only critical alerts' },
];

const ESCALATION_ROLE_OPTIONS = [
  { value: 'LANDLORD', label: 'Landlord' },
  { value: 'PROPERTY_MANAGER', label: 'Property manager' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
];

const ESCALATION_CHANNEL_OPTIONS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

const ALERT_TYPE_OPTIONS = [
  { value: 'LEASE_EXPIRED', label: 'Lease expired' },
  { value: 'LEASE_EXPIRING', label: 'Lease expiring soon' },
  { value: 'RENEWAL_NOT_STARTED', label: 'Renewal not started' },
  { value: 'RENEWAL_PENDING', label: 'Renewal pending' },
  { value: 'VACANT_UNIT', label: 'Vacant unit' },
  { value: 'HIGH_BALANCE', label: 'High outstanding balance' },
  { value: 'NO_NOTICE_RECORDED', label: 'No notice recorded' },
];

export default async function Page({
  searchParams,
}: {
  searchParams?: { updated?: string };
}) {
  const { user, landlordId, membership } = await getCurrentLandlordWorkspace();
  const justUpdated = searchParams?.updated === '1';

  const storedRow = await prisma.alertPreference.findUnique({
    where: {
      landlordId_userId: { landlordId, userId: user.userId },
    },
  });

  const preference = resolvePreference(storedRow);
  const suppressedSet = new Set(preference.suppressedTypes);

  const storedEscalation = await prisma.escalationPolicy.findUnique({
    where: { landlordId },
  });
  const escalation = resolveEscalationPolicy(
    storedEscalation
      ? {
          enabled: storedEscalation.enabled,
          minSeverity: storedEscalation.minSeverity,
          thresholdHours: storedEscalation.thresholdHours,
          repeatHours: storedEscalation.repeatHours,
          notifyRoles: storedEscalation.notifyRoles,
          channels: storedEscalation.channels,
        }
      : null,
  );
  const escalationRoleSet = new Set(escalation.notifyRoles);
  const escalationChannelSet = new Set(escalation.channels);

  return (
    <Shell title="Notification Preferences">
      {justUpdated && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Preferences saved.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-950">How this works</h3>
            <p className="mt-2 text-sm text-slate-600">
              These preferences control which Alert Center notifications you receive
              by email for <span className="font-medium">{membership.landlord.displayName}</span>.
              The daily digest summarises active alerts that meet your minimum severity
              and that aren&apos;t in your suppressed-types list. They do not change
              what other workspace members receive.
            </p>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-950">Edit preferences</h3>
            <form
              action={updateAlertPreferencesAction}
              className="mt-4 space-y-5"
            >
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="digestEnabled"
                  defaultChecked={preference.digestEnabled}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="font-medium text-slate-900">
                    Send me the daily alert digest
                  </span>
                  <span className="block text-xs text-slate-500">
                    One email per day summarising active alerts in this workspace.
                  </span>
                </span>
              </label>

              <fieldset className="text-sm">
                <legend className="font-medium text-slate-900">Minimum severity</legend>
                <p className="text-xs text-slate-500">
                  Alerts below this severity are excluded from your digest.
                </p>
                <div className="mt-3 space-y-2">
                  {SEVERITY_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="minSeverity"
                        value={option.value}
                        defaultChecked={preference.minSeverity === option.value}
                        className="h-4 w-4 border-slate-300"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="text-sm">
                <legend className="font-medium text-slate-900">Suppress alert types</legend>
                <p className="text-xs text-slate-500">
                  Tick any alert types you don&apos;t want in your digest. Active and
                  suppressed alerts still appear in the in-app Alert Center.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ALERT_TYPE_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="suppressedTypes"
                        value={option.value}
                        defaultChecked={suppressedSet.has(option.value)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <button
                  type="submit"
                  className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90"
                >
                  Save preferences
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-950">Escalation policy</h3>
            <p className="mt-2 text-sm text-slate-600">
              When an alert stays active and un-acknowledged past the threshold,
              CayRentManager escalates it to the selected workspace roles. Leave
              repeat hours blank to escalate once only. Platform defaults apply
              when this policy is left at its defaults.
            </p>
            <form
              action={updateEscalationPolicyAction}
              className="mt-4 space-y-5"
            >
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={escalation.enabled}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span className="font-medium text-slate-900">
                  Enable escalation for this workspace
                </span>
              </label>

              <label className="block text-sm">
                <span className="font-medium text-slate-900">Minimum severity</span>
                <select
                  name="minSeverity"
                  defaultValue={escalation.minSeverity}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                >
                  {SEVERITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-slate-900">Threshold hours</span>
                  <input
                    type="number"
                    name="thresholdHours"
                    min={1}
                    max={720}
                    defaultValue={escalation.thresholdHours}
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-900">
                    Repeat hours (blank = once)
                  </span>
                  <input
                    type="number"
                    name="repeatHours"
                    min={1}
                    max={720}
                    defaultValue={escalation.repeatHours ?? ''}
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <fieldset className="text-sm">
                <legend className="font-medium text-slate-900">Notify roles</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ESCALATION_ROLE_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="notifyRoles"
                        value={option.value}
                        defaultChecked={escalationRoleSet.has(option.value)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="text-sm">
                <legend className="font-medium text-slate-900">
                  Delivery channels
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ESCALATION_CHANNEL_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="channels"
                        value={option.value}
                        defaultChecked={escalationChannelSet.has(option.value)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <button
                  type="submit"
                  className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90"
                >
                  Save escalation policy
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-950">Related</h3>
            <div className="mt-3 space-y-2 text-sm">
              <Link href="/alerts" className="block text-brand-navy">
                Open Alert Center
              </Link>
              <Link href="/account/profile" className="block text-brand-navy">
                Back to profile
              </Link>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-950">Defaults</h3>
            <p className="mt-2 text-xs text-slate-500">
              New workspaces start with digest enabled and minimum severity set to{' '}
              <span className="font-medium">{DEFAULT_ALERT_PREFERENCE.minSeverity}</span>.
            </p>
          </section>
        </aside>
      </div>
    </Shell>
  );
}
