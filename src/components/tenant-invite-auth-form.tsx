'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentIdentityUser, initializeIdentity, login, signup } from '@/lib/netlify/identity-client';

function identityPayload(user: any, fullName: string, token: string) {
  return {
    token,
    fullName: fullName || user.name || user.user_metadata?.full_name || user.email,
  };
}

export function TenantInviteAuthForm({ token, invitedEmail }: { token: string; invitedEmail: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initializeIdentity().catch(() => undefined);
  }, []);

  async function accept(user: any) {
    const response = await fetch('/api/identity/accept-invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(identityPayload(user, fullName, token)),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? 'Unable to accept invite.');
    }
    router.push('/tenant/dashboard');
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const current = await getCurrentIdentityUser();
      const user = current ?? (mode === 'signup' ? await signup(email, password, fullName) : await login(email, password));
      await accept(user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invite acceptance failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-3">
      <div className="flex rounded border overflow-hidden">
        <button type="button" onClick={() => setMode('signup')} className={`flex-1 px-3 py-2 ${mode === 'signup' ? 'bg-brand-navy text-white' : 'bg-white'}`}>Sign up</button>
        <button type="button" onClick={() => setMode('login')} className={`flex-1 px-3 py-2 ${mode === 'login' ? 'bg-brand-navy text-white' : 'bg-white'}`}>Sign in</button>
      </div>
      <input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="border rounded px-3 py-2" />
      <input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder={invitedEmail} className="border rounded px-3 py-2" />
      <input required value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" className="border rounded px-3 py-2" />
      <button disabled={busy} className="rounded bg-brand-navy text-white px-4 py-2 disabled:opacity-60">{busy ? 'Please wait...' : 'Accept invite'}</button>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </form>
  );
}
