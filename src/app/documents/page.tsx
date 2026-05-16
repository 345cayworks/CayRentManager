import Link from 'next/link';
import { DocumentSource, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  archiveDocumentAction,
  createDocumentAction,
  deleteBrokenPlaceholderAction,
  uploadDocumentAction,
} from '@/server/document-actions';

const documentTypes = [
  'LEASE',
  'TENANT_ID',
  'INVOICE',
  'RECEIPT',
  'INSPECTION',
  'MAINTENANCE',
  'COMPLIANCE',
  'INSURANCE',
  'BANKING',
  'OTHER',
];

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    ARCHIVED: 'bg-slate-200 text-slate-700',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}

function VisibilityCheckbox() {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700 xl:col-span-2">
      <input type="checkbox" name="visibility" value="tenant" className="mt-1" />
      <span>Visible to the linked tenant (only applies if a tenant is selected)</span>
    </label>
  );
}

function UploadAssociationFields({
  properties,
  units,
  tenants,
  leases,
}: {
  properties: any[];
  units: any[];
  tenants: any[];
  leases: any[];
}) {
  return (
    <>
      <div>
        <label className="text-sm font-medium text-slate-700">Property</label>
        <select name="propertyId" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
          <option value="">Optional</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>{property.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Unit</label>
        <select name="unitId" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
          <option value="">Optional</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.property.name} / {unit.unitName}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Tenant</label>
        <select name="tenantId" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
          <option value="">Optional</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>{tenant.fullName}</option>
          ))}
        </select>
      </div>

      <div className="xl:col-span-2">
        <label className="text-sm font-medium text-slate-700">Lease</label>
        <select name="leaseId" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
          <option value="">Optional</option>
          {leases.map((lease) => (
            <option key={lease.id} value={lease.id}>{lease.tenant.fullName} / {lease.property.name}</option>
          ))}
        </select>
      </div>

      <VisibilityCheckbox />
    </>
  );
}

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const [documents, properties, units, tenants, leases] = await Promise.all([
    prisma.document.findMany({
      where: { landlordId },
      include: { property: true, unit: true, tenant: true, lease: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.property.findMany({ where: { landlordId }, orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ where: { landlordId }, include: { property: true }, orderBy: { unitName: 'asc' } }),
    prisma.tenant.findMany({ where: { landlordId }, orderBy: { fullName: 'asc' } }),
    prisma.lease.findMany({
      where: { landlordId },
      include: { tenant: true, property: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const activeDocuments = documents.filter((doc) => doc.status === RecordStatus.ACTIVE);
  const archivedDocuments = documents.filter((doc) => doc.status === RecordStatus.ARCHIVED);
  const brokenCount = documents.filter((doc) => doc.source === DocumentSource.BROKEN_PLACEHOLDER).length;

  return (
    <Shell title="Document Vault">
      <div className="space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Operations & Compliance</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">Document Vault</h1>
              <p className="mt-4 max-w-2xl text-sm text-slate-300">
                Centralized document management for leases, inspections, invoices, compliance records, maintenance evidence, and tenant files.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-slate-300">Active</p>
                <p className="mt-2 text-3xl font-black">{activeDocuments.length}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-slate-300">Archived</p>
                <p className="mt-2 text-3xl font-black">{archivedDocuments.length}</p>
              </div>
            </div>
          </div>
        </section>

        {brokenCount > 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {brokenCount} document record(s) reference files that were never stored. They are flagged
            below — please re-upload and remove the broken records.
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900">External Document Link</h2>
              <p className="mt-2 text-sm text-slate-500">Save documents hosted externally.</p>
            </div>

            <form action={createDocumentAction} className="grid gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Document Type</label>
                <select required name="documentType" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
                  <option value="">Select type</option>
                  {documentTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">File Name</label>
                <input required name="fileName" placeholder="Lease Agreement.pdf" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">File URL</label>
                <input required name="fileUrl" placeholder="https://..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
              </div>

              <UploadAssociationFields properties={properties} units={units} tenants={tenants} leases={leases} />

              <button type="submit" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Save External Document
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900">Upload Document</h2>
              <p className="mt-2 text-sm text-slate-500">Files are stored securely in Netlify Blobs.</p>
            </div>

            <form action={uploadDocumentAction} encType="multipart/form-data" className="grid gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Document Type</label>
                <select required name="documentType" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
                  <option value="">Select type</option>
                  {documentTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Upload File</label>
                <input required type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="mt-2 w-full rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm" />
                <p className="mt-2 text-xs text-slate-500">Supported: PDF, JPG, PNG, WEBP, DOC, DOCX · Max 10MB</p>
              </div>

              <UploadAssociationFields properties={properties} units={units} tenants={tenants} leases={leases} />

              <button type="submit" className="rounded-2xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500">
                Upload Document
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Active Documents</h2>
            <p className="mt-1 text-sm text-slate-500">Centralized operational and compliance records.</p>
          </div>

          {activeDocuments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">No active documents uploaded yet.</div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {activeDocuments.map((document) => {
                const isStored = document.source === DocumentSource.STORED;
                const isBroken = document.source === DocumentSource.BROKEN_PLACEHOLDER;
                const isImage = document.contentType?.startsWith('image/') ?? false;
                const downloadHref = `/api/documents/${document.id}/download`;

                return (
                  <div key={document.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {statusBadge(document.status)}
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{document.documentType.replaceAll('_', ' ')}</span>
                          {document.visibility === 'TENANT_VISIBLE' ? (
                            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">Tenant visible</span>
                          ) : null}
                        </div>

                        <h3 className="mt-4 text-lg font-semibold text-slate-900">{document.fileName}</h3>

                        <div className="mt-3 space-y-1 text-sm text-slate-500">
                          {document.property ? <p>Property: {document.property.name}</p> : null}
                          {document.unit ? <p>Unit: {document.unit.unitName}</p> : null}
                          {document.tenant ? <p>Tenant: {document.tenant.fullName}</p> : null}
                        </div>

                        {isStored && isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={downloadHref} alt={document.fileName} className="mt-3 h-24 rounded-lg border border-slate-200 object-cover" />
                        ) : null}

                        {isBroken ? (
                          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            File missing — never stored. Re-upload required.
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2">
                        {isStored ? (
                          <>
                            <Link href={downloadHref} target="_blank" className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50">Preview</Link>
                            <Link href={`${downloadHref}?download=1`} className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50">Download</Link>
                          </>
                        ) : null}

                        {document.source === DocumentSource.EXTERNAL ? (
                          <Link href={document.fileUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50">Open</Link>
                        ) : null}

                        {isBroken ? (
                          <form action={deleteBrokenPlaceholderAction}>
                            <input type="hidden" name="documentId" value={document.id} />
                            <ConfirmButton message="Remove this broken document record? This cannot be undone." className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500">Remove record</ConfirmButton>
                          </form>
                        ) : (
                          <form action={archiveDocumentAction}>
                            <input type="hidden" name="documentId" value={document.id} />
                            <ConfirmButton message="Archive this document?" className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Archive</ConfirmButton>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
