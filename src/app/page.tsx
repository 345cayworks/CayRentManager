import Link from 'next/link';

const features = [
  ['Rent Ledger & Receipts', 'Track invoices, payments, balances, proof uploads, and receipts in one organized workspace.'],
  ['Maintenance Operations', 'Let tenants submit issues, assign vendors, create work orders, and follow every repair from open to resolved.'],
  ['Tenant Portal', 'Give tenants a simple place to see balances, receipts, and maintenance request status.'],
  ['Portfolio Visibility', 'See properties, units, tenants, leases, expenses, cash flow, and operational activity by workspace.'],
  ['Cayman-Ready Payments Roadmap', 'Built with local bank-transfer workflows now, with Fygaro and regional gateway integrations planned next.'],
  ['Compliance Foundation', 'Designed to support Cayman rental records, short-term rental tax workflows, strata tracking, and document readiness as the platform grows.'],
];

const audiences = [
  ['Private Landlords', 'Move from spreadsheets and WhatsApp threads to a cleaner operating system for each unit.'],
  ['Property Managers', 'Manage tenants, maintenance, payments, vendors, and owner visibility across multiple properties.'],
  ['Growing Portfolios', 'Create the foundation for reporting, compliance, concierge support, and online rent collection.'],
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
              <a href="#roadmap" className="hover:text-white">Roadmap</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-slate-300 hover:text-white">Log in</Link>
              <Link href="/register" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">Start workspace</Link>
            </div>
          </header>

          <div className="grid items-center gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div>
              <p className="mb-5 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100">
                Built for Cayman rental operations
              </p>
              <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
                A smarter operating system for landlords and property managers.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Manage rent records, receipts, tenants, leases, maintenance requests, vendors, work orders, expenses, and portfolio visibility from one secure platform designed for the Cayman Islands market.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="rounded-full bg-cyan-300 px-6 py-3 text-center font-semibold text-slate-950 shadow-lg shadow-cyan-950/40">
                  Create landlord account
                </Link>
                <Link href="/login" className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold text-white hover:bg-white/10">
                  Log in to dashboard
                </Link>
              </div>
              <div className="mt-8 grid max-w-2xl grid-cols-3 gap-4 text-sm text-slate-300">
                <div><span className="block text-2xl font-bold text-white">Rent</span>ledger ready</div>
                <div><span className="block text-2xl font-bold text-white">24/7</span>tenant intake</div>
                <div><span className="block text-2xl font-bold text-white">Cayman</span>market focus</div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
              <div className="rounded-2xl bg-slate-900 p-5">
                <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm text-slate-400">Portfolio snapshot</p>
                    <h2 className="text-xl font-semibold">Grand Cayman Rentals</h2>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">Stable</span>
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
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-700">Platform capabilities</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">Everything needed to run rental operations with confidence.</h2>
            <p className="mt-4 text-slate-600">The platform is built around practical daily workflows: money, maintenance, tenants, documents, and decision visibility.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, copy]) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="who" className="bg-slate-100 px-6 py-20 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-700">Different by design</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">Not just listings. Not just accounting. Real property operations.</h2>
            <p className="mt-4 text-slate-600">CayRentManager is being built for owners and managers who need the complete operating layer behind a rental portfolio.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {audiences.map(([title, copy]) => (
              <article key={title} className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="roadmap" className="bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-8 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-cyan-200">What is live now</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight">Rent ledger, receipts, tenant maintenance, vendors, and work orders are already in the platform foundation.</h2>
              <p className="mt-4 text-slate-300">Next milestones include stronger maintenance detail workflows, online payment links, automated reminders, compliance tracking, concierge operations, and short-term rental support.</p>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              {['Manual rent ledger and receipts', 'Tenant portal and maintenance intake', 'Vendor assignment and work orders', 'Cayman payment gateway roadmap', 'Compliance and vacation-rental roadmap'].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3">{item}</div>
              ))}
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="rounded-full bg-cyan-300 px-6 py-3 text-center font-semibold text-slate-950">Start your workspace</Link>
            <Link href="/login" className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold text-white">Log in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
