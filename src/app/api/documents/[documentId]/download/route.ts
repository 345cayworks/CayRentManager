import { NextResponse } from 'next/server';
import { DocumentSource, UserRole } from '@prisma/client';
import { getActiveUser, getUserLandlordMemberships } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getDocumentBlob } from '@/lib/storage/blobs';
import { canAccessDocument } from '@/lib/storage/access';
import { isInlinePreviewable } from '@/lib/storage/validate';
import { sanitizeFileName } from '@/lib/storage/blobs';

export const dynamic = 'force-dynamic';

const LANDLORD_ROLES: UserRole[] = [
  UserRole.LANDLORD,
  UserRole.PROPERTY_MANAGER,
  UserRole.ACCOUNTANT,
];

export async function GET(
  request: Request,
  { params }: { params: { documentId: string } },
) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.documentId },
    include: { tenant: { select: { userId: true } } },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  let membershipLandlordIds: string[] = [];
  if (LANDLORD_ROLES.includes(user.role)) {
    const memberships = await getUserLandlordMemberships(user.userId);
    membershipLandlordIds = memberships.map((m) => m.landlordId);
  }

  const allowed = canAccessDocument(
    { userId: user.userId, role: user.role },
    {
      landlordId: doc.landlordId,
      visibility: doc.visibility,
      tenantUserId: doc.tenant?.userId ?? null,
    },
    membershipLandlordIds,
  );

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (doc.source === DocumentSource.BROKEN_PLACEHOLDER) {
    return NextResponse.json(
      { error: 'This file was never stored. Please re-upload.' },
      { status: 410 },
    );
  }

  if (doc.source === DocumentSource.EXTERNAL) {
    return NextResponse.json(
      { error: 'External document — open via its source URL.', fileUrl: doc.fileUrl },
      { status: 409 },
    );
  }

  if (!doc.storageKey) {
    return NextResponse.json({ error: 'Stored file is missing.' }, { status: 404 });
  }

  const blob = await getDocumentBlob(doc.storageKey);
  if (!blob) {
    return NextResponse.json({ error: 'Stored file is missing.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const forceDownload = url.searchParams.get('download') === '1';
  const contentType = doc.contentType || 'application/octet-stream';
  const safeName = sanitizeFileName(doc.fileName);
  const disposition =
    isInlinePreviewable(doc.contentType) && !forceDownload
      ? 'inline'
      : `attachment; filename="${safeName}"`;

  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.userId,
        actorEmail: user.email,
        action: 'document.downloaded',
        entityType: 'Document',
        entityId: doc.id,
        landlordId: doc.landlordId,
        details: { storageKey: doc.storageKey },
      },
    });
  } catch {
    // Audit write failure must not block the download.
  }

  return new Response(blob.data, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(blob.data.byteLength),
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
    },
  });
}
