import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/public/site-footer';

export const metadata: Metadata = {
  title: 'CayRentManager — get paid on time, run a tighter rental business',
  description:
    'Stop chasing rent and living in spreadsheets. CayRentManager collects and reconciles rent, handles maintenance, keeps leases and vendors in order, and shows your numbers — built in Cayman for KYD and local payment realities.',
};

const capabilities: { title: string; copy: string }[] = [
  {
    title: 'Get paid — and prove it',
    copy: 'Invoice tenants, log every payment, and hand over an instant receipt. Balances reconcile themselves, so you always know exactly who owes what.',
  },
  {
    title: 'Repairs handled, not chased',
    copy: 'Tenants report issues in a tap. You assign a vendor, dispatch the work order, and track it to done with SLA timers so nothing slips through.',
  },
  {
    title: 'A vendor bench, ready to go',
    copy: 'Pull from a curated vendor marketplace, add the ones you trust to your workspace, and request quotes — instead of digging through old message threads.',
  },
  {
    title: 'Leases that never lapse quietly',
    copy: 'Every lease, renewal, notice, and document in one place — with the tenant invited and on record from day one.',
  },
  {
    title: 'Your numbers, on demand',
    copy: 'Rent roll, P&L, cashflow, balances, and lease-expiry reports — exportable to CSV. Owner updates and tax prep take minutes, not weekends.',
  },
  {
    title: 'Nothing falls through',
    copy: 'Automatic alerts and a daily digest for rent due, overdue balances, and lease expiries — with escalation and SMS/WhatsApp-ready reminders.',
  },
  {
    title: 'One secure home for every document',
    copy: 'Leases, receipts, inspections, and property photos stored safely — shared with tenants only when you decide to.',
  },
  {
    title: 'Tenants self-serve, you field fewer calls',
    copy: 'A portal where tenants see their lease, balance, and payment history, submit maintenance, and message you directly.',
  },
  {
    title: 'Control as you grow',
    copy: 'Role-based access for managers and accountants, a full audit trail, and per-workspace currency and timezone — without enterprise overhead.',
  },
];

const audiences: { title: string; copy: string }[] = [
  {
    title: 'Small landlords',
    copy: 'You did not get into property to live in spreadsheets. Track rent, receipts, and repairs for 1–10 units in minutes a week — and look professional doing it.',
  },
  {
    title: 'Property managers',
    copy: 'Juggling owners, tenants, and vendors across a portfolio? Keep every unit, payment, and service request straight — and turn owner reporting into a one-click export.',
  },
  {
    title: 'Growing portfolios',
    copy: 'Outgrowing what spreadsheets can hold? Add managers and accountants with the right access, keep an audit trail, and tighten financial control as you scale.',
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
            Property management software made for Cayman
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Stop chasing rent. Start running a tighter rental business.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            Rent collected and reconciled, maintenance handled, tenants and
            vendors in the loop, and your numbers always current — without the
            spreadsheet sprawl. Built in Cayman for KYD, local timezones, and
            bank-transfer rent with proof and receipts.
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
            Less admin. Fewer disputes. Money where it should be.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Every capability below is live in the product today — not a roadmap
            promise, no waitlist, no &ldquo;coming soon.&rdquo;
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
              Whether you own one unit or run a hundred.
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
                Built here — not adapted from abroad.
              </h2>
              <p className="mt-3 max-w-md text-base leading-7 text-slate-600">
                Most tools assume US banking and USD and leave you working
                around the gaps. CayRentManager defaults to KYD and Cayman
                time, and fits how tenancies here actually pay — bank transfer,
                payment proof, and a receipt the tenant can keep. Less
                translation, fewer workarounds, faster days.
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
                What we are building next — not available yet:
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
              Put this weekend back on your calendar.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600">
              Set up your workspace and move rent, leases, maintenance, and
              vendors off spreadsheets today. Already onboard? Sign in and pick
              up right where you left off.
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
              Questions? Talk to us at{' '}
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
