'use client';

import { FormEvent, useMemo, useState } from 'react';
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

const statusLabels: Record<UserStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-emerald-100 text-emerald-700' },
  PENDING_INVITE: { label: 'Pending invite', className: 'bg-amber-100 text-amber-700' },
  INACTIVE: { label: 'Inactive', className: 'bg-slate-100 text-slate-700' },
  SUSPENDED: { label: 'Suspended', className: 'bg-red-100 text-red-700' },
  INVITED: { label: 'Invited', className: 'bg-amber-100 text-amber-700' },
  DISABLED: { label: 'Disabled', className: 'bg-slate-500 text-white' },
};

const actionDisplay: Record<string, string> = {
  activate: 'Activate',
  deactivate: 'Deactivate',
  suspend: 'Suspend',
  reset_password: 'Reset password',
  set_temporary_password: 'Set temporary password',
};

export function LandlordControlCenter({ landlords }: { landlords: LandlordUser[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeModal, setActiveModal] = useState<'invite' | 'confirm' | 'password' | null>(null);
  const [selectedUser, setSelectedUser] = useState<LandlordUser | null>(null);
  const [actionType, setActionType] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [response, setResponse] = useState<ActionResponse | null>(null);
  const [inviteFields, setInviteFields] = useState({ fullName: '', email: '', phone: '', companyName: '', displayName: '' });
  const [tempPassword, setTempPassword] = useState('');
  const [manualPassword, setManualPassword] = useState('');

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

  function closeModal() {
    setActiveModal(null);
    setSelectedUser(null);
    setActionType('');
    setResponse(null);
    setTempPassword('');
    setManualPassword('');
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
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmStatus(action: 'activate' | 'deactivate' | 'suspend') {
    if (!selectedUser) return;
    await performAction({ action, targetUserId: selectedUser.id });
    if (!busy) closeModal();
  }

  async function handleResetPassword() {
    if (!selectedUser) return;
    await performAction({ action: 'reset_password', targetUserId: selectedUser.id, targetEmail: selectedUser.email, method: tempPassword === 'email' ? 'email' : 'temporary_password', temporaryPassword: manualPassword || undefined });
    if (!busy) closeModal();
  }

  async function handleSetTemporaryPassword() {
    if (!selectedUser) return;
    await performAction({ action: 'set_temporary_password', targetUserId: selectedUser.id, temporaryPassword: manualPassword || undefined });
    if (!busy) closeModal();
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setToast('');
    setResponse(null);
    try {
      const response = await fetch('/api/admin/landlords', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          fullName: inviteFields.fullName,
          email: inviteFields.email,
          phone: inviteFields.phone,
          companyName: inviteFields.companyName,
          displayName: inviteFields.displayName || inviteFields.companyName,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to invite landlord.');
      setResponse(body);
      setToast('Invitation created. Copy the invite details below.');
      router.refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not invite landlord.');
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => setToast('Copied to clipboard.'));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border rounded px-3 py-2"
            placeholder="Search landlords..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="border rounded px-3 py-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([status, config]) => (
              <option key={status} value={status}>{config.label}</option>
            ))}
          </select>
        </div>
        <button className="rounded bg-brand-navy text-white px-4 py-2" onClick={() => setActiveModal('invite')}>
          Invite landlord
        </button>
      </div>

      {toast ? <div className="rounded-lg bg-slate-100 border px-4 py-3 text-sm text-slate-700">{toast}</div> : null}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Company / group</th>
              <th className="px-4 py-3">Properties</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibleLandlords.map((landlord) => {
              const ownerName = landlord.fullName || landlord.name || landlord.email;
              const profile = landlord.ownedLandlords[0];
              const companyName = profile?.companyName || profile?.displayName || '-';
              return (
                <tr key={landlord.id}>
                  <td className="px-4 py-3 align-top">{ownerName}</td>
                  <td className="px-4 py-3 align-top">{landlord.email}</td>
                  <td className="px-4 py-3 align-top">{landlord.phone || '-'}</td>
                  <td className="px-4 py-3 align-top">{companyName}</td>
                  <td className="px-4 py-3 align-top">{profile?._count.properties ?? 0}</td>
                  <td className="px-4 py-3 align-top">{profile?._count.units ?? 0}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusLabels[landlord.status]?.className || 'bg-slate-100 text-slate-700'}`}>
                      {statusLabels[landlord.status]?.label || landlord.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">{landlord.lastLoginAt ? new Date(landlord.lastLoginAt).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3 align-top">{new Date(landlord.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 align-top">
                    <details className="relative">
                      <summary className="cursor-pointer rounded border px-3 py-1 text-sm">Actions</summary>
                      <div className="absolute right-0 z-10 mt-2 w-52 rounded-xl border bg-white p-2 shadow-lg">
                        <button
                          className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => {
                            setSelectedUser(landlord);
                            setActionType('reset_password');
                            setTempPassword('email');
                            setActiveModal('password');
                          }}
                        >
                          Reset password
                        </button>
                        <button
                          className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => {
                            setSelectedUser(landlord);
                            setActionType('set_temporary_password');
                            setManualPassword('');
                            setActiveModal('password');
                          }}
                        >
                          Temporary password
                        </button>
                        {landlord.status !== 'ACTIVE' ? (
                          <button
                            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setSelectedUser(landlord);
                              setActionType('activate');
                              setActiveModal('confirm');
                            }}
                          >
                            Activate
                          </button>
                        ) : null}
                        {landlord.status === 'ACTIVE' ? (
                          <button
                            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setSelectedUser(landlord);
                              setActionType('deactivate');
                              setActiveModal('confirm');
                            }}
                          >
                            Deactivate
                          </button>
                        ) : null}
                        {landlord.status !== 'SUSPENDED' ? (
                          <button
                            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setSelectedUser(landlord);
                              setActionType('suspend');
                              setActiveModal('confirm');
                            }}
                          >
                            Suspend
                          </button>
                        ) : null}
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
            {visibleLandlords.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                  No landlords match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {activeModal === 'invite' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Invite landlord</h2>
                <p className="text-sm text-slate-500">Create a pending landlord account with optional onboarding details.</p>
              </div>
              <button className="rounded-full px-3 py-2 text-slate-500 hover:bg-slate-100" onClick={closeModal}>Close</button>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleInvite}>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-sm font-medium">Full name</label>
                <input
                  required
                  value={inviteFields.fullName}
                  onChange={(event) => setInviteFields({ ...inviteFields, fullName: event.target.value })}
                  className="border rounded px-3 py-2"
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  required
                  type="email"
                  value={inviteFields.email}
                  onChange={(event) => setInviteFields({ ...inviteFields, email: event.target.value })}
                  className="border rounded px-3 py-2"
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-sm font-medium">Phone</label>
                <input
                  value={inviteFields.phone}
                  onChange={(event) => setInviteFields({ ...inviteFields, phone: event.target.value })}
                  className="border rounded px-3 py-2"
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-sm font-medium">Company / property group</label>
                <input
                  required
                  value={inviteFields.companyName}
                  onChange={(event) => setInviteFields({ ...inviteFields, companyName: event.target.value })}
                  className="border rounded px-3 py-2"
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-sm font-medium">Display name</label>
                <input
                  value={inviteFields.displayName}
                  onChange={(event) => setInviteFields({ ...inviteFields, displayName: event.target.value })}
                  className="border rounded px-3 py-2"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button type="button" className="rounded border px-4 py-2" onClick={closeModal}>Cancel</button>
                <button type="submit" disabled={busy} className="rounded bg-brand-navy text-white px-4 py-2 disabled:opacity-60">
                  {busy ? 'Sending...' : 'Create invite'}
                </button>
              </div>
            </form>

            {response ? (
              <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">Invite details</p>
                {response.invitationUrl ? (
                  <div className="mt-2">
                    <p className="text-xs uppercase text-slate-500">Registration link</p>
                    <div className="mt-2 flex items-center justify-between gap-2 rounded border bg-white p-3">
                      <span className="truncate">{response.invitationUrl}</span>
                      <button type="button" className="text-sm text-brand-navy" onClick={() => copyToClipboard(response.invitationUrl!)}>
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}
                {response.temporaryPassword ? (
                  <div className="mt-4">
                    <p className="text-xs uppercase text-slate-500">Temporary password</p>
                    <div className="mt-2 flex items-center justify-between gap-2 rounded border bg-white p-3">
                      <span className="truncate">{response.temporaryPassword}</span>
                      <button type="button" className="text-sm text-brand-navy" onClick={() => copyToClipboard(response.temporaryPassword!)}>
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeModal === 'password' && selectedUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{actionType === 'reset_password' ? 'Reset password' : 'Set temporary password'}</h2>
                <p className="text-sm text-slate-500">Apply a password action for {selectedUser.email}.</p>
              </div>
              <button className="rounded-full px-3 py-2 text-slate-500 hover:bg-slate-100" onClick={closeModal}>Close</button>
            </div>
            <div className="mt-6 space-y-4">
              {actionType === 'reset_password' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Delivery method</label>
                    <select className="mt-2 w-full border rounded px-3 py-2" value={tempPassword} onChange={(event) => setTempPassword(event.target.value)}>
                      <option value="email">Send password recovery email</option>
                      <option value="temporary">Generate temporary password</option>
                    </select>
                  </div>
                  {tempPassword === 'temporary' ? (
                    <div>
                      <label className="text-sm font-medium">Manual temporary password</label>
                      <input
                        className="mt-2 w-full border rounded px-3 py-2"
                        placeholder="Leave blank to generate one"
                        value={manualPassword}
                        onChange={(event) => setManualPassword(event.target.value)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium">Temporary password</label>
                  <input
                    className="mt-2 w-full border rounded px-3 py-2"
                    placeholder="Leave blank to generate one"
                    value={manualPassword}
                    onChange={(event) => setManualPassword(event.target.value)}
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" className="rounded border px-4 py-2" onClick={closeModal}>Cancel</button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded bg-brand-navy text-white px-4 py-2 disabled:opacity-60"
                  onClick={actionType === 'reset_password' ? handleResetPassword : handleSetTemporaryPassword}
                >
                  {busy ? 'Saving...' : actionType === 'reset_password' ? 'Reset password' : 'Set temporary password'}
                </button>
              </div>
              {response ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  {response.emailSent === false ? (
                    <p>Unable to send reset email automatically; copy the reset instructions manually.</p>
                  ) : null}
                  {response.temporaryPassword ? (
                    <div className="mt-2">
                      <p className="text-xs uppercase text-slate-500">Temporary password</p>
                      <div className="mt-2 flex items-center justify-between gap-2 rounded border bg-white p-3">
                        <span className="truncate">{response.temporaryPassword}</span>
                        <button type="button" className="text-sm text-brand-navy" onClick={() => copyToClipboard(response.temporaryPassword!)}>
                          Copy
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeModal === 'confirm' && selectedUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Confirm {actionDisplay[actionType] || 'action'}</h2>
            <p className="mt-3 text-sm text-slate-600">Are you sure you want to {actionDisplay[actionType]?.toLowerCase()} the landlord account for {selectedUser.email}?</p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" className="rounded border px-4 py-2" onClick={closeModal}>Cancel</button>
              <button
                type="button"
                disabled={busy}
                className="rounded bg-brand-navy text-white px-4 py-2 disabled:opacity-60"
                onClick={() => handleConfirmStatus(actionType as 'activate' | 'deactivate' | 'suspend')}
              >
                {busy ? 'Working...' : actionDisplay[actionType] || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
