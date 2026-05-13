import Link from 'next/link';
import type { ReactNode } from 'react';

const baseClass =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed';

type Props = {
  icon?: ReactNode;
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export function SuperAdminActionButton({
  icon,
  children,
  href,
  onClick,
  disabled,
  className = '',
}: Props) {
  const content = (
    <>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${baseClass} ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${className}`}
    >
      {content}
    </button>
  );
}

export const superAdminActionButtonClass = baseClass;
