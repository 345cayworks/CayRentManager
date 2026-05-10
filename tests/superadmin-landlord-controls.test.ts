import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword, hashTemporaryPassword } from '@/lib/services/superadmin-landlord';

describe('Superadmin landlord utilities', () => {
  it('generates a random temporary password', () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
  });

  it('hashes a password and stores a salt separator', () => {
    const hash = hashTemporaryPassword('SuperSecret123!');
    expect(hash).toContain(':');
    const [salt, digest] = hash.split(':');
    expect(salt).toHaveLength(32);
    expect(digest).toHaveLength(128);
  });
});
