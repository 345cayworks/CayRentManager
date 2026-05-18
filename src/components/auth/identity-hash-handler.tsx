'use client';

import { useEffect } from 'react';

const IDENTITY_TOKEN_HASH =
  /(confirmation_token|invite_token|recovery_token|email_change_token)=/;

export function IdentityHashHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (
      IDENTITY_TOKEN_HASH.test(hash) &&
      window.location.pathname !== '/auth/callback'
    ) {
      // Use a same-origin location replace so the hash is preserved.
      // The Next router would drop the fragment.
      window.location.replace('/auth/callback' + hash);
    }
  }, []);

  return null;
}
