import { prisma } from '@/lib/db/prisma';

type AuditInput = {
  actorUserId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  landlordId?: string;
  targetUserId?: string;
  targetEmail?: string;
  details?: Record<string, unknown>;
  request?: Request;
};

export function getRequestAuditMetadata(request?: Request) {
  if (!request) return {};

  const forwardedFor = request.headers.get('x-forwarded-for') ?? undefined;
  const userAgent = request.headers.get('user-agent') ?? undefined;
  const referer = request.headers.get('referer') ?? undefined;

  return {
    request: {
      ip: forwardedFor?.split(',')[0]?.trim() ?? null,
      forwardedFor: forwardedFor ?? null,
      userAgent: userAgent ?? null,
      referer: referer ?? null,
    },
  };
}

export async function writeAuditLog(input: AuditInput) {
  const requestMetadata = getRequestAuditMetadata(input.request);

  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      landlordId: input.landlordId,
      targetUserId: input.targetUserId,
      targetEmail: input.targetEmail,
      details: {
        ...(input.details ?? {}),
        ...requestMetadata,
      },
    },
  });
}
