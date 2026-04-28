import { describe, expect, it } from 'vitest';
import { getActiveLandlordWorkspace } from '@/lib/auth/guards';

describe('landlord and tenant isolation helpers', () => {
  it('keeps user pinned to valid landlord workspace', () => {
    const memberships = ['landlord_a', 'landlord_b'];

    expect(getActiveLandlordWorkspace(memberships, 'landlord_b')).toBe('landlord_b');
    expect(getActiveLandlordWorkspace(memberships, 'landlord_c')).toBe('landlord_a');
  });
});
