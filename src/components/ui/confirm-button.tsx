'use client';

import type { ReactNode } from 'react';

/**
 * A submit button that requires a window.confirm() before allowing its
 * enclosing form to submit. Progressive enhancement: if JS is disabled the
 * onClick never fires and the button behaves as a normal submit button.
 */
export function ConfirmButton({
  message,
  children,
  className,
  name,
  value,
}: {
  message: string;
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
