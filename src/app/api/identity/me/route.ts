import { NextResponse } from 'next/server';
import { getAppSessionUser } from '@/lib/auth/session';

export async function GET() {
  const user = await getAppSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.fullName ?? user.name,
      role: user.role,
      status: user.status,
    },
  });
}
