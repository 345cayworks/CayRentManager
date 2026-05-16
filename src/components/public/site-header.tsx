import Link from 'next/link';

/**
 * Shared minimalist public header.
 * `variant="solid"` is the default light header used on legal/auth-adjacent pages.
 * `variant="overlay"` is used on the dark home hero band.
 */
export function SiteHeader({ variant = 'solid' }: { variant?: 'solid' | 'overlay' }) {
  const overlay = variant === 'overlay';

  return (
    <header
      className={
        overlay
          ? 'border-b border-white/10'
          : 'border-b border-slate-200 bg-white'
      }
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className={
            overlay
              ? 'text-base font-semibold tracking-tight text-white'
              : 'text-base font-semibold tracking-tight text-brand-navy'
          }
        >
          CayRentManager
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className={
              overlay
                ? 'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'
                : 'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600'
            }
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={
              overlay
                ? 'inline-flex min-h-11 items-center rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200'
                : 'inline-flex min-h-11 items-center rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600'
            }
          >
            Create workspace
          </Link>
        </nav>
      </div>
    </header>
  );
}
