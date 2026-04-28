import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <section className="bg-white shadow rounded-xl p-8 max-w-2xl w-full space-y-4">
        <h1 className="text-3xl font-bold">RentFlow Manager</h1>
        <p className="text-slate-600">
          Multi-landlord SaaS platform for property operations, rent tracking, and financial reporting.
        </p>
        <div className="flex gap-3">
          <Link href="/login" className="rounded bg-brand-navy text-white px-4 py-2">Login</Link>
          <Link href="/register" className="rounded border px-4 py-2">Create landlord account</Link>
        </div>
      </section>
    </main>
  );
}
