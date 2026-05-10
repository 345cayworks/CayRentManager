'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword } from '@/lib/netlify/identity-client';

export function ChangePasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!password) {
      setMessage('Please enter a new password.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      await updatePassword(password);
      const response = await fetch('/api/identity/change-password', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update password state.');
      router.push(redirectTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete password change.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto bg-white border rounded-xl shadow-sm p-6">
      <p className="text-sm text-slate-600 mb-4">Your account requires a password update before accessing the dashboard.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">New password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>
        <button type="submit" disabled={busy} className="rounded bg-brand-navy text-white px-4 py-2 disabled:opacity-60">
          {busy ? 'Saving...' : 'Update password'}
        </button>
        {message ? <p className="text-sm text-red-700">{message}</p> : null}
      </form>
    </div>
  );
}
