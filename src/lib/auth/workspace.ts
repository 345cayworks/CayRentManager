export function getActiveLandlordWorkspace(membershipLandlordIds: string[], requestedLandlordId?: string) {
  if (requestedLandlordId && membershipLandlordIds.includes(requestedLandlordId)) {
    return requestedLandlordId;
  }

  return membershipLandlordIds[0] ?? null;
}
