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

  // Properties
  const propA = await prisma.property.create({
    data: { landlordId: landlordA.id, name: 'Ocean View Apts', address: '123 Ocean Dr', city: 'Miami', state: 'FL', country: 'USA', propertyType: 'Multi-Family' },
  });
  const propB = await prisma.property.create({
    data: { landlordId: landlordB.id, name: 'Mountain Retreat', address: '456 Mountain Rd', city: 'Denver', state: 'CO', country: 'USA', propertyType: 'Single-Family' },
  });

  // Units
  const unitA1 = await prisma.unit.create({
    data: { landlordId: landlordA.id, propertyId: propA.id, unitName: '1A', rentAmount: 1500, depositAmount: 1500 },
  });
  const unitB1 = await prisma.unit.create({
    data: { landlordId: landlordB.id, propertyId: propB.id, unitName: 'Whole House', rentAmount: 2500, depositAmount: 2500 },
  });

  // Tenant Users
  const tenantAUser = await prisma.appUser.upsert({
    where: { email: 'tenant+a@rentflow.test' },
    update: {},
    create: { email: 'tenant+a@rentflow.test', fullName: 'Tenant A', role: AppRole.tenant, status: RecordStatus.active },
  });
  const tenantBUser = await prisma.appUser.upsert({
    where: { email: 'tenant+b@rentflow.test' },
    update: {},
    create: { email: 'tenant+b@rentflow.test', fullName: 'Tenant B', role: AppRole.tenant, status: RecordStatus.active },
  });

  // Tenants Profiles
  const tenantA = await prisma.tenant.create({
    data: { landlordId: landlordA.id, userId: tenantAUser.id, fullName: 'Tenant A', email: 'tenant+a@rentflow.test' },
  });
  const tenantB = await prisma.tenant.create({
    data: { landlordId: landlordB.id, userId: tenantBUser.id, fullName: 'Tenant B', email: 'tenant+b@rentflow.test' },
  });

  // Leases
  const dateStr = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(dateStr.getFullYear() + 1);

  const leaseA = await prisma.lease.create({
    data: { landlordId: landlordA.id, propertyId: propA.id, unitId: unitA1.id, tenantId: tenantA.id, startDate: dateStr, endDate: nextYear, rentAmount: 1500 },
  });
  const leaseB = await prisma.lease.create({
    data: { landlordId: landlordB.id, propertyId: propB.id, unitId: unitB1.id, tenantId: tenantB.id, startDate: dateStr, endDate: nextYear, rentAmount: 2500 },
  });

  // Payments
  await prisma.payment.create({
    data: { landlordId: landlordA.id, tenantId: tenantA.id, leaseId: leaseA.id, propertyId: propA.id, unitId: unitA1.id, dueDate: dateStr, amountDue: 1500, amountPaid: 1500, balance: 0, status: 'active' },
  });
  await prisma.payment.create({
    data: { landlordId: landlordB.id, tenantId: tenantB.id, leaseId: leaseB.id, propertyId: propB.id, unitId: unitB1.id, dueDate: dateStr, amountDue: 2500, amountPaid: 0, balance: 2500, status: 'pending' },
  });

  // Expenses
  await prisma.expense.create({
    data: { landlordId: landlordA.id, propertyId: propA.id, category: 'Repair', amount: 300, expenseDate: dateStr, createdBy: landlordAUser.id },
  });
  await prisma.expense.create({
    data: { landlordId: landlordB.id, propertyId: propB.id, category: 'Maintenance', amount: 150, expenseDate: dateStr, createdBy: landlordBUser.id },
  });

  // Maintenance
  await prisma.maintenanceRequest.create({
    data: { landlordId: landlordA.id, propertyId: propA.id, unitId: unitA1.id, tenantId: tenantA.id, title: 'Leaky faucet', description: 'Dripping in kitchen', priority: 'Low' },
  });
  await prisma.maintenanceRequest.create({
    data: { landlordId: landlordB.id, propertyId: propB.id, unitId: unitB1.id, tenantId: tenantB.id, title: 'Broken heater', description: 'No heat', priority: 'High' },
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
