'use client';

import { useState } from 'react';
import type { ParsedToast } from '@/lib/ui/toast';

export function Toast({ toast }: { toast: NonNullable<ParsedToast> }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const isError = toast.tone === 'error';
  const palette = isError
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div
      role="status"
      className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${palette}`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="shrink-0 rounded px-2 text-xs font-semibold opacity-70 hover:opacity-100"
        onClick={() => setOpen(false)}
      >
        Dismiss
      </button>
    </div>
  );
}
