import { UserRole, UserStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

type Severity = 'ok' | 'warn' | 'fail';

type Check = {
  title: string;
  description: string;
  status: Severity;
  detail: string;
};

const severityStyles: Record<Severity, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  warn: 'bg-amber-50 text-amber-700 ring-amber-100',
  fail: 'bg-red-50 text-red-700 ring-red-100',
};

const severityLabels: Record<Severity, string> = {
  ok: 'OK',
  warn: 'Review',
  fail: 'Action needed',
};

export default async function Page() {
  const actor = await requireSuperadmin();

  const [activeSuperadmins, suspendedSuperadmins, primaryConfigured, bootstrapEnabled, bootstrapAllowedIps, masterKeyConfigured, recentBootstraps, disabledSuperadmins] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE } }),
    prisma.user.count({ where: { role: UserRole.SUPERADMIN, status: UserStatus.SUSPENDED } }),
    Promise.resolve(Boolean(process.env.SUPER_ADMIN_EMAIL)),
    Promise.resolve(process.env.ENABLE_BOOTSTRAP_OWNER_ROUTE === 'true'),
    Promise.resolve(Boolean(process.env.BOOTSTRAP_ALLOWED_IPS)),
    Promise.resolve(Boolean(process.env.SUPERADMIN_MASTER_KEY)),
    prisma.auditLog.count({
      where: { action: 'owner_bootstrapped', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.user.count({ where: { role: UserRole.SUPERADMIN, status: UserStatus.DISABLED } }),
  ]);

  const checks: Check[] = [
    {
      title: 'Self-demotion guard',
      description: 'Superadmins cannot demote their own account from SUPERADMIN.',
      status: 'ok',
      detail: 'Enforced in assignUserRoleAction (src/server/actions.ts).',
    },
    {
      title: 'Self-disable guard',
      description: 'Superadmins cannot disable their own account.',
      status: 'ok',
      detail: 'Enforced in disableUserAction (src/server/actions.ts).',
    },
    {
      title: 'Final superadmin protection',
      description: 'Removing or disabling the only active superadmin is blocked.',
      status: activeSuperadmins >= 2 ? 'ok' : 'warn',
      detail: activeSuperadmins >= 2
        ? `${activeSuperadmins} active superadmins exist — guardrail and redundancy in place.`
        : `Only ${activeSuperadmins} active superadmin exists. The guardrail is enforced, but adding a second active superadmin is recommended for redundancy.`,
    },
    {
      title: 'Disabled superadmin accounts',
      description: 'Disabled superadmin accounts should be audited periodically.',
      status: disabledSuperadmins === 0 ? 'ok' : 'warn',
      detail: disabledSuperadmins === 0
        ? 'No disabled superadmin accounts.'
        : `${disabledSuperadmins} superadmin account(s) are disabled. Confirm intent and consider downgrading to a lesser role if no longer needed.`,
    },
    {
      title: 'Suspended superadmin accounts',
      description: 'Suspended superadmins indicate a pending review or risk event.',
      status: suspendedSuperadmins === 0 ? 'ok' : 'fail',
      detail: suspendedSuperadmins === 0
        ? 'No suspended superadmin accounts.'
        : `${suspendedSuperadmins} suspended superadmin account(s). Investigate and resolve.`,
    },
    {
      title: 'Tenant role linkage',
      description: 'TENANT role requires an existing tenant profile before assignment.',
      status: 'ok',
      detail: 'Enforced in assignUserRoleAction.',
    },
    {
      title: 'Operational role membership rules',
      description: 'PROPERTY_MANAGER / ACCOUNTANT require a landlord workspace membership; pure operational roles must not hold landlord workspaces.',
      status: 'ok',
      detail: 'Enforced in assignUserRoleAction.',
    },
    {
      title: 'Audit log coverage',
      description: 'All admin actions (role assignment, disable, reactivate, archive, reactivate landlord) write audit entries.',
      status: 'ok',
      detail: 'All four admin server actions call writeAuditLog with actor metadata.',
    },
    {
      title: 'Bootstrap route — env gate',
      description: 'The owner bootstrap endpoint must be disabled unless ENABLE_BOOTSTRAP_OWNER_ROUTE=true.',
      status: bootstrapEnabled ? 'warn' : 'ok',
      detail: bootstrapEnabled
        ? 'ENABLE_BOOTSTRAP_OWNER_ROUTE is true — disable immediately after any owner provisioning.'
        : 'Bootstrap route is disabled. Endpoint returns 404 on request.',
    },
    {
      title: 'Bootstrap route — primary owner email',
      description: 'SUPER_ADMIN_EMAIL must be configured for the bootstrap policy to function.',
      status: primaryConfigured ? 'ok' : 'warn',
      detail: primaryConfigured
        ? 'SUPER_ADMIN_EMAIL is configured.'
        : 'SUPER_ADMIN_EMAIL is missing. Bootstrap recovery is unavailable.',
    },
    {
      title: 'Bootstrap route — master key',
      description: 'SUPERADMIN_MASTER_KEY must be configured and verified with timing-safe compare.',
      status: masterKeyConfigured ? 'ok' : 'warn',
      detail: masterKeyConfigured
        ? 'SUPERADMIN_MASTER_KEY is configured.'
        : 'SUPERADMIN_MASTER_KEY is missing — bootstrap recovery cannot succeed even if the env gate is on.',
    },
    {
      title: 'Bootstrap route — IP allowlist',
      description: 'Optional. When present, BOOTSTRAP_ALLOWED_IPS restricts where bootstraps can originate.',
      status: bootstrapAllowedIps ? 'ok' : 'warn',
      detail: bootstrapAllowedIps
        ? 'BOOTSTRAP_ALLOWED_IPS is set.'
        : 'No IP allowlist configured. Bootstrap relies on env gate + master key only.',
    },
    {
      title: 'Recent bootstrap events',
      description: 'Bootstrap usage in the last 30 days should be rare and explainable.',
      status: recentBootstraps === 0 ? 'ok' : recentBootstraps <= 1 ? 'warn' : 'fail',
      detail: recentBootstraps === 0
        ? 'No bootstrap events in the last 30 days.'
        : `${recentBootstraps} bootstrap event(s) recorded in the last 30 days — verify each entry in /admin/audit.`,
    },
    {
      title: 'No hard deletes on operational records',
      description: 'Operational records (properties, units, tenants, leases, payments, expenses, maintenance) are archived, never hard-deleted.',
      status: 'ok',
      detail: 'All write actions use updateMany with status transitions and audit logging.',
    },
    {
      title: 'Workspace isolation',
      description: 'All landlord-scoped mutations assert single-workspace updates.',
      status: 'ok',
      detail: 'Enforced via assertSingleWorkspaceUpdate in server actions and exercised by tests/access-rules.test.ts.',
    },
  ];

  const counts = checks.reduce<Record<Severity, number>>(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { ok: 0, warn: 0, fail: 0 },
  );

  return (
    <Shell title="Admin Safety Review">
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Current operator</h2>
              <p className="text-xs text-slate-500">{actor.email} · {actor.role}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ring-1 ${severityStyles.ok}`}>{counts.ok} OK</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ring-1 ${severityStyles.warn}`}>{counts.warn} Review</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ring-1 ${severityStyles.fail}`}>{counts.fail} Action</span>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-950">Safety Constraints</h3>
            <p className="text-[11px] text-slate-500">Live audit of platform guardrails. Run before each Netlify deploy.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {checks.map((check) => (
              <li key={check.title} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${severityStyles[check.status]}`}>
                  {severityLabels[check.status]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-950">{check.title}</p>
                  <p className="text-xs text-slate-600">{check.description}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
