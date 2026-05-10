const UNCONFIRMED_EMAIL_MESSAGE =
  'Your Netlify Identity account exists but the email has not been confirmed. For the platform owner account, confirm the user in Netlify Identity Admin or disable mandatory confirmation during MVP testing.';

export function getIdentityErrorMessage(error: unknown, fallback = 'Authentication failed.') {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid_grant') || normalized.includes('email not confirmed')) {
    return UNCONFIRMED_EMAIL_MESSAGE;
  }

  return message || fallback;
}
