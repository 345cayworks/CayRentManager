'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildToastFromSearchParams } from '@/lib/ui/toast';
import { Toast } from '@/components/ui/toast';

function ToasterInner() {
  const searchParams = useSearchParams();
  const toast = buildToastFromSearchParams(searchParams);
  if (!toast) return null;
  return <Toast toast={toast} />;
}

/**
 * Mounts once (e.g. inside Shell). Reads `?notice=` / `?error=` from the
 * URL and renders a dismissible banner. Wrapped in Suspense because
 * useSearchParams suspends during static rendering.
 */
export function Toaster() {
  return (
    <Suspense fallback={null}>
      <ToasterInner />
    </Suspense>
  );
}
