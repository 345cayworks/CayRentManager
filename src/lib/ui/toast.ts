export type ToastTone = 'success' | 'error';

export type ParsedToast = {
  tone: ToastTone;
  message: string;
} | null;

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function readParam(
  params: SearchParamsLike,
  key: string,
): string | undefined {
  if (typeof (params as URLSearchParams).get === 'function') {
    return (params as URLSearchParams).get(key) ?? undefined;
  }
  const value = (params as Record<string, string | string[] | undefined>)[key];
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

/**
 * Derives a toast banner from `?notice=` / `?error=` search params.
 * Error wins over notice when both are present. Returns null when neither
 * is set or when the value is empty/whitespace.
 */
export function buildToastFromSearchParams(
  params: SearchParamsLike,
): ParsedToast {
  const error = readParam(params, 'error')?.trim();
  if (error) {
    return { tone: 'error', message: error };
  }
  const notice = readParam(params, 'notice')?.trim();
  if (notice) {
    return { tone: 'success', message: notice };
  }
  return null;
}
