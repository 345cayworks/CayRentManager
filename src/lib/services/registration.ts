import { AppRole, RecordStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

type RegisterLandlordInput = {
  email: string;
  fullName: string;
  companyName: string;
  displayName: string;
};

export async function registerPublicLandlord(input: RegisterLandlordInput) {
  const user = await prisma.appUser.upsert({
    where: { email: input.email.toLowerCase() },
    update: { fullName: input.fullName },
    create: {
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      role: AppRole.landlord,
      status: RecordStatus.active,
    },
  });

  const landlord = await prisma.landlordProfile.create({
    data: {
      ownerUserId: user.id,
      companyName: input.companyName,
      displayName: input.displayName,
      status: RecordStatus.active,
      memberships: {
        create: { userId: user.id, role: AppRole.landlord, status: RecordStatus.active },
      },
    },
  });

  return { user, landlord };
}
