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
  const baseClasses = 'block rounded-lg bg-white border shadow-sm p-6 hover:shadow-md transition-shadow duration-200';
  const variantClasses = {
    primary: 'border-blue-200 hover:border-blue-300',
    neutral: 'border-gray-200 hover:border-gray-300',
    warning: 'border-yellow-200 hover:border-yellow-300',
    danger: 'border-red-200 hover:border-red-300',
  };

  return (
    <Link href={href} className={`${baseClasses} ${variantClasses[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {icon && <span className="text-lg">{icon}</span>}
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        {badge && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}