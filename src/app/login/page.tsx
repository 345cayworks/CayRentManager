import Link from 'next/link';
import { IdentityAuthForm } from '@/components/identity-auth-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-md mx-auto rounded-xl bg-white border shadow-sm p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <div className="mt-6">
          <IdentityAuthForm mode="login" />
        </div>
        <Link href="/register" className="block text-sm text-slate-600 mt-4">Create a landlord workspace</Link>
      </div>
    </main>
  );
}
