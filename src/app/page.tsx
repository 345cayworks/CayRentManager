import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/public/site-footer';

export const metadata: Metadata = {
  title: 'CayRentManager — Cayman rental property operations',
  description:
    'Run rent, leases, maintenance, vendors, documents, reporting, and a tenant portal from one secure workspace built for Cayman landlords and property managers.',
};

const capabilities: { title: string; copy: string }[] = [
  {
    title: 'Rent ledger',
    copy: 'Invoices, payments, balances, payment-proof upload, and receipts in one organized ledger.',
  },
  {
    title: 'Maintenance operations',
    copy: 'Tenant-submitted requests with categories and priority, vendor assignment, work-order dispatch, SLA tracking, and a dedicated vendor portal.',
  },
  {
    title: 'Vendor marketplace',
    copy: 'Curated global vendors with featured listings, add-to-workspace, and request-a-quote.',
  },
  {
    title: 'Leases & tenants',
    copy: 'Lease records, renewals, notices, lease documents, tenant profiles, and secure invitations.',
  },
  {
    title: 'Accounting & reporting',
    copy: 'Expenses plus rent roll, tenant balances, payment history, property P&L, cashflow, maintenance cost, and lease expiry — with CSV export.',
  },
  {
    title: 'Alerts & notifications',
    copy: 'Lease and alert engine, daily email digest, per-user preferences, escalation rules, and SMS/WhatsApp-ready channels.',
  },
  {
    title: 'Document vault',
    copy: 'Real secure file storage with visibility rules, tenant-visible documents, and property and unit photos.',
  },
  {
    title: 'Tenant portal',
    copy: 'Dashboard, lease view, payment history and balance, maintenance, documents, and two-way messaging with the landlord.',
  },
  {
    title: 'Platform & controls',
    copy: 'Multi-role workspaces, superadmin console, audit log, configurable timezone and currency, and subscription billing.',
  },
];

const audiences: { title: string; copy: string }[] = [
  {
    title: 'Small landlords',
    copy: 'Owners with 1–10 units who need rent records, receipts, maintenance tracking, and tenant visibility without heavy software.',
  },
  {
    title: 'Property managers',
    copy: 'Teams handling multiple units, vendors, leases, payments, and daily service requests across a portfolio.',
  },
  {
    title: 'Growing portfolios',
    copy: 'Operators who need stronger controls, accounting visibility, an audit trail, and multi-user access.',
  },
];

const roadmap: string[] = [
  'Live card-payment gateways for tenant rent (Fygaro / CNB / Butterfield) — tenant rent is bank-transfer + proof today',
  'Vacation / short-term rental operations, guest portals, and calendar sync',
  'Digital tenant application workflows',
  'AI insights and predictive alerts',
  'Short-term-rental tax automation and owner statements',
];

export default function HomePage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Calm dark hero band */}
      <section className="bg-brand-navy text-white">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="text-base font-semibold tracking-tight">
              CayRentManager
            </Link>
            <nav className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-11 items-center rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Create workspace
              </Link>
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-300">
            Cayman rental property operations
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Run your whole rental operation from one workspace.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            Rent, leases, maintenance, vendors, documents, reporting, and a
            tenant portal — live today, built for Cayman landlords and property
            managers with KYD currency, Cayman timezone defaults, and
            bank-transfer rent workflows with proof and receipts.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-400 px-6 text-sm font-semibold text-slate-950 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              Create your workspace
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/20 px-6 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <main>
        {/* Capabilities */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">
            Available now
          </p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Everything you need to operate a rental portfolio.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            These capabilities are live in the product today — no waitlist, no
            &ldquo;coming soon.&rdquo;
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-slate-200 bg-white p-6"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.copy}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Audiences */}
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">
              Who it is for
            </p>
            <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              From a single unit to a professional portfolio.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {audiences.map((item) => (
                <article
                  key={item.title}
                  className="rounded-xl border border-slate-200 bg-white p-6"
                >
                  <h3 className="text-base font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Cayman + roadmap */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">
                Built for Cayman
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                Local defaults, local workflows.
              </h2>
              <p className="mt-3 max-w-md text-base leading-7 text-slate-600">
                KYD currency and Cayman timezone defaults out of the box, with
                bank-transfer rent workflows backed by payment proof and
                generated receipts — the way most Cayman tenancies actually
                pay today.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-700 px-6 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                >
                  Create your workspace
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                On the roadmap
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Not yet shipped — what we are building next:
              </p>
              <ul className="mt-4 space-y-3">
                {roadmap.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm leading-6 text-slate-600"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-slate-400"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Get your workspace running today.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600">
              Create a workspace and start tracking rent, leases, maintenance,
              and vendors. Already have an account? Sign in to pick up where you
              left off.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-700 px-6 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
              >
                Create your workspace
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-6 text-sm font-semibold text-slate-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Questions? Reach us at{' '}
              <a
                href="mailto:hello@cayrentmanager.com"
                className="font-medium text-cyan-700 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
              >
                hello@cayrentmanager.com
              </a>
              .
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
