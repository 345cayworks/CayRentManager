import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IdentityAuthForm } from '@/components/identity-auth-form';
import { AuthShell } from '@/components/public/auth-shell';

export const metadata: Metadata = {
  title: 'Create your workspace · CayRentManager',
  description:
    'Create a CayRentManager landlord workspace to manage rent, leases, maintenance, vendors, and tenants.',
};

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your workspace"
      subtitle="Set up a landlord workspace to manage rent, leases, maintenance, vendors, and tenants."
      footer={
        <p>
          Already registered?{' '}
          <Link
            href="/login"
            className="font-semibold text-cyan-700 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <Suspense
        fallback={<div className="text-sm text-slate-500">Loading…</div>}
      >
        <IdentityAuthForm mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
