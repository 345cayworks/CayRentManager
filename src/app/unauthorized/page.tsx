import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-lg rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Access restricted</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">You do not have permission to access this page.</h1>
        <p className="mt-3 text-sm text-slate-600">
          Your account is signed in, but your current role does not allow access to the page you requested.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="rounded border px-4 py-2 text-sm">
            Back to login
          </Link>
          <Link href="/" className="rounded bg-brand-navy px-4 py-2 text-sm text-white">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
