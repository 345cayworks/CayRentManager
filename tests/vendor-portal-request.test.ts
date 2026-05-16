import { describe, expect, it } from 'vitest';
import {
  canDecide,
  canRequest,
  isPortalRequestStatus,
} from '@/lib/vendors/portal-request';

describe('isPortalRequestStatus', () => {
  it('returns true for valid members', () => {
    expect(isPortalRequestStatus('PENDING')).toBe(true);
    expect(isPortalRequestStatus('APPROVED')).toBe(true);
    expect(isPortalRequestStatus('REJECTED')).toBe(true);
    expect(isPortalRequestStatus('CANCELLED')).toBe(true);
  });

  it('returns false for junk values', () => {
    expect(isPortalRequestStatus('pending')).toBe(false);
    expect(isPortalRequestStatus('')).toBe(false);
    expect(isPortalRequestStatus('DONE')).toBe(false);
    expect(isPortalRequestStatus('approved ')).toBe(false);
  });
});

describe('canDecide', () => {
  it('returns true only for PENDING', () => {
    expect(canDecide('PENDING')).toBe(true);
  });

  it('returns false for non-PENDING and junk', () => {
    expect(canDecide('APPROVED')).toBe(false);
    expect(canDecide('REJECTED')).toBe(false);
    expect(canDecide('CANCELLED')).toBe(false);
    expect(canDecide('')).toBe(false);
    expect(canDecide('pending')).toBe(false);
  });
});

describe('canRequest', () => {
  it('returns true only when not enabled and no pending', () => {
    expect(canRequest({ portalEnabled: false, hasPending: false })).toBe(true);
  });

  it('returns false for every other combination', () => {
    expect(canRequest({ portalEnabled: true, hasPending: false })).toBe(false);
    expect(canRequest({ portalEnabled: false, hasPending: true })).toBe(false);
    expect(canRequest({ portalEnabled: true, hasPending: true })).toBe(false);
  });
});
