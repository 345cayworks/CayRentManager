import { Shell } from '@/components/shell';
import { ChangePasswordForm } from '@/components/change-password-form';
import { requireAuthAllowPasswordChange } from '@/lib/auth/guards';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireAuthAllowPasswordChange();
  const redirectTo = user.role === UserRole.SUPERADMIN ? '/admin' : '/dashboard';

  return (
    <Shell title="Change password">
      <ChangePasswordForm redirectTo={redirectTo} />
    </Shell>
  );
}
