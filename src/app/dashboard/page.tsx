import { redirect } from 'next/navigation';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';

export default async function DashboardRedirectPage() {
  await getCurrentLandlordWorkspace();
  redirect('/leases');
}
