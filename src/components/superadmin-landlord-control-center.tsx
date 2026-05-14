'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { UserStatus } from '@prisma/client';

type LandlordProfile = {
  id: string;
  companyName: string;
  displayName: string;
  _count: { properties: number; units: number };
};

type LandlordUser = {
  id: string;
  email: string;
  name?: string | null;
  fullName?: string | null;
  phone?: string | null;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  ownedLandlords: LandlordProfile[];
};

type ActionResponse = {
  invitationUrl?: string;
  temporaryPassword?: string;
  emailSent?: boolean;
  message?: string;
};

type ModalType = 'invite' | 'confirm' | 'password' | 'subscription' | null;

const statusLabels: Record<UserStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  PENDING_INVITE: { label: 'Pending invite', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  INACTIVE: { label: 'Inactive', className: 'bg-slate-50 text-slate-600 ring-slate-200' },
  SUSPENDED: { label: 'Suspended', className: 'bg-red-50 text-red-700 ring-red-100' },
  INVITED: { label: 'Invited', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  DISABLED: { label: 'Disabled', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

const actionDisplay: Record<string, string> = {
  activate: 'Activate',
  deactivate: 'Deactivate',
  suspend: 'Suspend',
  reset_password: 'Reset password',
  set_temporary_password: 'Set temporary password',
};

function IconActionButton({
  title,
  icon,
  tone = 'neutral',
  onClick,
}: {
  title: string;
  icon: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger' | 'billing';
  onClick: () => void;
}) {
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    good: 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    warning: 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100',
    danger: 'border-red-100 bg-red-50 text-red-700 hover:bg-red-100',
    billing: 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100',
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition ${tones[tone]}`}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children,
  maxWidth = 'max-w-xl',
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className={`w-full ${maxWidth} overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
          </div>
          <button className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function LandlordControlCenter({ landlords }: { landlords: LandlordUser[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedUser, setSelectedUser] = useState<LandlordUser | null>(null);
  const [actionType, setActionType] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [response, setResponse] = useState<ActionResponse | null>(null);
  const [inviteFields, setInviteFields] = useState({ fullName: '', email: '', phone: '', companyName: '', displayName: '' });
  const [tempPassword, setTempPassword] = useState('email');
  const [manualPassword, setManualPassword] = useState('');
  const [subscriptionForm, setSubscriptionForm] = useState({
    isComplimentary: false,
    complimentarySeats: '0',
    trialDays: '14',
    complimentaryReason: '',
    complimentaryUntil: '',
  });

  const visibleLandlords = useMemo(() => {
    return landlords.filter((landlord) => {
      const query = search.trim().toLowerCase();
      if (statusFilter && landlord.status !== statusFilter) return false;
      if (!query) return true;
      const searchText = [landlord.fullName, landlord.name, landlord.email, landlord.phone, landlord.ownedLandlords[0]?.companyName, landlord.ownedLandlords[0]?.displayName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchText.includes(query);
    });
  }, [landlords, search, statusFilter]);

  const metrics = useMemo(() => {
    const active = landlords.filter((landlord) => landlord.status === UserStatus.ACTIVE).length;
    const pending = landlords.filter((landlord) => landlord.status === UserStatus.PENDING_INVITE || landlord.status === UserStatus.INVITED).length;
    const suspended = landlords.filter((landlord) => landlord.status === UserStatus.SUSPENDED).length;
    return { active, pending, suspended };
  }, [landlords]);

  function closeModal() {
    setActiveModal(null);
    setSelectedUser(null);
    setActionType('');
    setResponse(null);
    setTempPassword('email');
    setManualPassword('');
  }

  function openConfirm(landlord: LandlordUser, action: 'activate' | 'deactivate' | 'suspend') {
    setSelectedUser(landlord);
    setActionType(action);
    setActiveModal('confirm');
  }

  function openPassword(landlord: LandlordUser, action: 'reset_password' | 'set_temporary_password') {
    setSelectedUser(landlord);
    setActionType(action);
    setTempPassword(action === 'reset_password' ? 'email' : 'temporary');
    setManualPassword('');
    setActiveModal('password');
  }

  function openSubscription(landlord: LandlordUser) {
    setSelectedUser(landlord);
    setSubscriptionForm({
      isComplimentary: false,
      complimentarySeats: '0',
      trialDays: '14',
      complimentaryReason: '',
      complimentaryUntil: '',
    });
    setActiveModal('subscription');
  }

  async function performAction(payload: Record<string, unknown>) {
    setBusy(true);
    setToast('');
    setResponse(null);

    try {
      const response = await fetch('/api/admin/landlords', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to complete action.');
      setResponse(body);
      setToast(body.message ?? 'Action completed successfully.');
      router.refresh();
      return body;
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Action failed.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmStatus(action: 'activate' | 'deactivate' | 'suspend') {
    if (!selectedUser) return;
    const result = await performAction({ action, targetUserId: selectedUser.id });
    if (result?.ok) closeModal();
  }

  async function handlePasswordAction() {
    if (!selectedUser) return;
    const result = await performAction({
      action: actionType,
      targetUserId: selectedUser.id,
      targetEmail: selectedUser.email,
      method: tempPassword === 'email' ? 'email' : 'temporary_password',
      temporaryPassword: manualPassword || undefined,
    });
    if (result?.ok && !result.temporaryPassword && result.emailSent !== false) closeModal();
  }

  async function handleSubscriptionAccess() {
    if (!selectedUser) return;
    const result = await performAction({
      action: 'update_subscription_access',
      targetUserId: selectedUser.id,
      isComplimentary: subscriptionForm.isComplimentary,
      complimentarySeats: Number(subscriptionForm.complimentarySeats || 0),
      trialDays: subscriptionForm.isComplimentary ? 0 : Number(subscriptionForm.trialDays || 0),
      complimentaryReason: subscriptionForm.complimentaryReason || undefined,
      complimentaryUntil: subscriptionForm.complimentaryUntil || undefined,
    });
    if (result?.ok) closeModal();
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await performAction({
      action: 'invite',
      fullName: inviteFields.fullName,
      email: inviteFields.email,
      phone: inviteFields.phone,
      companyName: inviteFields.companyName,
      displayName: inviteFields.displayName || inviteFields.companyName,
    });
    if (result?.ok) setToast('Invitation created. Copy the invite details below.');
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => setToast('Copied to clipboard.'));
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        {[
          ['Active', metrics.active],
          ['Pending', metrics.pending],
          ['Suspended', metrics.suspended],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-navy"
            placeholder="Search landlord, company, email, phone..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([status, config]) => (
              <option key={status} value={status}>{config.label}</option>
            ))}
          </select>
          <button className="h-9 rounded-lg bg-brand-navy px-4 text-sm font-medium text-white hover:opacity-90" onClick={() => setActiveModal('invite')}>
            Invite landlord
          </button>
        </div>
      </section>

      {toast ? <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">{toast}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-950">Landlord Accounts</h3>
          <p className="text-xs text-slate-500">Quick-action icons keep account tools available without opening a large dropdown.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Landlord</th>
                <th className="px-4 py-2 font-semibold">Workspace</th>
                <th className="px-4 py-2 font-semibold">Inventory</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Activity</th>
                <th className="px-4 py-2 font-semibold text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleLandlords.map((landlord) => {
                const ownerName = landlord.fullName || landlord.name || landlord.email;
                const profile = landlord.ownedLandlords[0];
                const companyName = profile?.companyName || profile?.displayName || 'No workspace yet';
                const propertyCount = profile?._count.properties ?? 0;
                const unitCount = profile?._count.units ?? 0;
                return (
                  <tr key={landlord.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium leading-5 text-slate-950">{ownerName}</div>
                      <div className="text-xs text-slate-500">{landlord.email}</div>
                      {landlord.phone ? <div className="text-xs text-slate-400">{landlord.phone}</div> : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-800">{companyName}</div>
                      <div className="text-xs text-slate-500">{landlord.ownedLandlords.length} workspace{landlord.ownedLandlords.length === 1 ? '' : 's'}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-600">
                      <span className="font-semibold text-slate-900">{propertyCount}</span> properties
                      <span className="mx-2 text-slate-300">/</span>
                      <span className="font-semibold text-slate-900">{unitCount}</span> units
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusLabels[landlord.status]?.className || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                        {statusLabels[landlord.status]?.label || landlord.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-500">
                      <div>Last login: {landlord.lastLoginAt ? new Date(landlord.lastLoginAt).toLocaleDateString() : '—'}</div>
                      <div>Created: {new Date(landlord.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex justify-end gap-1.5">
                        <IconActionButton title="Reset password" icon="🔑" onClick={() => openPassword(landlord, 'reset_password')} />
                        <IconActionButton title="Set temporary password" icon="✨" onClick={() => openPassword(landlord, 'set_temporary_password')} />
                        <IconActionButton title="Subscription access" icon="💳" tone="billing" onClick={() => openSubscription(landlord)} />
                        {landlord.status !== UserStatus.ACTIVE ? (
                          <IconActionButton title="Activate account" icon="✓" tone="good" onClick={() => openConfirm(landlord, 'activate')} />
                        ) : (
                          <IconActionButton title="Deactivate account" icon="⏸" tone="warning" onClick={() => openConfirm(landlord, 'deactivate')} />
                        )}
                        {landlord.status !== UserStatus.SUSPENDED ? (
                          <IconActionButton title="Suspend account" icon="!" tone="danger" onClick={() => openConfirm(landlord, 'suspend')} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleLandlords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No landlords match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {activeModal === 'invite' ? (
        <ModalShell title="Invite landlord" description="Create a pending landlord account with optional onboarding details." onClose={closeModal} maxWidth="max-w-2xl">
          <form className="grid gap-3" onSubmit={handleInvite}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">Full name
                <input required value={inviteFields.fullName} onChange={(event) => setInviteFields({ ...inviteFields, fullName: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600">Email
                <input required type="email" value={inviteFields.email} onChange={(event) => setInviteFields({ ...inviteFields, email: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600">Phone
                <input value={inviteFields.phone} onChange={(event) => setInviteFields({ ...inviteFields, phone: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600">Company / property group
                <input required value={inviteFields.companyName} onChange={(event) => setInviteFields({ ...inviteFields, companyName: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600 md:col-span-2">Display name
                <input value={inviteFields.displayName} onChange={(event) => setInviteFields({ ...inviteFields, displayName: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="h-9 rounded-lg border border-slate-200 px-4 text-sm" onClick={closeModal}>Cancel</button>
              <button type="submit" disabled={busy} className="h-9 rounded-lg bg-brand-navy px-4 text-sm font-medium text-white disabled:opacity-60">{busy ? 'Sending...' : 'Create invite'}</button>
            </div>
          </form>

          {response ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">Invite details</p>
              {response.invitationUrl ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border bg-white p-3">
                  <span className="truncate text-xs">{response.invitationUrl}</span>
                  <button type="button" className="text-xs font-medium text-brand-navy" onClick={() => copyToClipboard(response.invitationUrl!)}>Copy</button>
                </div>
              ) : null}
              {response.temporaryPassword ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border bg-white p-3">
                  <span className="truncate text-xs">{response.temporaryPassword}</span>
                  <button type="button" className="text-xs font-medium text-brand-navy" onClick={() => copyToClipboard(response.temporaryPassword!)}>Copy</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </ModalShell>
      ) : null}

      {activeModal === 'password' && selectedUser ? (
        <ModalShell title={actionType === 'reset_password' ? 'Reset password' : 'Set temporary password'} description={`Apply a password action for ${selectedUser.email}.`} onClose={closeModal}>
          <div className="space-y-4">
            {actionType === 'reset_password' ? (
              <label className="text-xs font-medium text-slate-600">Delivery method
                <select className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" value={tempPassword} onChange={(event) => setTempPassword(event.target.value)}>
                  <option value="email">Send password recovery email</option>
                  <option value="temporary">Generate temporary password</option>
                </select>
              </label>
            ) : null}

            {(actionType === 'set_temporary_password' || tempPassword === 'temporary') ? (
              <label className="text-xs font-medium text-slate-600">Manual temporary password
                <input className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Leave blank to generate one" value={manualPassword} onChange={(event) => setManualPassword(event.target.value)} />
              </label>
            ) : null}

            <div className="flex justify-end gap-2">
              <button type="button" className="h-9 rounded-lg border border-slate-200 px-4 text-sm" onClick={closeModal}>Cancel</button>
              <button type="button" disabled={busy} className="h-9 rounded-lg bg-brand-navy px-4 text-sm font-medium text-white disabled:opacity-60" onClick={handlePasswordAction}>
                {busy ? 'Saving...' : actionType === 'reset_password' ? 'Reset password' : 'Set password'}
              </button>
            </div>

            {response?.temporaryPassword ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase text-slate-500">Temporary password</p>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border bg-white p-3">
                  <span className="truncate text-xs">{response.temporaryPassword}</span>
                  <button type="button" className="text-xs font-medium text-brand-navy" onClick={() => copyToClipboard(response.temporaryPassword!)}>Copy</button>
                </div>
              </div>
            ) : null}
          </div>
        </ModalShell>
      ) : null}

      {activeModal === 'subscription' && selectedUser ? (
        <ModalShell title="Subscription access" description={`Set paid, trial, or complimentary access for ${selectedUser.email}.`} onClose={closeModal}>
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={subscriptionForm.isComplimentary} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, isComplimentary: event.target.checked })} />
              <span>
                <span className="block font-medium text-slate-950">Complimentary account</span>
                <span className="text-xs text-slate-500">No SaaS invoice or Fygaro payment link should be generated while complimentary.</span>
              </span>
            </label>

            {subscriptionForm.isComplimentary ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">Complimentary seats
                  <input type="number" min="0" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" value={subscriptionForm.complimentarySeats} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, complimentarySeats: event.target.value })} />
                </label>
                <label className="text-xs font-medium text-slate-600">Complimentary until
                  <input type="date" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" value={subscriptionForm.complimentaryUntil} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, complimentaryUntil: event.target.value })} />
                </label>
                <label className="text-xs font-medium text-slate-600 md:col-span-2">Reason
                  <input className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" value={subscriptionForm.complimentaryReason} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, complimentaryReason: event.target.value })} placeholder="Example: Founding landlord / pilot account" />
                </label>
              </div>
            ) : (
              <label className="text-xs font-medium text-slate-600">Free trial days
                <input type="number" min="0" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" value={subscriptionForm.trialDays} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, trialDays: event.target.value })} />
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="h-9 rounded-lg border border-slate-200 px-4 text-sm" onClick={closeModal}>Cancel</button>
              <button type="button" disabled={busy} className="h-9 rounded-lg bg-brand-navy px-4 text-sm font-medium text-white disabled:opacity-60" onClick={handleSubscriptionAccess}>
                {busy ? 'Saving...' : 'Save access'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {activeModal === 'confirm' && selectedUser ? (
        <ModalShell title={`Confirm ${actionDisplay[actionType] || 'action'}`} description={`Apply this account action to ${selectedUser.email}.`} onClose={closeModal} maxWidth="max-w-md">
          <p className="text-sm text-slate-600">Are you sure you want to {actionDisplay[actionType]?.toLowerCase()} this landlord account?</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="h-9 rounded-lg border border-slate-200 px-4 text-sm" onClick={closeModal}>Cancel</button>
            <button type="button" disabled={busy} className="h-9 rounded-lg bg-brand-navy px-4 text-sm font-medium text-white disabled:opacity-60" onClick={() => handleConfirmStatus(actionType as 'activate' | 'deactivate' | 'suspend')}>
              {busy ? 'Working...' : actionDisplay[actionType] || 'Confirm'}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
