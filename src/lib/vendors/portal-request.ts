export type PortalRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export const PORTAL_REQUEST_STATUSES: PortalRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

export function isPortalRequestStatus(v: string): v is PortalRequestStatus {
  return (PORTAL_REQUEST_STATUSES as string[]).includes(v);
}

/** Only PENDING requests can be approved/rejected/cancelled. */
export function canDecide(status: string): boolean {
  return status === 'PENDING';
}

/**
 * A landlord may submit a new request only when there is no PENDING request
 * and the vendor is not already portal-enabled.
 */
export function canRequest(opts: { portalEnabled: boolean; hasPending: boolean }): boolean {
  return !opts.portalEnabled && !opts.hasPending;
}
