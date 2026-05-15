import { prisma } from '@/lib/db/prisma';

export type OnboardingMilestoneKey =
  | 'companyProfile'
  | 'property'
  | 'unit'
  | 'tenant'
  | 'maintenance';

export type OnboardingMilestone = {
  key: OnboardingMilestoneKey;
  title: string;
  description: string;
  href: string;
  completed: boolean;
};

export type OnboardingState = {
  landlordId: string;
  milestones: OnboardingMilestone[];
  completedCount: number;
  totalCount: number;
  completedAt: Date | null;
  dismissedAt: Date | null;
  isDismissed: boolean;
  isComplete: boolean;
  remainingCount: number;
  shouldNudge: boolean;
};

export type OnboardingComputeInput = {
  landlordId: string;
  profile: {
    companyProfileCompletedAt: Date | null;
    onboardingCompletedAt: Date | null;
    onboardingDismissedAt: Date | null;
  } | null;
  propertyCount: number;
  unitCount: number;
  tenantCount: number;
  maintenanceCount: number;
};

export function computeOnboardingState(input: OnboardingComputeInput): OnboardingState {
  const { landlordId, profile, propertyCount, unitCount, tenantCount, maintenanceCount } = input;

  const milestones: OnboardingMilestone[] = [
    {
      key: 'companyProfile',
      title: 'Complete company profile',
      description: 'Add your business contact details, address, and branding.',
      href: '/onboarding/company-profile',
      completed: Boolean(profile?.companyProfileCompletedAt),
    },
    {
      key: 'property',
      title: 'Add your first property',
      description: 'Create your first property to start tracking your portfolio.',
      href: '/properties/new',
      completed: propertyCount > 0,
    },
    {
      key: 'unit',
      title: 'Create units',
      description: 'Break properties into rentable units.',
      href: '/units/new',
      completed: unitCount > 0,
    },
    {
      key: 'tenant',
      title: 'Invite your first tenant',
      description: 'Send a tenant invite or add a tenant manually.',
      href: '/tenants/new',
      completed: tenantCount > 0,
    },
    {
      key: 'maintenance',
      title: 'Activate maintenance tracking',
      description: 'Add vendors and start logging maintenance requests.',
      href: '/maintenance/vendors',
      completed: maintenanceCount > 0,
    },
  ];

  const completedCount = milestones.filter((m) => m.completed).length;
  const totalCount = milestones.length;
  const completedAt = profile?.onboardingCompletedAt ?? null;
  const dismissedAt = profile?.onboardingDismissedAt ?? null;
  const isComplete = Boolean(completedAt) || completedCount === totalCount;
  const isDismissed = Boolean(dismissedAt);

  return {
    landlordId,
    milestones,
    completedCount,
    totalCount,
    completedAt,
    dismissedAt,
    isDismissed,
    isComplete,
    remainingCount: Math.max(0, totalCount - completedCount),
    shouldNudge: !isComplete && !isDismissed,
  };
}

export async function getOnboardingState(landlordId: string): Promise<OnboardingState> {
  const [profile, propertyCount, unitCount, tenantCount, maintenanceCount] = await Promise.all([
    prisma.landlordProfile.findUnique({
      where: { id: landlordId },
      select: {
        companyProfileCompletedAt: true,
        onboardingCompletedAt: true,
        onboardingDismissedAt: true,
      },
    }),
    prisma.property.count({ where: { landlordId } }),
    prisma.unit.count({ where: { landlordId } }),
    prisma.tenant.count({ where: { landlordId } }),
    prisma.maintenanceRequest.count({ where: { landlordId } }),
  ]);

  return computeOnboardingState({
    landlordId,
    profile,
    propertyCount,
    unitCount,
    tenantCount,
    maintenanceCount,
  });
}
