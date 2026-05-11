import { describe, expect, it } from 'vitest';
import {
  calculatePaymentBalance,
  calculatePaymentStatus,
  validatePaymentDates,
} from '@/lib/validation/payments';

describe('payment validation helpers', () => {
  it('calculates a zero balance for fully paid invoices', () => {
    expect(calculatePaymentBalance(1000, 1000)).toBe(0);
  });

  it('calculates a remaining balance for partial payments', () => {
    expect(calculatePaymentBalance(1000, 300)).toBe(700);
  });

  it('returns PENDING when no payment exists', () => {
    expect(calculatePaymentStatus(1000, 0)).toBe('PENDING');
  });

  it('returns PARTIAL when partially paid', () => {
    expect(calculatePaymentStatus(1000, 500)).toBe('PARTIAL');
  });

  it('returns PAID when fully paid', () => {
    expect(calculatePaymentStatus(1000, 1000)).toBe('PAID');
  });

  it('accepts valid payment dates', () => {
    expect(validatePaymentDates(new Date('2026-01-01'), new Date('2026-01-05'))).toBe(true);
  });

  it('throws on invalid dates', () => {
    expect(() => validatePaymentDates(new Date('invalid'), new Date())).toThrow();
  });
});
