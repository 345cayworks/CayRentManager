import Link from 'next/link';
import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

type SearchParams = {
  q?: string;
  action?: string;
  entity?: string;
  page?: string;
};

const PAGE_SIZE = 50;

function parsePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 200);
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString('en-KY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function detailSummary(details: unknown): string {
  if (!details || typeof details !== 'object') return '';
  const entries = Object.entries(details as Record<string, unknown>)
    .filter(([key]) => key !== 'request')
    .slice(0, 4);
  if (entries.length === 0) return '';
  return entries
    .map(([key, value]) => {
      if (value === null || value === undefined) return `${key}: —`;
      if (typeof value === 'object') return `${key}: …`;
      const str = String(value);
      return `${key}: ${str.length > 40 ? str.slice(0, 40) + '…' : str}`;
    })
    .join(' · ');
}

function getIp(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const req = (details as Record<string, unknown>).request;
  if (req && typeof req === 'object') {
    const ip = (req as Record<string, unknown>).ip;
    if (typeof ip === 'string') return ip;
  }
  return null;
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSuperadmin();
  const params = await searchParams;

  const q = params.q?.trim() ?? '';
  const actionFilter = params.action?.trim() ?? '';
  const entityFilter = params.entity?.trim() ?? '';
  const page = parsePage(params.page);

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { actorEmail: { contains: q, mode: 'insensitive' } },
      { targetEmail: { contains: q, mode: 'insensitive' } },
      { entityId: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (actionFilter) where.action = actionFilter;
  if (entityFilter) where.entityType = entityFilter;

  const [total, logs, distinctActions, distinctEntities] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
      take: 100,
    }),
    prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
      take: 100,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const prevQs = buildQueryString({ q, action: actionFilter, entity: entityFilter, page: page > 1 ? page - 1 : undefined });
  const nextQs = buildQueryString({ q, action: actionFilter, entity: entityFilter, page: page < totalPages ? page + 1 : undefined });

  return (
    <Shell title="Superadmin Audit Logs">
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <form className="grid gap-3 md:grid-cols-4" method="get">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Search</label>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Actor, target, or entity id"
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Action</label>
              <select name="action" defaultValue={actionFilter} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900">
                <option value="">All actions</option>
                {distinctActions.map((row) => (
                  <option key={row.action} value={row.action}>{row.action}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Entity</label>
              <select name="entity" defaultValue={entityFilter} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900">
                <option value="">All entities</option>
                {distinctEntities.map((row) => (
                  <option key={row.entityType} value={row.entityType}>{row.entityType}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">Apply</button>
              <Link href="/admin/audit" className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-medium leading-9 text-slate-700 hover:bg-slate-50">Reset</Link>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Audit Trail</h3>
              <p className="text-[11px] text-slate-500">
                {total === 0 ? 'No matching entries.' : `Showing ${logs.length} of ${total.toLocaleString()} entries · Page ${page} of ${totalPages}`}
              </p>
            </div>
            <div className="flex gap-2">
              {prevQs ? (
                <Link href={`/admin/audit${prevQs}`} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium leading-8 text-slate-700 hover:bg-slate-50">Prev</Link>
              ) : (
                <span className="h-8 cursor-not-allowed rounded-lg border border-slate-100 px-3 text-xs font-medium leading-8 text-slate-300">Prev</span>
              )}
              {nextQs ? (
                <Link href={`/admin/audit${nextQs}`} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium leading-8 text-slate-700 hover:bg-slate-50">Next</Link>
              ) : (
                <span className="h-8 cursor-not-allowed rounded-lg border border-slate-100 px-3 text-xs font-medium leading-8 text-slate-300">Next</span>
              )}
            </div>
          </div>

          {logs.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">No audit entries match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">When</th>
                    <th className="px-4 py-2 font-semibold">Actor</th>
                    <th className="px-4 py-2 font-semibold">Action</th>
                    <th className="px-4 py-2 font-semibold">Entity</th>
                    <th className="px-4 py-2 font-semibold">Target</th>
                    <th className="px-4 py-2 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="align-top hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-xs font-medium text-slate-950">{log.actorEmail}</div>
                        {getIp(log.details) ? <div className="text-[11px] text-slate-500">IP {getIp(log.details)}</div> : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">{log.action}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">
                        <div className="font-medium">{log.entityType}</div>
                        <div className="font-mono text-[10px] text-slate-500">{log.entityId.slice(0, 12)}…</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">
                        {log.targetEmail ?? log.landlordId ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-600">{detailSummary(log.details)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
