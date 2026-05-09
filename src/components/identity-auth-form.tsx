'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentIdentityUser, initializeIdentity, login, logout, signup } from '@/lib/netlify/identity-client';

type Mode = 'login' | 'signup';

function identityPayload(user: any, fullName?: string) {
  return {
    netlifyUserId: String(user.id ?? user.sub ?? ''),
    email: String(user.email ?? ''),
    fullName: fullName || user.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email,
  };
}

export function IdentityAuthForm({ mode, redirectTo = '/dashboard' }: { mode: Mode; redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initializeIdentity()
      .then(getCurrentIdentityUser)
      .then(async (user) => {
        if (!user) return;
        await syncSession(user);
      })
      .catch(() => undefined);
  }, []);

  async function syncSession(user: any) {
    const response = await fetch('/api/identity/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(identityPayload(user, fullName)),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? 'Unable to sync app session.');
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const user = mode === 'signup' ? await signup(email, password, fullName) : await login(email, password);
      await syncSession(user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout();
    await fetch('/api/identity/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={submit} className="grid gap-3">
        {mode === 'signup' ? (
          <input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="border rounded px-3 py-2" />
        ) : null}
        <input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email" className="border rounded px-3 py-2" />
        <input required value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" className="border rounded px-3 py-2" />
        <button disabled={busy} className="rounded bg-brand-navy text-white px-4 py-2 disabled:opacity-60">
          {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <button onClick={signOut} type="button" className="text-sm rounded border px-4 py-2">
        Sign out
      </button>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
