/**
 * Billing access enforcement decision helpers. Pure, no I/O.
 *
 * SHIPPED DARK: enforcement is OFF unless the environment variable
 * `BILLING_ENFORCEMENT_ENABLED` is exactly the string 'true'. When OFF,
 * `shouldRedirectToBillingRequired` always returns false so no landlord is
 * ever locked out by default.
 *
 * When ON, ONLY a non-complimentary subscription whose status is exactly
 * 'INACTIVE' blocks. Per product billing rules every other state
 * (no subscription, PAST_DUE, GRACE_PERIOD, TRIAL, ACTIVE, CANCELLED,
 * complimentary, etc.) retains access. SUPERADMIN never reaches this code.
 */

export function billingEnforcementEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.BILLING_ENFORCEMENT_ENABLED === 'true';
}

export function shouldRedirectToBillingRequired(input: {
  enabled: boolean;
  subscription: { status: string; isComplimentary?: boolean | null } | null;
}): boolean {
  if (!input.enabled) return false;

  const s = input.subscription;
  if (!s) return false; // no subscription -> never block
  if (s.isComplimentary) return false; // complimentary -> never block

  // ONLY INACTIVE blocks; PAST_DUE / GRACE_PERIOD / TRIAL / ACTIVE / etc. pass.
  return s.status === 'INACTIVE';
}
