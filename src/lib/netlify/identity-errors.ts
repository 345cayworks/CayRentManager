const UNCONFIRMED_EMAIL_MESSAGE =
  'Your email address has not been confirmed yet. Please check your inbox and click the confirmation link, or ask an administrator to resend your confirmation email.';

export function getIdentityErrorMessage(error: unknown, fallback = 'Authentication failed.') {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid_grant') || normalized.includes('email not confirmed')) {
    return UNCONFIRMED_EMAIL_MESSAGE;
  }

  return message || fallback;
}
