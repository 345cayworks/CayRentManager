import Link from 'next/link';
import { signInWithGoogleAction } from '@/server/actions';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-md mx-auto rounded-xl bg-white border shadow-sm p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <form action={signInWithGoogleAction} className="mt-6">
          <button className="w-full rounded bg-brand-navy text-white px-4 py-2">Continue with Google</button>
        </form>
        <Link href="/register" className="block text-sm text-slate-600 mt-4">Create a landlord workspace</Link>
      </div>
    </main>
  );
}
