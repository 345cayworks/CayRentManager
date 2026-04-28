import { PrismaClient, AppRole, RecordStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const superadminEmail = 'info@cayworks.com';

  const superadmin = await prisma.appUser.upsert({
    where: { email: superadminEmail },
    update: { role: AppRole.superadmin, status: RecordStatus.active },
    create: {
      email: superadminEmail,
      fullName: 'Primary Superadmin',
      role: AppRole.superadmin,
      status: RecordStatus.active,
    },
  });

  const landlordAUser = await prisma.appUser.upsert({
    where: { email: 'owner+a@rentflow.test' },
    update: {},
    create: { email: 'owner+a@rentflow.test', fullName: 'Landlord A Owner', role: AppRole.landlord, status: RecordStatus.active },
  });

  const landlordBUser = await prisma.appUser.upsert({
    where: { email: 'owner+b@rentflow.test' },
    update: {},
    create: { email: 'owner+b@rentflow.test', fullName: 'Landlord B Owner', role: AppRole.landlord, status: RecordStatus.active },
  });

  const landlordA = await prisma.landlordProfile.upsert({
    where: { id: 'landlord_a' },
    update: {},
    create: { id: 'landlord_a', ownerUserId: landlordAUser.id, companyName: 'Landlord A LLC', displayName: 'Landlord A', status: RecordStatus.active },
  });

  const landlordB = await prisma.landlordProfile.upsert({
    where: { id: 'landlord_b' },
    update: {},
    create: { id: 'landlord_b', ownerUserId: landlordBUser.id, companyName: 'Landlord B LLC', displayName: 'Landlord B', status: RecordStatus.active },
  });

  await prisma.landlordMembership.createMany({
    data: [
      { landlordId: landlordA.id, userId: landlordAUser.id, role: AppRole.landlord, status: RecordStatus.active },
      { landlordId: landlordB.id, userId: landlordBUser.id, role: AppRole.landlord, status: RecordStatus.active },
    ],
    skipDuplicates: true,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: superadmin.id,
      actorEmail: superadmin.email,
      action: 'seed.bootstrap',
      entityType: 'system',
      entityId: 'initial_seed',
      details: { message: 'Initial multi-landlord demo data generated.' },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
