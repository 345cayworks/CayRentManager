import { describe, expect, it } from 'vitest';
import { normalizeVendorFlags, parseMonthlyFee } from '@/lib/vendors/global-vendor';

describe('parseMonthlyFee', () => {
  it('returns null for an empty string', () => {
    expect(parseMonthlyFee('')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(parseMonthlyFee('   ')).toBeNull();
  });

  it('parses an integer fee', () => {
    expect(parseMonthlyFee('49')).toBe(49);
  });

  it('parses a decimal fee', () => {
    expect(parseMonthlyFee('49.99')).toBe(49.99);
  });

  it('accepts zero', () => {
    expect(parseMonthlyFee('0')).toBe(0);
  });

  it('throws on a negative fee', () => {
    expect(() => parseMonthlyFee('-1')).toThrow();
  });

  it('throws on a non-numeric value', () => {
    expect(() => parseMonthlyFee('abc')).toThrow();
  });
});

describe('normalizeVendorFlags', () => {
  it('maps checkbox "on" to true and absent to false', () => {
    expect(
      normalizeVendorFlags({ approvedStatus: 'on', featured: null, sponsored: undefined }),
    ).toEqual({ approvedStatus: true, featured: false, sponsored: false });
  });

  it('maps all flags on', () => {
    expect(
      normalizeVendorFlags({ approvedStatus: 'on', featured: 'on', sponsored: 'on' }),
    ).toEqual({ approvedStatus: true, featured: true, sponsored: true });
  });

  it('treats any non-"on" string as false', () => {
    expect(
      normalizeVendorFlags({ approvedStatus: 'true', featured: '', sponsored: 'off' }),
    ).toEqual({ approvedStatus: false, featured: false, sponsored: false });
  });
});
