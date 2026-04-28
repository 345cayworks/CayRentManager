import Link from 'next/link';

export function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-brand-navy text-white p-4 space-y-2">
        <h1 className="text-lg font-semibold mb-4">RentFlow Manager</h1>
        {['/dashboard', '/properties', '/units', '/tenants', '/leases', '/payments', '/expenses', '/maintenance', '/documents', '/reports', '/settings'].map((href) => (
          <Link key={href} className="block text-sm hover:underline" href={href}>
            {href}
          </Link>
        ))}
      </aside>
      <main className="p-6">
        <h2 className="text-2xl font-semibold mb-6">{title}</h2>
        {children}
      </main>
    </div>
  );
}
