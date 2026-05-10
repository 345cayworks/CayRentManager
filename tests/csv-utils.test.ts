import { describe, expect, it } from 'vitest';
import { escapeCsvCell, createCsvRow, createCsvContent, createSafeCsvFilename } from '@/lib/utils/csv';

describe('CSV utilities', () => {
  describe('escapeCsvCell', () => {
    it('handles normal text', () => {
      expect(escapeCsvCell('hello world')).toBe('hello world');
      expect(escapeCsvCell('')).toBe('');
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
      expect(escapeCsvCell(123)).toBe('123');
    });

    it('handles comma text', () => {
      expect(escapeCsvCell('hello, world')).toBe('"hello, world"');
    });

    it('handles quote text', () => {
      expect(escapeCsvCell('hello "world"')).toBe('"hello ""world"""');
    });

    it('handles newline text', () => {
      expect(escapeCsvCell('hello\nworld')).toBe('"hello\nworld"');
      expect(escapeCsvCell('hello\r\nworld')).toBe('"hello\r\nworld"');
    });

    it('handles = formula', () => {
      expect(escapeCsvCell('=SUM(A1:A10)')).toBe('\'=SUM(A1:A10)');
    });

    it('handles + formula', () => {
      expect(escapeCsvCell('+A1+B1')).toBe('\'+A1+B1');
    });

    it('handles - formula', () => {
      expect(escapeCsvCell('-A1')).toBe('\'-A1');
    });

    it('handles @ formula', () => {
      expect(escapeCsvCell('@SUM(A1:A10)')).toBe('\'@SUM(A1:A10)');
    });

    it('handles formula with quotes', () => {
      expect(escapeCsvCell('=CONCATENATE("hello","world")')).toBe('\'=CONCATENATE(""hello"",""world"")');
    });
  });

  describe('createCsvRow', () => {
    it('creates CSV row from values', () => {
      expect(createCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
      expect(createCsvRow(['hello, world', 'normal', '=formula'])).toBe('"hello, world",normal,\'=formula');
    });
  });

  describe('createCsvContent', () => {
    it('creates CSV content from headers and rows', () => {
      const headers = ['Name', 'Age', 'Formula'];
      const rows = [
        ['John', 25, '=A1+B1'],
        ['Jane, Doe', 30, '+C1']
      ];

      const expected = 'Name,Age,Formula\nJohn,25,\'=A1+B1\n"Jane, Doe",30,\'+C1';
      expect(createCsvContent(headers, rows)).toBe(expected);
    });
  });

  describe('createSafeCsvFilename', () => {
    it('creates safe filenames', () => {
      const date = new Date('2026-05-10');
      expect(createSafeCsvFilename('payments', date)).toBe('payments_2026-05-10.csv');
      expect(createSafeCsvFilename('my-export', date)).toBe('my-export_2026-05-10.csv');
    });

    it('sanitizes unsafe characters', () => {
      const date = new Date('2026-05-10');
      expect(createSafeCsvFilename('pay/ments.csv', date)).toBe('pay_ments_csv_2026-05-10.csv');
      expect(createSafeCsvFilename('payments with spaces', date)).toBe('payments_with_spaces_2026-05-10.csv');
    });

    it('limits length', () => {
      const date = new Date('2026-05-10');
      const longName = 'a'.repeat(60);
      expect(createSafeCsvFilename(longName, date)).toBe('a'.repeat(50) + '_2026-05-10.csv');
    });
  });
});