import { describe, expect, it } from 'vitest';
import { getIdentityErrorMessage } from '@/lib/netlify/identity-errors';

const unconfirmedEmailMessage =
  'Your email address has not been confirmed yet. Please check your inbox and click the confirmation link, or ask an administrator to resend your confirmation email.';

describe('Netlify Identity error messages', () => {
  it('shows a friendly message for unconfirmed email login failures', () => {
    expect(getIdentityErrorMessage(new Error('invalid_grant: Email not confirmed'))).toBe(unconfirmedEmailMessage);
    expect(getIdentityErrorMessage(new Error('email not confirmed'))).toBe(unconfirmedEmailMessage);
  });
});
