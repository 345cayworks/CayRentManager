/**
 * CSV utility functions with security hardening
 */

/**
 * Safely escape a CSV cell value to prevent:
 * - Formula injection attacks (=, +, -, @ prefixes)
 * - Comma separation issues
 * - Quote escaping issues
 * - Newline issues
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '';

  const str = String(value);

  // Formula injection protection: prefix dangerous characters with single quote
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    return `'${str.replace(/"/g, '""')}`;
  }

  // If the value contains commas, quotes, or newlines, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generate a CSV row from an array of values
 */
export function createCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsvCell).join(',');
}

/**
 * Generate a complete CSV string from headers and rows
 */
export function createCsvContent(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const csvLines = [
    createCsvRow(headers),
    ...rows.map(createCsvRow)
  ];

  return csvLines.join('\n');
}

/**
 * Generate safe filename for CSV export
 * - Only allows alphanumeric, hyphens, underscores
 * - Limits length
 * - Adds timestamp for uniqueness
 */
export function createSafeCsvFilename(baseName: string, timestamp?: Date): string {
  const safeBase = baseName
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .substring(0, 50);

  const ts = timestamp || new Date();
  const timestampStr = ts.toISOString().split('T')[0]; // YYYY-MM-DD format

  return `${safeBase}_${timestampStr}.csv`;
}