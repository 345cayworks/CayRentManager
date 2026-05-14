import Link from 'next/link';
import { ReactNode } from 'react';

interface AdminActionButtonProps {
  href: string;
  title: string;
  description: string;
  badge?: string | number;
  icon?: ReactNode;
  variant?: 'primary' | 'neutral' | 'warning' | 'danger';
}

export function AdminActionButton({
  href,
  title,
  description,
  badge,
  icon,
  variant = 'neutral',
}: AdminActionButtonProps) {
  const baseClasses = 'group block rounded-xl bg-white border p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200';
  const variantClasses = {
    primary: 'border-blue-100 hover:border-blue-300',
    neutral: 'border-slate-100 hover:border-slate-300',
    warning: 'border-amber-100 hover:border-amber-300',
    danger: 'border-red-100 hover:border-red-300',
  };

  return (
    <Link href={href} className={`${baseClasses} ${variantClasses[variant]}`}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-base ring-1 ring-slate-100 group-hover:bg-slate-100">
            {icon}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-950">{title}</h3>
            {badge !== undefined && badge !== null ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
    </Link>
  );
}