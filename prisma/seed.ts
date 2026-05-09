import { PrismaClient, LeaseStatus, PaymentStatus, RecordStatus, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedLandlord(id: string, email: string, companyName: string, propertyName: string, unitName: string) {
  const owner = await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.LANDLORD, status: UserStatus.ACTIVE },
    create: { email, name: companyName, fullName: `${companyName} Owner`, role: UserRole.LANDLORD, status: UserStatus.ACTIVE },
  });

  const landlord = await prisma.landlordProfile.upsert({
    where: { id },
    update: {},
    create: { id, ownerUserId: owner.id, companyName, displayName: companyName, status: RecordStatus.ACTIVE },
  });

  await prisma.landlordMembership.upsert({
    where: { landlordId_userId: { landlordId: landlord.id, userId: owner.id } },
    update: { role: UserRole.LANDLORD, status: RecordStatus.ACTIVE },
    create: { landlordId: landlord.id, userId: owner.id, role: UserRole.LANDLORD, status: RecordStatus.ACTIVE },
  });

  const property = await prisma.property.create({
    data: {
      landlordId: landlord.id,
      name: propertyName,
      address: '100 Main St',
      city: 'Miami',
      state: 'FL',
      country: 'US',
      propertyType: 'Residential',
      status: RecordStatus.ACTIVE,
    },
  });

  const unit = await prisma.unit.create({
    data: { landlordId: landlord.id, propertyId: property.id, unitName, rentAmount: 1500, bedrooms: 2, bathrooms: 1, status: RecordStatus.ACTIVE },
  });

  const tenantUser = await prisma.user.create({
    data: { email: `tenant+${id}@rentflow.test`, name: `Tenant ${id}`, fullName: `Tenant ${id}`, role: UserRole.TENANT, status: UserStatus.ACTIVE },
  });

  const tenant = await prisma.tenant.create({
    data: { landlordId: landlord.id, userId: tenantUser.id, fullName: `Tenant ${id}`, email: tenantUser.email!, status: RecordStatus.ACTIVE },
  });

  const lease = await prisma.lease.create({
    data: {
      landlordId: landlord.id,
      propertyId: property.id,
      unitId: unit.id,
      tenantId: tenant.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      rentAmount: 1500,
      depositAmount: 1500,
      status: LeaseStatus.ACTIVE,
    },
  });

  await prisma.payment.create({
    data: {
      landlordId: landlord.id,
      tenantId: tenant.id,
      leaseId: lease.id,
      propertyId: property.id,
      unitId: unit.id,
      dueDate: new Date('2026-05-01'),
      paymentDate: new Date('2026-05-03'),
      amountDue: 1500,
      amountPaid: id === 'landlord_a' ? 1500 : 500,
      balance: id === 'landlord_a' ? 0 : 1000,
      status: id === 'landlord_a' ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
    },
  });

  await prisma.expense.create({
    data: {
      landlordId: landlord.id,
      propertyId: property.id,
      category: 'Repairs',
      vendor: 'Demo Vendor',
      amount: id === 'landlord_a' ? 125 : 250,
      expenseDate: new Date('2026-05-05'),
      createdBy: owner.id,
      status: RecordStatus.ACTIVE,
    },
  });

  return { owner, landlord };
}

async function main() {
  const superadminEmail = 'info@cayworks.com';
  const superadmin = await prisma.user.upsert({
    where: { email: superadminEmail },
    update: { role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE, disabledAt: null, disabledBy: null, disabledReason: null },
    create: { email: superadminEmail, name: 'Primary Superadmin', fullName: 'Primary Superadmin', role: UserRole.SUPERADMIN, status: UserStatus.ACTIVE },
  });

  await seedLandlord('landlord_a', 'owner+a@rentflow.test', 'Landlord A LLC', 'Apex Apartments', 'A-101');
  await seedLandlord('landlord_b', 'owner+b@rentflow.test', 'Landlord B LLC', 'Bayside Flats', 'B-201');

  await prisma.auditLog.create({
    data: {
      actorUserId: superadmin.id,
      actorEmail: superadmin.email!,
      action: 'seed.bootstrap',
      entityType: 'system',
      entityId: 'initial_seed',
      details: { message: 'Initial multi-landlord demo data generated without committing demo passwords.' },
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
