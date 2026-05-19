import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { lookupAndValidateAccessCode } from '@/lib/billing/access-code-lookup';

export const dynamic = 'force-dynamic';

/**
 * Best-effort, email-keyed PENDING capture invoked right after a successful
 * Netlify signup. There is no app user yet (created later in Phase 3), so we do
 * NOT write an AuditLog (AuditLog requires a user actor). Idempotent: the
 * partial-unique index (accessCodeId, registrantEmail) WHERE status='PENDING'
 * guards against duplicates; a P2002 collision is treated as success.
 * This endpoint never 500s — signup must proceed regardless.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      code?: unknown;
      email?: unknown;
    };

    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!code || !email) {
      return NextResponse.json({ ok: true });
    }

    const validation = await lookupAndValidateAccessCode({ code, email });
    if (!validation.ok) {
      // Benign no-op: do not persist invalid captures, but never error the UX.
      return NextResponse.json({ ok: true });
    }

    const accessCode = await prisma.accessCode.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      select: { id: true, code: true },
    });
    if (!accessCode) {
      return NextResponse.json({ ok: true });
    }

    const existing = await prisma.accessCodeRedemption.findFirst({
      where: { accessCodeId: accessCode.id, registrantEmail: email, status: 'PENDING' },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true });
    }

    try {
      await prisma.accessCodeRedemption.create({
        data: {
          accessCodeId: accessCode.id,
          code: accessCode.code,
          registrantEmail: email,
          status: 'PENDING',
        },
      });
    } catch (error) {
      // P2002: unique partial-index race -> already captured -> success.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ ok: true });
      }
      // Any other persistence failure is swallowed; signup must not fail.
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
