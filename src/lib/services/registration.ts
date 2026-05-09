import { RecordStatus, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

type RegisterLandlordInput = {
  email: string;
  fullName: string;
  companyName: string;
  displayName: string;
};

export async function registerPublicLandlord(input: RegisterLandlordInput) {
  const user = await prisma.user.upsert({
    where: { email: input.email.toLowerCase() },
    update: { fullName: input.fullName, name: input.fullName },
    create: {
      email: input.email.toLowerCase(),
      name: input.fullName,
      fullName: input.fullName,
      role: UserRole.LANDLORD,
      status: UserStatus.ACTIVE,
    },
  });

  const landlord = await prisma.landlordProfile.create({
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

  return { user, landlord };
}
