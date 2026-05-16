import Link from 'next/link';

const links = [
  ['Sign in', '/login'],
  ['Create workspace', '/register'],
  ['Terms', '/terms'],
  ['Privacy', '/privacy'],
] as const;

/** Shared minimalist public footer. */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-semibold text-brand-navy">CayRentManager</p>
          <p className="mt-1 text-sm text-slate-500">
            Cayman-focused rental property operations.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6">
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} CayRentManager. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
