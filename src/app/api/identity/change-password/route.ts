import { NextResponse } from 'next/server';
import { getUser as getNetlifyIdentityUser } from '@netlify/identity';
import { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export async function POST() {
  const identityUser = await getNetlifyIdentityUser();
  const email = String(identityUser?.email ?? '').toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'A valid Netlify Identity session is required.' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: 'Unable to find app user.' }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mustChangePassword: false,
      temporaryPasswordHash: null,
      temporaryPasswordSetAt: null,
      status: user.status === UserStatus.PENDING_INVITE ? UserStatus.ACTIVE : user.status,
    },
  });

  return NextResponse.json({ ok: true });
}
