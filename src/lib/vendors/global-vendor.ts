/**
 * Pure helpers for global vendor management (Phase 5.1).
 * Kept DB-free so they can be unit tested.
 */

/**
 * Parse an optional monthly fee from a form string.
 * - empty string -> null (no fee)
 * - valid non-negative number -> that number
 * - non-numeric or negative -> throws
 */
export function parseMonthlyFee(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error('Monthly fee must be a valid number.');
  }
  if (parsed < 0) {
    throw new Error('Monthly fee must be zero or greater.');
  }
  return parsed;
}

export type VendorFlagInput = {
  approvedStatus: string | null | undefined;
  featured: string | null | undefined;
  sponsored: string | null | undefined;
};

export type VendorFlags = {
  approvedStatus: boolean;
  featured: boolean;
  sponsored: boolean;
};

/**
 * Map HTML checkbox form values ('on' when checked, absent otherwise) to booleans.
 */
export function normalizeVendorFlags(input: VendorFlagInput): VendorFlags {
  return {
    approvedStatus: input.approvedStatus === 'on',
    featured: input.featured === 'on',
    sponsored: input.sponsored === 'on',
  };
}
