import Link from 'next/link';
import type { ReactNode } from 'react';

const highlights = [
  'Rent ledger, payment proof, and receipts',
  'Maintenance requests, vendors, and work orders',
  'Leases, tenants, documents, and reporting',
  'Tenant portal with two-way messaging',
];

/**
 * Shared minimalist split layout for the login and register pages.
 * Brand panel on the left (desktop), form panel on the right.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Brand panel */}
        <section className="hidden bg-brand-navy text-white lg:flex">
          <div className="flex w-full flex-col justify-between p-12">
            <Link
              href="/"
              className="text-base font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              CayRentManager
            </Link>
            <div>
              <h2 className="max-w-sm text-3xl font-bold tracking-tight">
                Property operations built for the Cayman Islands.
              </h2>
              <p className="mt-4 max-w-sm text-base leading-7 text-slate-300">
                One secure workspace for rent, leases, maintenance, vendors,
                documents, and your tenant portal.
              </p>
              <ul className="mt-8 space-y-3">
                {highlights.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm leading-6 text-slate-200"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-cyan-300"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} CayRentManager
            </p>
          </div>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center px-4 py-12 sm:px-6">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="inline-flex text-base font-semibold tracking-tight text-brand-navy lg:hidden"
            >
              CayRentManager
            </Link>
            <p className="mt-6 text-xs font-medium uppercase tracking-wide text-cyan-700 lg:mt-0">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>

            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
              {children}
            </div>

            <div className="mt-6 text-sm text-slate-600">{footer}</div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <Link
                href="/terms"
                className="text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
              >
                Privacy
              </Link>
              <Link
                href="/"
                className="text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
              >
                Home
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
