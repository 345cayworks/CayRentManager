import Link from 'next/link';
import { signInWithGoogleAction } from '@/server/actions';

export default function LoginPage() {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-md mx-auto rounded-xl bg-white border shadow-sm p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {googleConfigured ? (
          <form action={signInWithGoogleAction} className="mt-6">
            <button className="w-full rounded bg-brand-navy text-white px-4 py-2">Continue with Google</button>
          </form>
        ) : (
          <div className="mt-6 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Google sign-in is not configured yet.
          </div>
        )}
        <Link href="/register" className="block text-sm text-slate-600 mt-4">Create a landlord workspace</Link>
      </div>
    </main>
  );
}
