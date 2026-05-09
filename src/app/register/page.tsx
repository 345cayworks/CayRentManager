import Link from 'next/link';
import { IdentityAuthForm } from '@/components/identity-auth-form';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-xl mx-auto rounded-xl bg-white border shadow-sm p-6">
        <h1 className="text-2xl font-semibold">Create landlord workspace</h1>
        <div className="mt-6">
          <IdentityAuthForm mode="signup" />
        </div>
        <Link href="/login" className="block text-sm text-slate-600 mt-4">Already registered? Sign in</Link>
      </div>
    </main>
  );
}
