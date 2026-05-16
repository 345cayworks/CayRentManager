import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IdentityAuthForm } from '@/components/identity-auth-form';
import { AuthShell } from '@/components/public/auth-shell';

export const metadata: Metadata = {
  title: 'Sign in · CayRentManager',
  description:
    'Sign in to your CayRentManager landlord, property management, accounting, or tenant workspace.',
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      subtitle="Access your landlord, property management, accounting, or tenant workspace securely."
      footer={
        <p>
          New to CayRentManager?{' '}
          <Link
            href="/register"
            className="font-semibold text-cyan-700 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          >
            Create your workspace
          </Link>
        </p>
      }
    >
      <Suspense
        fallback={<div className="text-sm text-slate-500">Loading…</div>}
      >
        <IdentityAuthForm mode="login" />
      </Suspense>
    </AuthShell>
  );
}
