import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { getActiveUser, getUserLandlordMemberships } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getPhotoBlob } from '@/lib/storage/blobs';
import { canAccessPropertyPhoto } from '@/lib/storage/access';

export const dynamic = 'force-dynamic';

const LANDLORD_ROLES: UserRole[] = [
  UserRole.LANDLORD,
  UserRole.PROPERTY_MANAGER,
  UserRole.ACCOUNTANT,
];

export async function GET(
  _request: Request,
  { params }: { params: { propertyId: string; photoId: string } },
) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const photo = await prisma.propertyPhoto.findFirst({
    where: { id: params.photoId, propertyId: params.propertyId },
  });

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  let membershipLandlordIds: string[] = [];
  if (LANDLORD_ROLES.includes(user.role)) {
    const memberships = await getUserLandlordMemberships(user.userId);
    membershipLandlordIds = memberships.map((m) => m.landlordId);
  }

  const allowed = canAccessPropertyPhoto(
    { userId: user.userId, role: user.role },
    photo.landlordId,
    membershipLandlordIds,
  );

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!photo.storageKey) {
    return NextResponse.json({ error: 'Stored image is missing.' }, { status: 404 });
  }

  const blob = await getPhotoBlob(photo.storageKey);
  if (!blob) {
    return NextResponse.json({ error: 'Stored image is missing.' }, { status: 404 });
  }

  return new Response(blob.data, {
    headers: {
      'Content-Type': photo.contentType || 'application/octet-stream',
      'Content-Length': String(blob.data.byteLength),
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
