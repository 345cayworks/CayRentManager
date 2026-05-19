import Link from 'next/link';
import type { AccessCodeStatus, AccessCodeType } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  applyAccessCodeToLandlordAction,
  applyReferrerRewardAction,
  archiveAccessCodeAction,
  createAccessCodeAction,
  pauseAccessCodeAction,
  reactivateAccessCodeAction,
  reverseRedemptionAction,
  updateAccessCodeAction,
} from '@/server/access-code-actions';

export const dynamic = 'force-dynamic';

const inputClass =
  'mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900';
const labelClass = 'text-[11px] font-medium uppercase tracking-wide text-slate-500';

const REWARD_TYPES = [
  'PERCENT_DISCOUNT',
  'FIXED_DISCOUNT',
  'FREE_MONTHS',
  'TRIAL_EXTENSION',
  'COMPLIMENTARY_ACCESS',
  'ACCOUNT_CREDIT',
  'UNIT_LIMIT_BONUS',
  'MANUAL_REVIEW',
] as const;

const CODE_TABS: { key: string; type: AccessCodeType; label: string }[] = [
  { key: 'promo', type: 'PROMO', label: 'Promo' },
  { key: 'referral', type: 'REFERRAL', label: 'Referral' },
  { key: 'partner', type: 'PARTNER', label: 'Partner' },
  { key: 'internal', type: 'INTERNAL', label: 'Internal' },
  { key: 'complimentary', type: 'COMPLIMENTARY', label: 'Complimentary' },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  PAUSED: 'bg-amber-50 text-amber-700 ring-amber-100',
  EXPIRED: 'bg-slate-100 text-slate-600 ring-slate-200',
  ARCHIVED: 'bg-slate-100 text-slate-500 ring-slate-200',
  PENDING: 'bg-sky-50 text-sky-700 ring-sky-100',
  APPLIED: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  REVERSED: 'bg-rose-50 text-rose-700 ring-rose-100',
  REJECTED: 'bg-slate-100 text-slate-500 ring-slate-200',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? STATUS_BADGE.ARCHIVED;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}
    >
      {status}
    </span>
  );
}

function money(value: unknown, currency = 'KYD') {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-KY', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function toDateInput(value: Date | null): string {
  if (!value) return '';
  const t = value.getTime();
  if (Number.isNaN(t)) return '';
  return value.toISOString().slice(0, 10);
}

type SearchParams = { tab?: string };

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSuperadmin();

  const tab = searchParams?.tab ?? 'promo';
  const codeTab = CODE_TABS.find((t) => t.key === tab);

  const plans = await prisma.subscriptionPlan.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });

  const tabs = [
    ...CODE_TABS.map((t) => ({ key: t.key, label: t.label })),
    { key: 'redemptions', label: 'Redemptions' },
    { key: 'rewards', label: 'Referrer rewards' },
  ];

  return (
    <Shell title="Growth & Access Codes">
      <div className="space-y-5">
        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/admin/growth?tab=${t.key}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
                tab === t.key
                  ? 'bg-slate-900 text-white ring-slate-900'
                  : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {codeTab ? (
          <CodesTab type={codeTab.type} label={codeTab.label} plans={plans} />
        ) : null}
        {tab === 'redemptions' ? <RedemptionsTab /> : null}
        {tab === 'rewards' ? <RewardsTab /> : null}
      </div>
    </Shell>
  );
}

async function CodesTab({
  type,
  label,
  plans,
}: {
  type: AccessCodeType;
  label: string;
  plans: { id: string; name: string; code: string }[];
}) {
  const codes = await prisma.accessCode.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } } },
  });

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">Create {label.toLowerCase()} code</h2>
        <form action={createAccessCodeAction} className="mt-3 grid gap-3 md:grid-cols-4">
          <input type="hidden" name="type" value={type} />
          <label className={labelClass}>
            Code
            <input name="code" required className={inputClass} placeholder="SUMMER25" />
          </label>
          <label className={labelClass}>
            Reward type
            <select name="rewardType" className={inputClass} defaultValue="PERCENT_DISCOUNT">
              {REWARD_TYPES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Reward value
            <input name="rewardValue" type="number" step="0.01" min="0" className={inputClass} />
          </label>
          <label className={labelClass}>
            Reward months
            <input name="rewardMonths" type="number" min="0" className={inputClass} />
          </label>
          <label className={labelClass}>
            Reward unit limit
            <input name="rewardUnitLimit" type="number" min="0" className={inputClass} />
          </label>
          <label className={labelClass}>
            Applies to plan
            <select name="appliesToPlanId" className={inputClass} defaultValue="">
              <option value="">Any plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Campaign name
            <input name="campaignName" className={inputClass} />
          </label>
          <label className={labelClass}>
            Max redemptions
            <input name="maxRedemptions" type="number" min="0" className={inputClass} />
          </label>
          <label className={labelClass}>
            Max per email
            <input
              name="maxRedemptionsPerEmail"
              type="number"
              min="1"
              defaultValue={1}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Starts at
            <input name="startsAt" type="date" className={inputClass} />
          </label>
          <label className={labelClass}>
            Expires at
            <input name="expiresAt" type="date" className={inputClass} />
          </label>
          <label className="flex items-end gap-2 text-xs font-medium text-slate-700">
            <input type="checkbox" name="isStackable" /> Stackable
          </label>
          <label className={`${labelClass} md:col-span-4`}>
            Description
            <textarea
              name="description"
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          {type === 'REFERRAL' ? (
            <>
              <label className={labelClass}>
                Referrer user id
                <input name="referrerUserId" className={inputClass} />
              </label>
              <label className={labelClass}>
                Referrer landlord id
                <input name="referrerLandlordId" className={inputClass} />
              </label>
              <label className={labelClass}>
                Referrer reward type
                <select name="referrerRewardType" className={inputClass} defaultValue="">
                  <option value="">None</option>
                  {REWARD_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Referrer reward value
                <input
                  name="referrerRewardValue"
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Referrer reward months
                <input
                  name="referrerRewardMonths"
                  type="number"
                  min="0"
                  className={inputClass}
                />
              </label>
              <label className={`${labelClass} md:col-span-3`}>
                Registrant benefit description
                <input name="registrantBenefitDescription" className={inputClass} />
              </label>
            </>
          ) : null}
          <div className="flex items-end justify-end md:col-span-4">
            <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">
              Create code
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-950">{label} codes</h3>
        </div>
        {codes.length === 0 ? (
          <p className="p-4 text-sm text-slate-600">No {label.toLowerCase()} codes yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {codes.map((code) => (
              <li key={code.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {code.code}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        · {code.rewardType}
                        {code.rewardValue !== null ? ` · ${money(code.rewardValue)}` : ''}
                        {code.rewardMonths !== null ? ` · ${code.rewardMonths}mo` : ''}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {code.campaignName ? `${code.campaignName} · ` : ''}
                      Redemptions: {code._count.redemptions}
                      {code.maxRedemptions !== null ? ` / ${code.maxRedemptions}` : ''}
                    </p>
                    {code.description ? (
                      <p className="text-xs text-slate-500">{code.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={code.status} />
                    <CodeActions status={code.status} id={code.id} />
                  </div>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-slate-600">
                    Edit code
                  </summary>
                  <form
                    action={updateAccessCodeAction}
                    className="mt-3 grid gap-3 md:grid-cols-4"
                  >
                    <input type="hidden" name="accessCodeId" value={code.id} />
                    <label className={labelClass}>
                      Type
                      <select name="type" defaultValue={code.type} className={inputClass}>
                        {CODE_TABS.map((t) => (
                          <option key={t.type} value={t.type}>
                            {t.type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Reward type
                      <select
                        name="rewardType"
                        defaultValue={code.rewardType}
                        className={inputClass}
                      >
                        {REWARD_TYPES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Reward value
                      <input
                        name="rewardValue"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={code.rewardValue !== null ? Number(code.rewardValue) : ''}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Reward months
                      <input
                        name="rewardMonths"
                        type="number"
                        min="0"
                        defaultValue={code.rewardMonths ?? ''}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Reward unit limit
                      <input
                        name="rewardUnitLimit"
                        type="number"
                        min="0"
                        defaultValue={code.rewardUnitLimit ?? ''}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Campaign name
                      <input
                        name="campaignName"
                        defaultValue={code.campaignName ?? ''}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Max redemptions
                      <input
                        name="maxRedemptions"
                        type="number"
                        min="0"
                        defaultValue={code.maxRedemptions ?? ''}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Max per email
                      <input
                        name="maxRedemptionsPerEmail"
                        type="number"
                        min="1"
                        defaultValue={code.maxRedemptionsPerEmail}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Starts at
                      <input
                        name="startsAt"
                        type="date"
                        defaultValue={toDateInput(code.startsAt)}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Expires at
                      <input
                        name="expiresAt"
                        type="date"
                        defaultValue={toDateInput(code.expiresAt)}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex items-end gap-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        name="isStackable"
                        defaultChecked={code.isStackable}
                      />{' '}
                      Stackable
                    </label>
                    <label className={`${labelClass} md:col-span-4`}>
                      Description
                      <textarea
                        name="description"
                        rows={2}
                        defaultValue={code.description ?? ''}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                      />
                    </label>
                    <label className={labelClass}>
                      Referrer user id
                      <input
                        name="referrerUserId"
                        defaultValue={code.referrerUserId ?? ''}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Referrer landlord id
                      <input
                        name="referrerLandlordId"
                        defaultValue={code.referrerLandlordId ?? ''}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Referrer reward type
                      <select
                        name="referrerRewardType"
                        defaultValue={code.referrerRewardType ?? ''}
                        className={inputClass}
                      >
                        <option value="">None</option>
                        {REWARD_TYPES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Referrer reward value
                      <input
                        name="referrerRewardValue"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={
                          code.referrerRewardValue !== null
                            ? Number(code.referrerRewardValue)
                            : ''
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Referrer reward months
                      <input
                        name="referrerRewardMonths"
                        type="number"
                        min="0"
                        defaultValue={code.referrerRewardMonths ?? ''}
                        className={inputClass}
                      />
                    </label>
                    <label className={`${labelClass} md:col-span-2`}>
                      Registrant benefit description
                      <input
                        name="registrantBenefitDescription"
                        defaultValue={code.registrantBenefitDescription ?? ''}
                        className={inputClass}
                      />
                    </label>
                    <div className="flex items-end justify-end md:col-span-4">
                      <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">
                        Save changes
                      </button>
                    </div>
                  </form>
                </details>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-600">
                    Apply to existing landlord
                  </summary>
                  <form
                    action={applyAccessCodeToLandlordAction}
                    className="mt-3 flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="code" value={code.code} />
                    <label className={labelClass}>
                      Landlord id
                      <input name="landlordId" required className={inputClass} />
                    </label>
                    <button className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Apply to landlord
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CodeActions({ status, id }: { status: AccessCodeStatus; id: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === 'ACTIVE' ? (
        <form action={pauseAccessCodeAction}>
          <input type="hidden" name="accessCodeId" value={id} />
          <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Pause
          </button>
        </form>
      ) : null}
      {status === 'PAUSED' || status === 'EXPIRED' ? (
        <form action={reactivateAccessCodeAction}>
          <input type="hidden" name="accessCodeId" value={id} />
          <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Reactivate
          </button>
        </form>
      ) : null}
      {status !== 'ARCHIVED' ? (
        <form action={archiveAccessCodeAction}>
          <input type="hidden" name="accessCodeId" value={id} />
          <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Archive
          </button>
        </form>
      ) : (
        <form action={reactivateAccessCodeAction}>
          <input type="hidden" name="accessCodeId" value={id} />
          <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Reactivate
          </button>
        </form>
      )}
    </div>
  );
}

async function RedemptionsTab() {
  const redemptions = await prisma.accessCodeRedemption.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-950">Redemptions</h3>
      </div>
      {redemptions.length === 0 ? (
        <p className="p-4 text-sm text-slate-600">No redemptions yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {redemptions.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {r.code}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    · {r.registrantEmail}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Created {r.createdAt.toISOString().slice(0, 10)}
                  {r.appliedAt ? ` · Applied ${r.appliedAt.toISOString().slice(0, 10)}` : ''}
                  {r.subscriptionId ? ` · sub ${r.subscriptionId}` : ''}
                  {r.invoiceId ? ` · inv ${r.invoiceId}` : ''}
                </p>
                {r.notes ? <p className="text-xs text-slate-500">{r.notes}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {r.status === 'PENDING' || r.status === 'APPLIED' ? (
                  <>
                    {r.status === 'PENDING' && r.registrantLandlordId ? (
                      <form action={applyAccessCodeToLandlordAction}>
                        <input type="hidden" name="redemptionId" value={r.id} />
                        <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          Apply
                        </button>
                      </form>
                    ) : null}
                    <form action={reverseRedemptionAction}>
                      <input type="hidden" name="redemptionId" value={r.id} />
                      <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        Reverse
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function RewardsTab() {
  const redemptions = await prisma.accessCodeRedemption.findMany({
    where: {
      OR: [{ referrerUserId: { not: null } }, { referrerLandlordId: { not: null } }],
      status: { in: ['PENDING', 'APPLIED'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-950">Referrer rewards</h3>
        <p className="text-[11px] text-slate-500">
          Manual referrer reward application. Automatic payout on first paid invoice is Phase 3.
        </p>
      </div>
      {redemptions.length === 0 ? (
        <p className="p-4 text-sm text-slate-600">No pending referrer rewards.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {redemptions.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {r.code}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    · {r.registrantEmail}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Referrer:{' '}
                  {r.referrerLandlordId
                    ? `landlord ${r.referrerLandlordId}`
                    : r.referrerUserId
                      ? `user ${r.referrerUserId}`
                      : '—'}
                  {r.referrerBenefitApplied ? ' · reward recorded' : ''}
                </p>
              </div>
              <form action={applyReferrerRewardAction}>
                <input type="hidden" name="redemptionId" value={r.id} />
                <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Apply referrer reward (manual)
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
