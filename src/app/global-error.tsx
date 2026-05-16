'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">
              An unexpected error occurred. You can try again, or return to the
              homepage.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white"
              >
                Try again
              </button>
              <a
                href="/"
                className="rounded border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Go to homepage
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
