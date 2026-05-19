'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getIdentityErrorMessage } from '@/lib/netlify/identity-errors';
import {
  getCurrentIdentityUser,
  initializeIdentity,
  login,
  logout,
  signup,
} from '@/lib/netlify/identity-client';

type Mode = 'login' | 'signup';

const inputClassName =
  'w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-950 placeholder:text-slate-400 outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20';

function identityPayload(user: any, fullName?: string) {
  return {
    fullName:
      fullName ||
      user.name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email,
  };
}

function validatePassword(password: string) {
  if (password.length < 8) { return 'Password must be at least 8 characters.'; }
  if (!/[A-Z]/.test(password)) { return 'Password must include at least one uppercase letter.'; }
  if (!/[0-9]/.test(password)) { return 'Password must include at least one number.'; }
  return null;
}

export function IdentityAuthForm({
  mode,
  redirectTo = '/dashboard',
}: {
  mode: Mode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [accessCodeNote, setAccessCodeNote] = useState<
    { kind: 'ok' | 'warn'; text: string } | null
  >(null);
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValidation = useMemo(() => {
    if (mode !== 'signup' || password.length === 0) { return null; }
    return validatePassword(password);
  }, [mode, password]);

  useEffect(() => {
    if (mode === 'login' && searchParams?.get('registered')) {
      setSuccessMessage(
        'Registration successful. Check your email and click the confirmation link before signing in.',
      );
    } else if (mode === 'login' && searchParams?.get('confirmed') === '1') {
      setSuccessMessage('Your email has been confirmed. You can now sign in.');
    } else if (mode === 'login' && searchParams?.get('email_changed') === '1') {
      setSuccessMessage('Your email change has been confirmed. Please sign in.');
    }
  }, [mode, searchParams]);

  useEffect(() => {
    initializeIdentity()
      .then(getCurrentIdentityUser)
      .then(async (user) => { if (!user) return; await syncSession(user); })
      .catch(() => undefined);
  }, []);

  // Best-effort live preview of a referral / promo code. Never blocks signup.
  useEffect(() => {
    if (mode !== 'signup') { return; }
    const code = accessCode.trim();
    if (!code) { setAccessCodeNote(null); return; }
    let cancelled = false;
    const handle = setTimeout(() => {
      fetch('/api/access-code/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, email: email.trim() }),
      })
        .then((response) => response.json().catch(() => null))
        .then((data) => {
          if (cancelled || !data) { return; }
          if (data.ok && typeof data.preview === 'string') {
            setAccessCodeNote({ kind: 'ok', text: data.preview });
          } else if (typeof data.reason === 'string') {
            setAccessCodeNote({ kind: 'warn', text: data.reason });
          } else {
            setAccessCodeNote(null);
          }
        })
        .catch(() => { if (!cancelled) { setAccessCodeNote(null); } });
    }, 450);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [mode, accessCode, email]);

  async function syncSession(user: any) {
    const response = await fetch('/api/identity/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(identityPayload(user, fullName)),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { throw new Error(body.error ?? 'Unable to sync app session.'); }
    const target = typeof body.redirectTo === 'string' ? body.redirectTo : redirectTo;
    if (window.location.pathname !== target) { router.replace(target); }
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(''); setSuccessMessage('');
    try {
      if (mode === 'signup') {
        if (!fullName.trim()) { throw new Error('Full name is required.'); }
        const passwordError = validatePassword(password);
        if (passwordError) { throw new Error(passwordError); }
        if (password !== confirmPassword) { throw new Error('Passwords do not match.'); }
        try {
          await signup(email, password, fullName);
        } catch (signupError: unknown) {
          const msg = signupError instanceof Error ? signupError.message : String(signupError ?? '');
          const normalized = msg.toLowerCase();
          if (normalized.includes('user already registered') || normalized.includes('email already') ||
              normalized.includes('already exists') || normalized.includes('already registered')) {
            throw new Error('An account with this email already exists. Please sign in instead.');
          }
          throw new Error(getIdentityErrorMessage(signupError));
        }
        // Best-effort referral / promo capture. Email-keyed PENDING redemption.
        // Wrapped so signup ALWAYS proceeds regardless of any failure.
        const codeToCapture = accessCode.trim();
        if (codeToCapture) {
          try {
            await fetch('/api/access-code/redeem-intent', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ code: codeToCapture, email: email.trim() }),
            }).catch(() => undefined);
          } catch {
            // Swallow all errors: signup must never fail because of code capture.
          }
        }
        // Registration succeeded - redirect to login without session sync.
        // Netlify Identity session is not available immediately after signup.
        router.replace('/login?registered=1');
        return;
      }
      const user = await login(email, password);
      await syncSession(user);
    } catch (error) {
      setMessage(getIdentityErrorMessage(error));
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
      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {successMessage}
        </div>
      ) : null}
      <form onSubmit={submit} className="grid gap-3">
        {mode === 'signup' ? (
          <input required value={fullName} onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name" className={inputClassName} />
        ) : null}
        <input required value={email} onChange={(event) => setEmail(event.target.value)}
          type="email" placeholder="Email" className={inputClassName} />
        <div className="relative">
          <input required value={password} onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? 'text' : 'password'} placeholder="Password"
            className={`${inputClassName} pr-20`} />
          <button type="button" onClick={() => setShowPassword((current) => !current)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {mode === 'signup' ? (
          <>
            <div className="relative">
              <input required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm password"
                className={`${inputClassName} pr-20`} />
              <button type="button" onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Password requirements:
              <ul className="mt-2 list-disc pl-4">
                <li>At least 8 characters</li>
                <li>One uppercase letter</li>
                <li>One number</li>
              </ul>
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input required type="checkbox" name="acceptTerms" className="mt-0.5" />
              <span>
                I agree to the{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-navy underline"
                >
                  Terms
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-navy underline"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            <div className="grid gap-1">
              <input
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="Referral or promo code (optional)"
                className={inputClassName}
                autoComplete="off"
              />
              {accessCodeNote ? (
                <p
                  className={`text-xs ${
                    accessCodeNote.kind === 'ok' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {accessCodeNote.text}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
        {passwordValidation ? <p className="text-xs text-amber-700">{passwordValidation}</p> : null}
        <button disabled={busy} className="rounded bg-brand-navy text-white px-4 py-2 disabled:opacity-60">
          {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
      {mode === 'login' ? (
        <button onClick={signOut} type="button" className="text-sm rounded border px-4 py-2 text-slate-700 hover:bg-slate-50">
          Sign out
        </button>
      ) : null}
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
