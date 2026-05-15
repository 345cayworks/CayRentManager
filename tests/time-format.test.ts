import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatMonthLabel,
  formatTime,
  isSupportedCurrency,
  isSupportedTimezone,
} from '@/lib/time/format';

const SAMPLE = new Date('2026-05-15T10:00:00Z');

describe('formatDate', () => {
  it('formats a Date in the requested timezone', () => {
    expect(formatDate(SAMPLE, 'America/Cayman')).toBe('May 15, 2026');
  });

  it('accepts ISO strings', () => {
    expect(formatDate('2026-05-15T10:00:00Z', 'America/Cayman')).toBe('May 15, 2026');
  });

  it('returns em-dash for null/undefined', () => {
    expect(formatDate(null, 'America/Cayman')).toBe('—');
    expect(formatDate(undefined, 'America/Cayman')).toBe('—');
  });

  it('returns em-dash for invalid dates', () => {
    expect(formatDate('not-a-date', 'America/Cayman')).toBe('—');
    expect(formatDate(new Date('invalid'), 'America/Cayman')).toBe('—');
  });

  it('respects the requested timezone', () => {
    // 2026-05-15T01:00:00Z is 2026-05-14 in Cayman (UTC-5)
    expect(formatDate('2026-05-15T01:00:00Z', 'America/Cayman')).toBe('May 14, 2026');
    expect(formatDate('2026-05-15T01:00:00Z', 'UTC')).toBe('May 15, 2026');
  });
});

describe('formatDateTime', () => {
  it('formats date and time in the requested timezone', () => {
    expect(formatDateTime(SAMPLE, 'America/Cayman')).toBe('May 15, 2026, 5:00 AM');
  });

  it('returns em-dash for null', () => {
    expect(formatDateTime(null, 'America/Cayman')).toBe('—');
  });
});

describe('formatTime', () => {
  it('formats just the time portion', () => {
    expect(formatTime(SAMPLE, 'America/Cayman')).toBe('5:00 AM');
  });
});

describe('formatMonthLabel', () => {
  it('returns a short-month + year label', () => {
    expect(formatMonthLabel(SAMPLE, 'America/Cayman')).toBe('May 2026');
  });
});

describe('isSupportedTimezone', () => {
  it('returns true for known IANA zones', () => {
    expect(isSupportedTimezone('America/Cayman')).toBe(true);
    expect(isSupportedTimezone('Europe/London')).toBe(true);
    expect(isSupportedTimezone('UTC')).toBe(true);
  });

  it('returns false for unknown values', () => {
    expect(isSupportedTimezone('Foo/Bar')).toBe(false);
    expect(isSupportedTimezone('')).toBe(false);
  });
});

describe('isSupportedCurrency', () => {
  it('returns true for known ISO codes', () => {
    expect(isSupportedCurrency('KYD')).toBe(true);
    expect(isSupportedCurrency('USD')).toBe(true);
  });

  it('returns false for unknown codes', () => {
    expect(isSupportedCurrency('XXX')).toBe(false);
    expect(isSupportedCurrency('')).toBe(false);
  });
});
