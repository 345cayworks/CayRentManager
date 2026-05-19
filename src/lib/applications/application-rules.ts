export type AppStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

/**
 * A decision can only be recorded while the application is still open for
 * review. Terminal statuses (APPROVED / REJECTED / WITHDRAWN) cannot be
 * decided again.
 */
export function canDecide(status: AppStatus): boolean {
  return status === 'SUBMITTED' || status === 'UNDER_REVIEW';
}

/**
 * Allowed forward transitions for an application status. Terminal statuses
 * return an empty array.
 */
export function nextStatuses(status: AppStatus): AppStatus[] {
  switch (status) {
    case 'SUBMITTED':
      return ['UNDER_REVIEW', 'APPROVED', 'REJECTED'];
    case 'UNDER_REVIEW':
      return ['APPROVED', 'REJECTED'];
    case 'APPROVED':
    case 'REJECTED':
    case 'WITHDRAWN':
      return [];
  }
}

/**
 * A public application link accepts submissions only while it is active and
 * either has no expiry or its expiry is still in the future.
 */
export function isLinkOpen(
  link: { active: boolean; expiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (!link.active) return false;
  if (!link.expiresAt) return true;
  return link.expiresAt.getTime() > now.getTime();
}
