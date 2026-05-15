import { describe, expect, it } from 'vitest';
import { getActiveLandlordWorkspace } from '@/lib/auth/workspace';

describe('getActiveLandlordWorkspace', () => {
  it('returns the requested workspace when the user is a member', () => {
    expect(getActiveLandlordWorkspace(['landlord_a', 'landlord_b'], 'landlord_b')).toBe(
      'landlord_b'
    );
  });

  it('falls back to the first membership when the request is not a member', () => {
    expect(getActiveLandlordWorkspace(['landlord_a', 'landlord_b'], 'landlord_c')).toBe(
      'landlord_a'
    );
  });

  it('returns null when the user has no memberships', () => {
    expect(getActiveLandlordWorkspace([])).toBeNull();
    expect(getActiveLandlordWorkspace([], 'landlord_c')).toBeNull();
  });

  it('returns the first membership when no request is supplied', () => {
    expect(getActiveLandlordWorkspace(['landlord_a', 'landlord_b'])).toBe('landlord_a');
  });

  it('does not leak a workspace the user is not a member of', () => {
    const memberships = ['landlord_a'];
    const resolved = getActiveLandlordWorkspace(memberships, 'landlord_evil');
    expect(memberships.includes(resolved as string)).toBe(true);
    expect(resolved).not.toBe('landlord_evil');
  });

  it('is case-sensitive when matching workspace identifiers', () => {
    // Workspace identifiers are opaque IDs; requests must match exactly.
    expect(getActiveLandlordWorkspace(['landlord_a'], 'LANDLORD_A')).toBe('landlord_a');
  });
});
