'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { initializeIdentity } from '@/lib/netlify/identity-client';

type Status = 'working' | 'success' | 'error';

type TokenType =
  | 'confirmation'
  | 'recovery'
  | 'email_change'
  | 'invite'
  | 'unknown';

function detectTokenType(hash: string): TokenType {
  if (/confirmation_token=/.test(hash)) return 'confirmation';
  if (/recovery_token=/.test(hash)) return 'recovery';
  if (/email_change_token=/.test(hash)) return 'email_change';
  if (/invite_token=/.test(hash)) return 'invite';
  return 'unknown';
}

function clearHash() {
  if (typeof window === 'undefined') return;
  history.replaceState(null, '', window.location.pathname);
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>('working');

  useEffect(() => {
    let cancelled = false;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const tokenType = detectTokenType(hash);

    initializeIdentity()
      .then(() => {
        if (cancelled) return;
        setStatus('success');
        // Clear the hash before redirecting so the global handler
        // does not re-trigger on the destination route.
        clearHash();
        if (tokenType === 'recovery') {
          window.location.replace('/reset-password');
        } else if (tokenType === 'email_change') {
          window.location.replace('/login?email_changed=1');
        } else {
          // confirmation, invite (Netlify), or unknown -> treat as confirmation.
          window.location.replace('/login?confirmed=1');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        // Clear the hash so a refresh does not loop.
        clearHash();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-16 text-slate-900 sm:px-6">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8">
        {status === 'working' ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-navy">
              Please wait
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Confirming your account…
            </h1>
            <p className="mt-3 animate-pulse text-sm leading-6 text-slate-600">
              We are verifying your link. This only takes a moment.
            </p>
          </>
        ) : null}

        {status === 'success' ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Confirmed
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Your account is confirmed.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Redirecting you to sign in…
            </p>
            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-6 text-sm font-semibold text-white hover:opacity-90"
              >
                Go to sign in
              </Link>
            </div>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Confirmation failed
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              We couldn&apos;t confirm your account.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The link may have expired or already been used. You can try
              registering again, or contact{' '}
              <a
                href="mailto:hello@cayrentmanager.com"
                className="font-medium text-brand-navy underline"
              >
                hello@cayrentmanager.com
              </a>{' '}
              for a new confirmation email.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-6 text-sm font-semibold text-white hover:opacity-90"
              >
                Back to sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Register again
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
