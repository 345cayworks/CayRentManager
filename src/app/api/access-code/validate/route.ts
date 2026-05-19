import { NextResponse } from 'next/server';
import { lookupAndValidateAccessCode } from '@/lib/billing/access-code-lookup';

export const dynamic = 'force-dynamic';

/**
 * Public, unauthenticated pre-signup validation. Never leaks internal fields:
 * the response is only { ok, preview } or { ok, reason }. Resilient by design —
 * any failure resolves to a benign negative result so the signup UX never 500s.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      code?: unknown;
      email?: unknown;
      planCode?: unknown;
    };

    const code = typeof body.code === 'string' ? body.code : '';
    const email = typeof body.email === 'string' ? body.email : '';
    const planCode = typeof body.planCode === 'string' ? body.planCode : null;

    if (!code.trim()) {
      return NextResponse.json({ ok: false, reason: 'Code not found.' });
    }

    const result = await lookupAndValidateAccessCode({ code, email, planCode });
    if (result.ok) {
      return NextResponse.json({ ok: true, preview: result.preview });
    }
    return NextResponse.json({ ok: false, reason: result.reason });
  } catch {
    return NextResponse.json({ ok: false, reason: 'Could not validate code right now.' });
  }
}
