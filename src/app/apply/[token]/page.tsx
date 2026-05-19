import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/public/site-footer';
import { SiteHeader } from '@/components/public/site-header';
import { prisma } from '@/lib/db/prisma';
import { isLinkOpen } from '@/lib/applications/application-rules';
import { submitTenantApplicationAction } from '@/server/application-actions';

export const dynamic = 'force-dynamic';

const inputClass =
  'mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600';
const labelClass = 'block text-sm font-medium text-slate-700';

export default async function ApplyTokenPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { submitted?: string };
}) {
  const link = await prisma.tenantApplicationLink.findUnique({
    where: { token: params.token },
    include: {
      landlord: { select: { displayName: true } },
      property: { select: { name: true } },
      unit: { select: { unitName: true, property: { select: { name: true } } } },
    },
  });

  if (!link) notFound();

  const open = isLinkOpen({ active: link.active, expiresAt: link.expiresAt });
  const submitted = searchParams?.submitted === '1';

  const locationLabel = link.unit
    ? `${link.unit.property.name} / ${link.unit.unitName}`
    : link.property
      ? link.property.name
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">
          Tenant application
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Apply to rent with {link.landlord.displayName}
        </h1>
        {locationLabel ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">{locationLabel}</p>
        ) : null}

        {submitted ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm leading-6 text-slate-700">
              Thanks — your application has been received. The landlord will be
              in touch.
            </p>
          </div>
        ) : !open ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm leading-6 text-slate-700">
              This application link is no longer accepting submissions.
            </p>
          </div>
        ) : (
          <form
            action={submitTenantApplicationAction}
            className="mt-8 rounded-xl border border-slate-200 bg-white p-6"
          >
            <input type="hidden" name="token" value={params.token} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="applicantName">
                  Full name
                </label>
                <input
                  id="applicantName"
                  name="applicantName"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="phone">
                  Phone
                </label>
                <input id="phone" name="phone" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="currentAddress">
                  Current address
                </label>
                <input
                  id="currentAddress"
                  name="currentAddress"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="employer">
                  Employer
                </label>
                <input id="employer" name="employer" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="monthlyIncome">
                  Monthly income (KYD)
                </label>
                <input
                  id="monthlyIncome"
                  name="monthlyIncome"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="desiredMoveIn">
                  Desired move-in date
                </label>
                <input
                  id="desiredMoveIn"
                  name="desiredMoveIn"
                  type="date"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="occupants">
                  Number of occupants
                </label>
                <input
                  id="occupants"
                  name="occupants"
                  type="number"
                  min="1"
                  step="1"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="references">
                  References
                </label>
                <textarea
                  id="references"
                  name="references"
                  rows={3}
                  placeholder="Previous landlord, employer, or personal references with contact details."
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="notes">
                  Anything else we should know
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-700 px-6 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
            >
              Submit application
            </button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
