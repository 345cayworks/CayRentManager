import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';

export const metadata: Metadata = {
  title: 'Access restricted · CayRentManager',
  description:
    'Your account is signed in, but your current role does not allow access to this page.',
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Access restricted
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            You do not have permission to view this page.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your account is signed in, but your current role does not allow
            access to the page you requested. Sign in with a different account
            or return to the home page.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-700 px-6 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
            >
              Go home
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
