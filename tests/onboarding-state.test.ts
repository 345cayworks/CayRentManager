import { describe, expect, it } from 'vitest';
import {
  computeOnboardingState,
  type OnboardingComputeInput,
} from '@/lib/onboarding/state';

function buildInput(overrides: Partial<OnboardingComputeInput> = {}): OnboardingComputeInput {
  return {
    landlordId: 'landlord-1',
    profile: {
      companyProfileCompletedAt: null,
      onboardingCompletedAt: null,
      onboardingDismissedAt: null,
    },
    propertyCount: 0,
    unitCount: 0,
    tenantCount: 0,
    maintenanceCount: 0,
    ...overrides,
  };
}

describe('computeOnboardingState', () => {
  it('marks all milestones complete when every record exists and profile is filled', () => {
    const state = computeOnboardingState(
      buildInput({
        profile: {
          companyProfileCompletedAt: new Date('2026-05-01'),
          onboardingCompletedAt: null,
          onboardingDismissedAt: null,
        },
        propertyCount: 2,
        unitCount: 5,
        tenantCount: 3,
        maintenanceCount: 1,
      }),
    );

    expect(state.totalCount).toBe(5);
    expect(state.completedCount).toBe(5);
    expect(state.remainingCount).toBe(0);
    expect(state.isComplete).toBe(true);
    expect(state.shouldNudge).toBe(false);
  });

  it('reports zero completion for a brand-new landlord', () => {
    const state = computeOnboardingState(buildInput());

    expect(state.completedCount).toBe(0);
    expect(state.remainingCount).toBe(5);
    expect(state.isComplete).toBe(false);
    expect(state.isDismissed).toBe(false);
    expect(state.shouldNudge).toBe(true);
  });

  it('treats a dismissed workspace as not nudging', () => {
    const state = computeOnboardingState(
      buildInput({
        profile: {
          companyProfileCompletedAt: null,
          onboardingCompletedAt: null,
          onboardingDismissedAt: new Date('2026-05-10'),
        },
      }),
    );

    expect(state.isDismissed).toBe(true);
    expect(state.shouldNudge).toBe(false);
  });

  it('treats an explicitly completed workspace as complete even without records', () => {
    const state = computeOnboardingState(
      buildInput({
        profile: {
          companyProfileCompletedAt: null,
          onboardingCompletedAt: new Date('2026-05-12'),
          onboardingDismissedAt: null,
        },
      }),
    );

    expect(state.isComplete).toBe(true);
    expect(state.shouldNudge).toBe(false);
    expect(state.completedAt).toEqual(new Date('2026-05-12'));
  });

  it('counts partial progress correctly', () => {
    const state = computeOnboardingState(
      buildInput({
        profile: {
          companyProfileCompletedAt: new Date('2026-05-01'),
          onboardingCompletedAt: null,
          onboardingDismissedAt: null,
        },
        propertyCount: 1,
        unitCount: 1,
        tenantCount: 0,
        maintenanceCount: 0,
      }),
    );

    expect(state.completedCount).toBe(3);
    expect(state.remainingCount).toBe(2);
    expect(state.isComplete).toBe(false);
    expect(state.shouldNudge).toBe(true);
  });
});
