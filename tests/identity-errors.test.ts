import { describe, expect, it } from 'vitest';
import { getIdentityErrorMessage } from '@/lib/netlify/identity-errors';

const unconfirmedEmailMessage =
  'Your Netlify Identity account exists but the email has not been confirmed. For the platform owner account, confirm the user in Netlify Identity Admin or disable mandatory confirmation during MVP testing.';

describe('Netlify Identity error messages', () => {
  it('shows a friendly message for unconfirmed email login failures', () => {
    expect(getIdentityErrorMessage(new Error('invalid_grant: Email not confirmed'))).toBe(unconfirmedEmailMessage);
    expect(getIdentityErrorMessage(new Error('email not confirmed'))).toBe(unconfirmedEmailMessage);
  });
});
