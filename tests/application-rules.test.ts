import { describe, expect, it } from 'vitest';
import {
  canDecide,
  isLinkOpen,
  nextStatuses,
  type AppStatus,
} from '@/lib/applications/application-rules';

describe('canDecide', () => {
  it('is true for open statuses', () => {
    expect(canDecide('SUBMITTED')).toBe(true);
    expect(canDecide('UNDER_REVIEW')).toBe(true);
  });

  it('is false for terminal statuses', () => {
    expect(canDecide('APPROVED')).toBe(false);
    expect(canDecide('REJECTED')).toBe(false);
    expect(canDecide('WITHDRAWN')).toBe(false);
  });
});

describe('nextStatuses', () => {
  it('allows triage and decisions from SUBMITTED', () => {
    expect(nextStatuses('SUBMITTED')).toEqual([
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
    ]);
  });

  it('allows only decisions from UNDER_REVIEW', () => {
    expect(nextStatuses('UNDER_REVIEW')).toEqual(['APPROVED', 'REJECTED']);
  });

  it('returns no transitions for terminal statuses', () => {
    const terminal: AppStatus[] = ['APPROVED', 'REJECTED', 'WITHDRAWN'];
    for (const status of terminal) {
      expect(nextStatuses(status)).toEqual([]);
    }
  });
});

describe('isLinkOpen', () => {
  const now = new Date('2026-05-19T12:00:00Z');

  it('is false when the link is inactive', () => {
    expect(isLinkOpen({ active: false, expiresAt: null }, now)).toBe(false);
    expect(
      isLinkOpen(
        { active: false, expiresAt: new Date('2026-12-01T00:00:00Z') },
        now,
      ),
    ).toBe(false);
  });

  it('is true when active with no expiry', () => {
    expect(isLinkOpen({ active: true, expiresAt: null }, now)).toBe(true);
  });

  it('is true when active and expiry is in the future', () => {
    expect(
      isLinkOpen(
        { active: true, expiresAt: new Date('2026-06-01T00:00:00Z') },
        now,
      ),
    ).toBe(true);
  });

  it('is false when active but expiry is in the past', () => {
    expect(
      isLinkOpen(
        { active: true, expiresAt: new Date('2026-05-01T00:00:00Z') },
        now,
      ),
    ).toBe(false);
  });
});
