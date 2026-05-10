import { NextResponse } from 'next/server';
import { getAppSessionUser } from '@/lib/auth/session';

export async function GET() {
  const user = await getAppSessionUser();
  if (!user) return NextResponse.json({ authenticated: false });

  return NextResponse.json({
    authenticated: true,
    user: {
      email: user.email,
      role: user.role,
      status: user.status,
    },
  });
}
