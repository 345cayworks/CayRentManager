import Link from 'next/link';
import { registerLandlordAction } from '@/server/actions';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-xl mx-auto rounded-xl bg-white border shadow-sm p-6">
        <h1 className="text-2xl font-semibold">Create landlord workspace</h1>
        <form action={registerLandlordAction} className="mt-6 grid gap-3">
          <input required name="fullName" placeholder="Your name" className="border rounded px-3 py-2" />
          <input required name="email" type="email" placeholder="Email" className="border rounded px-3 py-2" />
          <input required name="companyName" placeholder="Company name" className="border rounded px-3 py-2" />
          <input required name="displayName" placeholder="Workspace display name" className="border rounded px-3 py-2" />
          <button className="rounded bg-brand-navy text-white px-4 py-2">Create workspace</button>
        </form>
        <Link href="/login" className="block text-sm text-slate-600 mt-4">Already registered? Sign in</Link>
      </div>
    </main>
  );
}
