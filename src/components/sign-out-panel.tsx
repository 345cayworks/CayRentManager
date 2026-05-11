'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UserRole } from '@prisma/client';
import { logout } from '@/lib/netlify/identity-client';

interface SignOutPanelProps {
  email: string;
  role: UserRole;
  name?: string | null;
}

function getRoleDisplay(role: UserRole): string {
  const roleMap: Record<UserRole, string> = {
    SUPERADMIN: 'Superadmin',
    LANDLORD: 'Landlord',
    TENANT: 'Tenant',
    PROPERTY_MANAGER: 'Property Manager',
    ACCOUNTANT: 'Accountant',
    VENDOR: 'Vendor',
    MAINTENANCE_PROVIDER: 'Maintenance Provider',
    CONCIERGE_AGENT: 'Concierge Agent',
    GUEST: 'Guest',
  };

  return roleMap[role] || role;
}

export function SignOutPanel({ email, role, name }: SignOutPanelProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);

    try {
      try {
        await logout();
      } catch (err) {
        console.warn('Netlify logout failed, continuing with app logout:', err);
      }

      const response = await fetch('/api/identity/logout', { method: 'POST' });

      if (!response.ok) {
        console.warn('App logout returned status:', response.status);
      }

      router.refresh();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      router.push('/login');
    }
  };

  return (
    <div className="border-t border-white/20 pt-4 mt-auto">
      <div className="text-xs text-white/70 space-y-1 mb-3">
        <p className="font-medium text-white/80">Signed in as</p>

        <p className="truncate" title={email}>
          {email}
        </p>

        <p className="text-white/60">{getRoleDisplay(role)}</p>

        {name && (
          <p className="text-white/60 truncate" title={name}>
            {name}
          </p>
        )}
      </div>

      <button
        onClick={handleSignOut}
        disabled={isLoading}
        className="w-full px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20 hover:border-white/30"
      >
        {isLoading ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  );
}
