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

  // Phase 1 policy: expose only the minimum set of safe fields. Internal user
  // IDs and identity-provider identifiers must not appear in this response.
  // Server-side guards remain the source of truth for access control.
  return NextResponse.json({
    authenticated: true,
    user: {
      email: user.email,
      role: user.role,
      status: user.status,
    },
  });
}
