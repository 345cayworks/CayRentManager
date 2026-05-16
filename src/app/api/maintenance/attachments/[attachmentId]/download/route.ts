import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { getActiveUser, getUserLandlordMemberships } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getMaintenanceBlob, sanitizeFileName } from '@/lib/storage/blobs';
import { isInlinePreviewable } from '@/lib/storage/validate';

export const dynamic = 'force-dynamic';

const LANDLORD_ROLES: UserRole[] = [
  UserRole.LANDLORD,
  UserRole.PROPERTY_MANAGER,
  UserRole.ACCOUNTANT,
];

const VENDOR_ROLES: UserRole[] = [UserRole.VENDOR, UserRole.MAINTENANCE_PROVIDER];

export async function GET(
  request: Request,
  { params }: { params: { attachmentId: string } },
) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const attachment = await prisma.maintenanceAttachment.findUnique({
    where: { id: params.attachmentId },
    include: {
      maintenanceRequest: {
        include: { tenant: { select: { userId: true } } },
      },
    },
  });

  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  const req = attachment.maintenanceRequest;
  const landlordId = attachment.landlordId ?? req.landlordId;

  let allowed = false;

  if (user.role === UserRole.SUPERADMIN) {
    allowed = true;
  } else if (LANDLORD_ROLES.includes(user.role)) {
    const memberships = await getUserLandlordMemberships(user.userId);
    allowed = memberships.some((m) => m.landlordId === landlordId);
  } else if (user.role === UserRole.TENANT) {
    allowed = req.tenant?.userId === user.userId;
  } else if (VENDOR_ROLES.includes(user.role)) {
    const vendorLink = await prisma.maintenanceWorkOrder.findFirst({
      where: {
        maintenanceRequestId: req.id,
        vendor: { userId: user.userId, archivedAt: null },
      },
    });
    if (vendorLink) {
      allowed = true;
    } else {
      const assigned = await prisma.maintenanceRequest.findFirst({
        where: { id: req.id, vendor: { userId: user.userId, archivedAt: null } },
        select: { id: true },
      });
      allowed = Boolean(assigned);
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!attachment.storageKey) {
    if (attachment.fileUrl) {
      return NextResponse.json(
        { error: 'External attachment — open via its source URL.', fileUrl: attachment.fileUrl },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Stored file is missing.' }, { status: 404 });
  }

  const blob = await getMaintenanceBlob(attachment.storageKey);
  if (!blob) {
    return NextResponse.json({ error: 'Stored file is missing.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const forceDownload = url.searchParams.get('download') === '1';
  const contentType = attachment.fileType || 'application/octet-stream';
  const metaName =
    typeof blob.metadata.fileName === 'string' ? blob.metadata.fileName : 'attachment';
  const safeName = sanitizeFileName(metaName);
  const disposition =
    isInlinePreviewable(attachment.fileType) && !forceDownload
      ? 'inline'
      : `attachment; filename="${safeName}"`;

  return new Response(blob.data, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(blob.data.byteLength),
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
    },
  });
}
