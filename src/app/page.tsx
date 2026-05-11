import Link from 'next/link';

const features = [
  ['Rent Ledger & Receipts', 'Track invoices, payments, balances, proof uploads, and receipts in one organized workspace.'],
  ['Maintenance Operations', 'Let tenants submit issues, assign vendors, create work orders, and follow every repair from open to resolved.'],
  ['Lease & Tenant Records', 'Keep leases, tenant profiles, unit assignments, and important records connected to each property.'],
  ['Accounting Lite', 'Capture income, expenses, payment history, and property-level performance without spreadsheet overload.'],
  ['Cayman Payment Readiness', 'Designed around bank-transfer workflows now, with Fygaro, CNB, Butterfield, and regional gateway pathways on the roadmap.'],
  ['Compliance Foundation', 'Prepared for Cayman rental records, strata workflows, short-term rental licensing, and 13% tourist-accommodation tax support as the platform grows.'],
  ['Digital Applications', 'Roadmap-ready tenant application workflows with document collection and approval tracking.'],
  ['Automated Alerts', 'Planned reminders for rent due dates, overdue balances, lease renewals, document gaps, and maintenance escalation.'],
  ['Vacation Rental Operations', 'Roadmap support for bookings, turnover tasks, guest portals, house rules, and calendar sync.'],
];

const audiences = [
  ['Small Landlords', 'For owners managing 1–10 units who need rent records, receipts, maintenance tracking, and tenant visibility without complicated software.'],
  ['Professional Property Managers', 'For managers handling multiple units, vendors, leases, payments, owner reporting, and daily service requests.'],
  ['Large Portfolios & Strata Teams', 'For growing portfolios that need stronger controls, accounting visibility, compliance tracking, and multi-user access.'],
];

const trustSignals = [
  'Built around Cayman landlord workflows',
  'Designed for local banking realities',
  'Prepared for compliance and short-term rental growth',
  'Focused on operations, not just listings',
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.28),transparent_34%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_32%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-6">
          <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur">
            <Link href="/" className="text-lg font-semibold tracking-tight">CayRentManager</Link>
            <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#who" className="hover:text-white">Who it is for</a>
              <a href="#cayman" className="hover:text-white">Cayman-ready</a>
              <a href="#demo" className="hover:text-white">Demo</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-slate-300 hover:text-white">Log in</Link>
              <a href="#demo" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">Request demo</a>
            </div>
          </header>

          <div className="grid items-center gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div>
              <p className="mb-5 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100">
                Cayman-focused rental property operations
              </p>
              <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
                Manage smarter. Operate cleaner. Grow your rental portfolio with confidence.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                CayRentManager brings rent records, receipts, tenants, leases, maintenance, vendors, work orders, expenses, and portfolio visibility into one secure platform built for Cayman landlords and property managers.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#demo" className="rounded-full bg-cyan-300 px-6 py-3 text-center font-semibold text-slate-950 shadow-lg shadow-cyan-950/40">
                  Request a demo
                </a>
                <Link href="/register" className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold text-white hover:bg-white/10">
                  Start workspace
                </Link>
              </div>
              <div className="mt-8 grid max-w-2xl grid-cols-2 gap-4 text-sm text-slate-300 md:grid-cols-4">
                {trustSignals.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-3">{item}</div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
              <div className="rounded-2xl bg-slate-900 p-5">
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm text-slate-400">Portfolio snapshot</p>
                    <h2 className="text-xl font-semibold">Grand Cayman Rentals</h2>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">Operational</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/5 p-4"><p className="text-sm text-slate-400">Rent due</p><p className="mt-2 text-2xl font-semibold">$8,400</p></div>
                  <div className="rounded-xl bg-white/5 p-4"><p className="text-sm text-slate-400">Collected</p><p className="mt-2 text-2xl font-semibold">$6,950</p></div>
                  <div className="rounded-xl bg-white/5 p-4"><p className="text-sm text-slate-400">Open requests</p><p className="mt-2 text-2xl font-semibold">4</p></div>
                  <div className="rounded-xl bg-white/5 p-4"><p className="text-sm text-slate-400">Work orders</p><p className="mt-2 text-2xl font-semibold">2</p></div>
                </div>
                <div className="mt-4 rounded-xl bg-cyan-300/10 p-4 text-sm text-cyan-50">
                  New tenant maintenance request: AC not cooling · Vendor assignment ready
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-white px-6 py-20 text-slate-950">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-700">Feature-driven platform</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">The modules landlords actually need to run rental operations.</h2>
            <p className="mt-4 text-slate-600">From rent records to maintenance, the platform is organized around the real work behind a rental portfolio.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, copy]) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800">✦</div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="who" className="bg-slate-100 px-6 py-20 text-slate-950">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-700">Who it is for</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">Built to scale from one unit to a professional portfolio.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {audiences.map(([title, copy]) => (
              <article key={title} className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="cayman" className="bg-white px-6 py-20 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-700">Cayman-ready by roadmap</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">Local payments, local compliance, local operating realities.</h2>
            <p className="mt-4 text-slate-600">
              CayRentManager is being shaped around Cayman banking and property workflows, including bank-transfer records today and future support for local payment links, short-term rental tax tracking, strata support, and licensing reminders.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Local payment pathways', 'Fygaro, CNB, Butterfield, Powertranz, and bank-transfer workflows are part of the product roadmap.'],
              ['Short-term rental readiness', 'Roadmap support for 13% tourist-accommodation tax tracking, guest portals, turnover tasks, and calendar syncing.'],
              ['Strata and document support', 'Designed to grow into strata fees, bylaws, insurance records, inspection documents, and renewal reminders.'],
              ['Automation and AI direction', 'Future alerts and insights for lease expiries, overdue rent, maintenance risk, and portfolio performance.'],
            ].map(([title, copy]) => (
              <article key={title} className="rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ['“Finally, one place for rent, receipts, and repairs.”', 'Ideal for Cayman landlords moving beyond spreadsheets.'],
              ['“Maintenance visibility changes the tenant experience.”', 'Built for faster follow-up and clearer accountability.'],
              ['“The roadmap speaks to how Cayman property owners actually operate.”', 'Local payments and compliance direction matter.'],
            ].map(([quote, detail]) => (
              <article key={quote} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xl font-semibold">{quote}</p>
                <p className="mt-4 text-sm leading-6 text-slate-300">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="bg-slate-100 px-6 py-20 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-3xl bg-white p-8 shadow-sm md:p-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-700">Request a demo</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">See how CayRentManager can organize your rental operations.</h2>
            <p className="mt-4 text-slate-600">Use the form to capture demo requests, onboarding interest, and early-access leads from Cayman landlords and property managers.</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <div className="rounded-xl bg-slate-50 p-4">Personalized walkthrough for your portfolio size</div>
              <div className="rounded-xl bg-slate-50 p-4">Local support and Cayman-specific roadmap discussion</div>
              <div className="rounded-xl bg-slate-50 p-4">Early access for landlords, property managers, and portfolio operators</div>
            </div>
          </div>
          <form className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <input placeholder="Full name" className="rounded-xl border border-slate-200 px-4 py-3" />
            <input placeholder="Email address" type="email" className="rounded-xl border border-slate-200 px-4 py-3" />
            <input placeholder="Phone / WhatsApp" className="rounded-xl border border-slate-200 px-4 py-3" />
            <input placeholder="Company or portfolio name" className="rounded-xl border border-slate-200 px-4 py-3" />
            <textarea placeholder="Tell us about your properties" rows={4} className="rounded-xl border border-slate-200 px-4 py-3" />
            <button type="button" className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Request demo</button>
            <p className="text-xs text-slate-500">Lead capture wiring can be connected to Netlify Forms or CRM in the next sprint.</p>
          </form>
        </div>
      </section>

      <footer className="bg-slate-950 px-6 py-10 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-white">CayRentManager</p>
            <p className="text-sm">Cayman-focused rental property operations software.</p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link href="/login" className="hover:text-white">Log in</Link>
            <Link href="/register" className="hover:text-white">Start workspace</Link>
            <a href="#demo" className="hover:text-white">Request demo</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
