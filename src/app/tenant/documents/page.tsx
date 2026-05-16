import Link from 'next/link';
import { RecordStatus, UserRole } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireRole } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';

export default async function Page() {
  const user = await requireRole([UserRole.TENANT]);

  const tenant = await prisma.tenant.findFirst({
    where: { userId: user.userId, status: 'ACTIVE' },
  });

  if (!tenant) {
    return (
      <Shell title="My Documents">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No active tenancy is linked to your account yet. Documents shared with you will appear here.
        </div>
      </Shell>
    );
  }

  const [documents, timezone] = await Promise.all([
    prisma.document.findMany({
      where: {
        tenantId: tenant.id,
        visibility: 'TENANT_VISIBLE',
        status: RecordStatus.ACTIVE,
      },
      include: { property: true, lease: true },
      orderBy: { createdAt: 'desc' },
    }),
    getEffectiveTimezone(),
  ]);

  return (
    <Shell title="My Documents">
      <div className="space-y-6">
        <p className="text-sm text-slate-500">
          Lease, compliance, and other documents your landlord has shared with you.
        </p>

        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No documents have been shared with you yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {documents.map((document) => {
              const downloadHref = `/api/documents/${document.id}/download`;
              return (
                <div key={document.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {document.documentType.replaceAll('_', ' ')}
                      </span>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">{document.fileName}</h3>
                      <div className="mt-2 space-y-1 text-sm text-slate-500">
                        {document.property ? <p>Property: {document.property.name}</p> : null}
                        <p>Shared: {formatDate(document.createdAt, timezone)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link href={downloadHref} target="_blank" className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50">Preview</Link>
                      <Link href={`${downloadHref}?download=1`} className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50">Download</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
