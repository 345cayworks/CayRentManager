import { getConnectionString } from '@netlify/database';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

const OWNER_EMAIL = 'info@cayworks.com';

function getDatasourceUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    return getConnectionString();
  } catch {
    return undefined;
  }
}

const datasourceUrl = getDatasourceUrl();
const prisma = new PrismaClient({
  ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
});

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  const user = existing
    ? await prisma.user.update({
        where: { email: OWNER_EMAIL },
        data: {
          name: existing.name ?? 'Platform Owner',
          fullName: existing.fullName ?? 'Platform Owner',
          role: UserRole.SUPERADMIN,
          status: UserStatus.ACTIVE,
          disabledAt: null,
          disabledBy: null,
          disabledById: null,
          disabledReason: null,
        },
      })
    : await prisma.user.create({
        data: {
          email: OWNER_EMAIL,
          name: 'Platform Owner',
          fullName: 'Platform Owner',
          role: UserRole.SUPERADMIN,
          status: UserStatus.ACTIVE,
        },
      });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'owner_bootstrapped',
      entityType: 'User',
      entityId: user.id,
      details: { source: 'scripts/bootstrap-owner.mjs' },
    },
  });

  console.log(`Prepared app-side Superadmin profile for ${OWNER_EMAIL}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
