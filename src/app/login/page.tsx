import Link from 'next/link';
import { Suspense } from 'react';
import { IdentityAuthForm } from '@/components/identity-auth-form';

const highlights = [
  'Tenant maintenance tracking',
  'Rent ledger and receipts',
  'Vendor assignment workflows',
  'Property and lease visibility',
  'Cayman-focused operations foundation',
];

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_35%)]" />
          <div className="relative flex flex-col justify-between p-12">
            <div>
              <Link href="/" className="text-2xl font-bold tracking-tight">CayRentManager</Link>
              <p className="mt-6 max-w-xl text-5xl font-bold tracking-tight">
                Property operations built for the Cayman Islands.
              </p>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                Manage rent records, maintenance requests, vendors, receipts, tenants, and portfolio operations from one secure workspace.
              </p>
            </div>

            <div className="grid gap-3">
              {highlights.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-200 backdrop-blur">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mb-8 text-center sm:text-left">
              <Link href="/" className="inline-flex text-xl font-semibold tracking-tight text-white lg:hidden">
                CayRentManager
              </Link>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200 sm:text-sm">
                Welcome back
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Sign in to your workspace
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Access your landlord, property management, accounting, or tenant workspace securely.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-950/40 p-4 sm:p-5">
              <Suspense fallback={<div className="text-sm text-slate-400">Loading...</div>}>
                <IdentityAuthForm mode="login" />
              </Suspense>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-slate-300 sm:flex sm:flex-row sm:items-center sm:justify-between">
              <Link href="/register" className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-3 text-center font-medium text-cyan-100 hover:text-white sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                Create landlord workspace
              </Link>
              <Link href="/" className="rounded-full border border-white/10 px-4 py-3 text-center hover:text-white sm:border-0 sm:px-0 sm:py-0">
                Return to homepage
              </Link>
            </div>

            <div className="mt-8 grid gap-3 lg:hidden">
              {highlights.slice(0, 3).map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
