import { RecordStatus, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { ensureLandlordSubscription } from '@/lib/billing/subscription-bootstrap';
import { linkCapturedRedemptionsForLandlord } from '@/lib/billing/access-code-apply';

type RegisterLandlordInput = {
  email: string;
  fullName: string;
  companyName: string;
  displayName: string;
};

export async function registerPublicLandlord(input: RegisterLandlordInput) {
  const email = input.email.trim().toLowerCase();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      include: {
        ownedLandlords: { where: { status: RecordStatus.ACTIVE }, take: 1 },
        memberships: { where: { status: RecordStatus.ACTIVE, landlord: { status: RecordStatus.ACTIVE } }, include: { landlord: true }, take: 1 },
      },
    });

    if (existing?.status === UserStatus.DISABLED) throw new Error('This account is disabled.');

    const existingLandlord = existing?.ownedLandlords[0] ?? existing?.memberships[0]?.landlord;
    if (existing && existingLandlord) return { user: existing, landlord: existingLandlord };

    if (existing && existing.role !== UserRole.LANDLORD) {
      throw new Error('This account is not eligible for public landlord registration.');
    }

    const user =
      existing ??
      (await tx.user.create({
        data: {
          email,
          name: input.fullName,
          fullName: input.fullName,
          role: UserRole.LANDLORD,
          status: UserStatus.ACTIVE,
        },
      }));

    const landlord = await tx.landlordProfile.create({
      data: {
        ownerUserId: user.id,
        companyName: input.companyName,
        displayName: input.displayName,
        status: RecordStatus.ACTIVE,
        memberships: {
          create: { userId: user.id, role: UserRole.LANDLORD, status: RecordStatus.ACTIVE },
        },
      },
    });

    // Best-effort subscription bootstrap. MUST NOT prevent the
    // user/landlord transaction from committing.
    try {
      await ensureLandlordSubscription(tx, landlord.id);
    } catch {
      // Swallow: registration is non-fatal for subscription bootstrap.
    }

    return { user, landlord, createdNow: true };
  });

  // Post-commit, best-effort: link any PENDING access-code redemptions
  // captured at signup and apply their registrant benefit. Never throws
  // out of the registration path.
  if (result.createdNow) {
    try {
      await linkCapturedRedemptionsForLandlord(result.landlord.id, email, result.user.id);
    } catch {
      // Swallow: redemption linking must never block registration.
    }
  }

  return { user: result.user, landlord: result.landlord };
}
