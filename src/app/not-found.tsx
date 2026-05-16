import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-navy">
          CayRentManager
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">404</h1>
        <p className="mt-2 text-sm text-slate-600">
          We couldn&apos;t find the page you were looking for.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white"
          >
            Go to homepage
          </Link>
          <Link
            href="/dashboard"
            className="rounded border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
