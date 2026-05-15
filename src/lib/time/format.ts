const DEFAULT_LOCALE = 'en-US';

export function formatDate(
  value: Date | string | null | undefined,
  timezone: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { ...options, timeZone: timezone }).format(date);
}

export function formatDateTime(
  value: Date | string | null | undefined,
  timezone: string,
): string {
  return formatDate(value, timezone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTime(
  value: Date | string | null | undefined,
  timezone: string,
): string {
  return formatDate(value, timezone, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatMonthLabel(value: Date, timezone: string): string {
  return formatDate(value, timezone, { month: 'short', year: 'numeric' });
}

export function formatShortMonth(value: Date, timezone: string): string {
  return formatDate(value, timezone, { month: 'short' });
}

/**
 * Returns IANA timezones we expose in pickers. Curated to keep the dropdown
 * short; users can paste a custom value via the manual override field if
 * we ever expose one. For now the picker is the source of truth.
 */
export const SUPPORTED_TIMEZONES = [
  { value: 'America/Cayman', label: 'Cayman Islands (EST, no DST)' },
  { value: 'America/New_York', label: 'US Eastern (New York)' },
  { value: 'America/Chicago', label: 'US Central (Chicago)' },
  { value: 'America/Denver', label: 'US Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'US Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)' },
  { value: 'America/Anchorage', label: 'US Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'US Hawaii (Honolulu)' },
  { value: 'America/Toronto', label: 'Canada Eastern (Toronto)' },
  { value: 'America/Vancouver', label: 'Canada Pacific (Vancouver)' },
  { value: 'America/Mexico_City', label: 'Mexico (Mexico City)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Lima', label: 'Peru (Lima)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Sao_Paulo', label: 'Brazil (São Paulo)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'Atlantic/Bermuda', label: 'Bermuda' },
  { value: 'Europe/London', label: 'UK (London)' },
  { value: 'Europe/Dublin', label: 'Ireland (Dublin)' },
  { value: 'Europe/Paris', label: 'Central Europe (Paris)' },
  { value: 'Europe/Berlin', label: 'Central Europe (Berlin)' },
  { value: 'Europe/Madrid', label: 'Spain (Madrid)' },
  { value: 'Africa/Johannesburg', label: 'South Africa (Johannesburg)' },
  { value: 'Asia/Dubai', label: 'UAE (Dubai)' },
  { value: 'Asia/Kolkata', label: 'India (Kolkata)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Tokyo', label: 'Japan (Tokyo)' },
  { value: 'Australia/Sydney', label: 'Australia Eastern (Sydney)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (Auckland)' },
  { value: 'UTC', label: 'UTC' },
];

export const SUPPORTED_CURRENCIES = [
  { value: 'KYD', label: 'KYD — Cayman Islands Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'JMD', label: 'JMD — Jamaican Dollar' },
  { value: 'BSD', label: 'BSD — Bahamian Dollar' },
  { value: 'BMD', label: 'BMD — Bermudian Dollar' },
];

export function isSupportedTimezone(value: string): boolean {
  return SUPPORTED_TIMEZONES.some((t) => t.value === value);
}

export function isSupportedCurrency(value: string): boolean {
  return SUPPORTED_CURRENCIES.some((c) => c.value === value);
}
