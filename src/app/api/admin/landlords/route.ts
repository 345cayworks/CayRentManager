import { NextResponse } from 'next/server';
import { UserRole, UserStatus } from '@prisma/client';
import { getActiveUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { SubscriptionStatus } from '@prisma/client';
import {
  createLandlordInvite,
  markPasswordResetRequired,
  setLandlordAccountStatus,
  setLandlordTemporaryPassword,
} from '@/lib/services/superadmin-landlord';

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '';

async function trySendPasswordResetEmail(request: Request, email: string) {
  try {
    const recoverUrl = new URL('/.netlify/identity/recover', request.url);
    const response = await fetch(recoverUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const actor = await getActiveUser();
  if (!actor || actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '');

  try {
    switch (action) {
      case 'invite': {
        const baseUrl = DEFAULT_BASE_URL || new URL(request.url).origin;
        const result = await createLandlordInvite(actor.userId, actor.email, {
          fullName: String(body?.fullName ?? '').trim(),
          email: String(body?.email ?? '').trim(),
          phone: String(body?.phone ?? '').trim() || undefined,
          companyName: String(body?.companyName ?? '').trim(),
          displayName: String(body?.displayName ?? '').trim() || undefined,
          temporaryPassword: body?.temporaryPassword ? String(body.temporaryPassword).trim() : undefined,
        }, baseUrl);

        return NextResponse.json({ ok: true, invitationUrl: result.invitationUrl, temporaryPassword: result.temporaryPassword });
      }
      case 'activate': {
        const userId = String(body?.targetUserId ?? '');
        const update = await setLandlordAccountStatus(actor.userId, actor.email, userId, UserStatus.ACTIVE);
        return NextResponse.json({ ok: true, status: update.status });
      }
      case 'deactivate': {
        const userId = String(body?.targetUserId ?? '');
        const update = await setLandlordAccountStatus(actor.userId, actor.email, userId, UserStatus.INACTIVE);
        return NextResponse.json({ ok: true, status: update.status });
      }
      case 'suspend': {
        const userId = String(body?.targetUserId ?? '');
        const update = await setLandlordAccountStatus(actor.userId, actor.email, userId, UserStatus.SUSPENDED);
        return NextResponse.json({ ok: true, status: update.status });
      }
      case 'set_temporary_password': {
        const userId = String(body?.targetUserId ?? '');
        const password = body?.temporaryPassword ? String(body.temporaryPassword).trim() : undefined;
        const result = await setLandlordTemporaryPassword(actor.userId, actor.email, userId, password);
        return NextResponse.json({ ok: true, temporaryPassword: result.temporaryPassword });
      }
      case 'reset_password': {
        const userId = String(body?.targetUserId ?? '');
        const targetEmail = String(body?.targetEmail ?? '');
        const method = String(body?.method ?? 'email');
        const update = await markPasswordResetRequired(actor.userId, actor.email, userId);

        if (method === 'email') {
          const email = targetEmail || update.email;
          const emailSent = await trySendPasswordResetEmail(request, email);
          return NextResponse.json({ ok: true, emailSent, message: emailSent ? 'Password recovery email sent.' : 'Unable to send reset email automatically. Copy the reset instructions from the UI.', email });
        }

        const passwordResult = await setLandlordTemporaryPassword(actor.userId, actor.email, userId, body?.temporaryPassword ? String(body.temporaryPassword).trim() : undefined);
        return NextResponse.json({ ok: true, temporaryPassword: passwordResult.temporaryPassword });
      }

      case 'update_subscription_access': {
        const userId = String(body?.targetUserId ?? '');
        const complimentary = Boolean(body?.isComplimentary);
        const complimentarySeats = Math.max(0, Number(body?.complimentarySeats ?? 0));
        const trialDays = Math.max(0, Number(body?.trialDays ?? 0));
        const user = await prisma.user.findUnique({ where: { id: userId }, include: { ownedLandlords: true } });
        const landlord = user?.ownedLandlords[0];
        if (!landlord) throw new Error('Landlord workspace not found for user.');
        const plan = await prisma.subscriptionPlan.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
        if (!plan) throw new Error('Create at least one subscription plan before assigning access.');
        const now = new Date();
        const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * 86_400_000) : null;
        const subscription = await prisma.landlordSubscription.upsert({
          where: { landlordId: landlord.id },
          create: {
            landlordId: landlord.id,
            planId: plan.id,
            status: complimentary ? SubscriptionStatus.ACTIVE : trialEndsAt ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PAST_DUE,
            isComplimentary: complimentary,
            complimentarySeats,
            trialStartsAt: trialEndsAt ? now : null,
            trialEndsAt,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
            nextInvoiceAt: new Date(now.getTime() + 30 * 86_400_000),
          },
          update: {
            isComplimentary: complimentary,
            complimentarySeats,
            trialStartsAt: trialEndsAt ? now : null,
            trialEndsAt,
            status: complimentary ? SubscriptionStatus.ACTIVE : trialEndsAt ? SubscriptionStatus.ACTIVE : undefined,
          },
        });
        return NextResponse.json({ ok: true, subscription });
      }

      default:
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An error occurred.' }, { status: 400 });
  }
}
