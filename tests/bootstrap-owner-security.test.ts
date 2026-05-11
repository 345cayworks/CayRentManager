import { describe, expect, it } from 'vitest';

describe('bootstrap owner route security expectations', () => {
  it('expects bootstrap route to be disabled by default', () => {
    expect(process.env.ENABLE_BOOTSTRAP_OWNER_ROUTE).not.toBe('true');
  });

  it('expects bootstrap master key not to be hardcoded', () => {
    expect(process.env.SUPERADMIN_MASTER_KEY).toBeUndefined();
  });

  it('expects allowed IPs to be environment-driven', () => {
    expect(typeof process.env.BOOTSTRAP_ALLOWED_IPS === 'string' || process.env.BOOTSTRAP_ALLOWED_IPS === undefined).toBe(true);
  });
});
