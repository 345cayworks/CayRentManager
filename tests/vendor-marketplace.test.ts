import { describe, expect, it } from 'vitest';
import {
  alreadyAddedIds,
  filterMarketplaceVendors,
  sortMarketplaceVendors,
} from '@/lib/vendors/marketplace';

type V = {
  id: string;
  name: string;
  specialty: string | null;
  featured: boolean;
  sponsored: boolean;
  serviceAreas?: string | null;
};

function v(partial: Partial<V> & { id: string; name: string }): V {
  return {
    specialty: null,
    featured: false,
    sponsored: false,
    serviceAreas: null,
    ...partial,
  };
}

describe('sortMarketplaceVendors', () => {
  it('orders sponsored before featured before plain', () => {
    const result = sortMarketplaceVendors([
      v({ id: 'p', name: 'Plain' }),
      v({ id: 'f', name: 'Feat', featured: true }),
      v({ id: 's', name: 'Spon', sponsored: true }),
    ]);
    expect(result.map((r) => r.id)).toEqual(['s', 'f', 'p']);
  });

  it('sorts name A→Z within a tier', () => {
    const result = sortMarketplaceVendors([
      v({ id: 'b', name: 'Bravo', featured: true }),
      v({ id: 'a', name: 'Alpha', featured: true }),
      v({ id: 'c', name: 'Charlie', featured: true }),
    ]);
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('ranks a sponsored+featured vendor above featured-only', () => {
    const result = sortMarketplaceVendors([
      v({ id: 'f', name: 'AFeatured', featured: true }),
      v({ id: 'sf', name: 'ZBoth', featured: true, sponsored: true }),
    ]);
    expect(result.map((r) => r.id)).toEqual(['sf', 'f']);
  });

  it('is stable for equal keys', () => {
    const result = sortMarketplaceVendors([
      v({ id: 'x1', name: 'Same' }),
      v({ id: 'x2', name: 'Same' }),
      v({ id: 'x3', name: 'Same' }),
    ]);
    expect(result.map((r) => r.id)).toEqual(['x1', 'x2', 'x3']);
  });
});

describe('filterMarketplaceVendors', () => {
  const vendors = [
    v({ id: '1', name: 'Acme Plumbing', specialty: 'Plumbing', serviceAreas: 'George Town' }),
    v({ id: '2', name: 'Bright Electric', specialty: 'Electrical', serviceAreas: 'West Bay' }),
    v({ id: '3', name: 'Cool Air', specialty: 'HVAC', serviceAreas: 'Bodden Town' }),
  ];

  it('matches name case-insensitively', () => {
    expect(filterMarketplaceVendors(vendors, 'acme', '').map((r) => r.id)).toEqual(['1']);
  });

  it('matches specialty case-insensitively', () => {
    expect(filterMarketplaceVendors(vendors, 'electrical', '').map((r) => r.id)).toEqual(['2']);
  });

  it('matches serviceAreas substring', () => {
    expect(filterMarketplaceVendors(vendors, 'bodden', '').map((r) => r.id)).toEqual(['3']);
  });

  it('returns all for empty query and specialty', () => {
    expect(filterMarketplaceVendors(vendors, '', '').map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('filters by specialty case-insensitively', () => {
    expect(filterMarketplaceVendors(vendors, '', 'hvac').map((r) => r.id)).toEqual(['3']);
  });

  it('combines query and specialty', () => {
    expect(
      filterMarketplaceVendors(vendors, 'george', 'Plumbing').map((r) => r.id),
    ).toEqual(['1']);
    expect(
      filterMarketplaceVendors(vendors, 'george', 'Electrical').map((r) => r.id),
    ).toEqual([]);
  });
});

describe('alreadyAddedIds', () => {
  it('collects non-null globalVendorIds', () => {
    const ids = alreadyAddedIds([
      { globalVendorId: 'g1', archivedAt: null },
      { globalVendorId: 'g2', archivedAt: null },
    ]);
    expect(ids).toEqual(new Set(['g1', 'g2']));
  });

  it('ignores archived copies', () => {
    const ids = alreadyAddedIds([
      { globalVendorId: 'g1', archivedAt: new Date() },
      { globalVendorId: 'g2', archivedAt: null },
    ]);
    expect(ids).toEqual(new Set(['g2']));
  });

  it('ignores null globalVendorId', () => {
    const ids = alreadyAddedIds([
      { globalVendorId: null, archivedAt: null },
      { globalVendorId: 'g1', archivedAt: null },
    ]);
    expect(ids).toEqual(new Set(['g1']));
  });
});
