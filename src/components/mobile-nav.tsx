'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Mobile-only top bar + slide-in drawer. Receives the already-rendered nav
 * links and sign-out panel from the server Shell as children, so all badge
 * logic and auth scoping stays server-side. Hidden at md+ (desktop keeps the
 * static sidebar).
 */
export function MobileNav({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between bg-brand-navy px-4 py-3 text-white">
        <span className="text-base font-semibold">{title}</span>
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          className="rounded border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
          onClick={() => setOpen(true)}
        >
          Menu
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-brand-navy p-4 text-white shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-semibold">CayRentManager</span>
              <button
                type="button"
                aria-label="Close navigation"
                className="rounded border border-white/20 px-2 py-1 text-sm hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div
              className="flex flex-1 flex-col overflow-y-auto"
              onClick={() => setOpen(false)}
            >
              {children}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
