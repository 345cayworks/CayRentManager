import { NextResponse } from 'next/server';
import { getUser as getNetlifyIdentityUser } from '@netlify/identity';
import { UserRole, UserStatus } from '@prisma/client';
import { createAppSession } from '@/lib/auth/session';
import { syncIdentityUser } from '@/lib/identity/sync';

function getRedirectPath(role: UserRole | string, status: UserStatus | string, mustChangePassword?: boolean, createdWorkspace?: boolean) {
  if (status === UserStatus.SUSPENDED || status === 'SUSPENDED') {
    return '/login?error=suspended';
  }

  if (status === UserStatus.INACTIVE || status === 'INACTIVE') {
    return '/login?error=inactive';
  }

  if (status === UserStatus.PENDING_INVITE || status === 'PENDING_INVITE') {
    return '/login?error=pending_invite';
  }

  if (status === UserStatus.DISABLED || status === 'DISABLED') {
    return '/login?error=disabled';
  }

  if (mustChangePassword) {
    return '/change-password';
  }

  switch (role) {
    case UserRole.SUPERADMIN:
    case 'SUPERADMIN':
      return '/admin';
    case UserRole.TENANT:
    case 'TENANT':
      return '/tenant/dashboard';
    case UserRole.LANDLORD:
    case UserRole.PROPERTY_MANAGER:
    case UserRole.ACCOUNTANT:
    case 'LANDLORD':
    case 'PROPERTY_MANAGER':
    case 'ACCOUNTANT':
      return createdWorkspace ? '/onboarding' : '/dashboard';
    default:
      return '/unauthorized';
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const identityUser = await getNetlifyIdentityUser();
  const netlifyUserId = identityUser?.id ?? '';
  const email = String(identityUser?.email ?? '').toLowerCase();
  const fullName = body?.fullName ? String(body.fullName) : identityUser?.name ?? null;

  if (!netlifyUserId || !email) {
    return NextResponse.json({ error: 'A valid Netlify Identity session is required.' }, { status: 401 });
  }

  const { user, createdWorkspace } = await syncIdentityUser({ netlifyUserId, email, fullName });

  if (user.status === UserStatus.DISABLED) {
    return NextResponse.json(
      {
        error: 'Account disabled.',
        redirectTo: '/login?error=disabled',
      },
      { status: 403 },
    );
  }

  await createAppSession(user.id);

  const appUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
  };

  return NextResponse.json({
    user: appUser,
    createdWorkspace,
    redirectTo: getRedirectPath(appUser.role, appUser.status, appUser.mustChangePassword, createdWorkspace),
  });
}
