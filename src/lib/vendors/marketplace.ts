/**
 * Pure helpers for the landlord vendor marketplace (Phase 5.2).
 * Kept DB-free so they can be unit tested.
 */

export type MarketplaceVendor = {
  id: string;
  name: string;
  specialty: string | null;
  featured: boolean;
  sponsored: boolean;
};

/** Rank: sponsored (2) > featured (1) > plain (0). */
function tier(v: MarketplaceVendor): number {
  if (v.sponsored) return 2;
  if (v.featured) return 1;
  return 0;
}

/** Sponsored first, then featured, then name A→Z. Stable. */
export function sortMarketplaceVendors<T extends MarketplaceVendor>(vendors: T[]): T[] {
  return vendors
    .map((vendor, index) => ({ vendor, index }))
    .sort((a, b) => {
      const tierDiff = tier(b.vendor) - tier(a.vendor);
      if (tierDiff !== 0) return tierDiff;
      const nameDiff = a.vendor.name.localeCompare(b.vendor.name, undefined, {
        sensitivity: 'base',
      });
      if (nameDiff !== 0) return nameDiff;
      return a.index - b.index;
    })
    .map((entry) => entry.vendor);
}

/** Case-insensitive match on name OR specialty OR (optional) serviceAreas substring. */
export function filterMarketplaceVendors<
  T extends MarketplaceVendor & { serviceAreas?: string | null },
>(vendors: T[], query: string, specialty: string): T[] {
  const q = query.trim().toLowerCase();
  const spec = specialty.trim().toLowerCase();

  return vendors.filter((vendor) => {
    if (spec.length > 0) {
      if ((vendor.specialty ?? '').trim().toLowerCase() !== spec) return false;
    }

    if (q.length === 0) return true;

    const haystacks = [
      vendor.name,
      vendor.specialty ?? '',
      vendor.serviceAreas ?? '',
    ];
    return haystacks.some((value) => value.toLowerCase().includes(q));
  });
}

/** Set of globalVendorIds the landlord has already copied (non-archived). */
export function alreadyAddedIds(
  localVendors: Array<{ globalVendorId: string | null; archivedAt: Date | null }>,
): Set<string> {
  const ids = new Set<string>();
  for (const vendor of localVendors) {
    if (vendor.globalVendorId && vendor.archivedAt === null) {
      ids.add(vendor.globalVendorId);
    }
  }
  return ids;
}
