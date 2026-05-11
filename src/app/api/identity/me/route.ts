import { NextResponse } from 'next/server';
import { getActiveUser } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getActiveUser();

  if (!user) {
    return NextResponse.json(
      {
        authenticated: false,
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.userId,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      name: user.name ?? null,
    },
  });
}
