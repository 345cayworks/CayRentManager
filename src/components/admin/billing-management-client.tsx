'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  convertToPaidAction,
  createSubscriptionInvoiceAction,
  extendComplimentaryAction,
  extendSubscriptionAction,
  makeComplimentaryAction,
  markInvoicePaidManuallyAction,
  regenerateFygaroLinkAction,
  waiveInvoiceAction,
} from '@/server/billing-actions';

type BillingRow = {
  subscriptionId: string;
  landlordName: string;
  planName: string;
  amountLabel: string;
  statusLabel: string;
  statusClassName: string;
  nextInvoiceLabel: string;
  currentPeriodEndLabel: string;
  complimentaryUntilLabel: string;
  latestInvoiceId: string | null;
  latestInvoiceNumber: string | null;
  latestInvoiceStatus: string | null;
  fygaroPaymentUrl: string | null;
  complimentary: boolean;
};

type ModalType =
  | 'createInvoice'
  | 'regenerateLink'
  | 'markPaid'
  | 'waiveInvoice'
  | 'extendBilling'
  | 'makeComplimentary'
  | 'extendComplimentary'
  | 'convertToPaid'
  | null;

interface BillingManagementClientProps {
  rows: BillingRow[];
  activeSubscribers: number;
  complimentaryCount: number;
  monthlyRevenue: number;
  overdueCount: number;
}

function IconActionButton({
  title,
  icon,
  tone = 'neutral',
  onClick,
}: {
  title: string;
  icon: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger' | 'billing' | 'gift';
  onClick: () => void;
}) {
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    good: 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    warning: 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100',
    danger: 'border-red-100 bg-red-50 text-red-700 hover:bg-red-100',
    billing: 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100',
    gift: 'border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100',
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
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ActionModal({
  row,
  modalType,
  onClose,
}: {
  row: BillingRow;
  modalType: ModalType;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');

  async function handleFormSubmit(
    action: (formData: FormData) => Promise<void>,
    buildFormData: (formData: FormData) => void
  ) {
    setBusy(true);
    try {
      const formData = new FormData();
      buildFormData(formData);
      await action(formData);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (modalType === 'createInvoice') {
    return (
      <ModalShell
        title="Create Invoice"
        description="Creates a new invoice for this paid subscription if the account is invoice-eligible."
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(createSubscriptionInvoiceAction, (formData) => {
              formData.set('subscriptionId', row.subscriptionId);
            });
          }}
          className="space-y-4"
        >
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create Invoice'}
          </button>
        </form>
      </ModalShell>
    );
  }

  if (modalType === 'regenerateLink') {
    return (
      <ModalShell
        title="Regenerate Fygaro Link"
        description="Generates a new locked Fygaro payment link for the latest eligible invoice."
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(regenerateFygaroLinkAction, (formData) => {
              formData.set('invoiceId', row.latestInvoiceId || '');
            });
          }}
          className="space-y-4"
        >
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Regenerating...' : 'Regenerate Link'}
          </button>
        </form>
      </ModalShell>
    );
  }

  if (modalType === 'markPaid') {
    return (
      <ModalShell
        title="Mark Invoice Paid"
        description="Records the latest invoice as paid using a manual admin payment event."
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(markInvoicePaidManuallyAction, (formData) => {
              formData.set('invoiceId', row.latestInvoiceId || '');
            });
          }}
          className="space-y-4"
        >
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'Marking...' : 'Mark Paid'}
          </button>
        </form>
      </ModalShell>
    );
  }

  if (modalType === 'waiveInvoice') {
    return (
      <ModalShell
        title="Waive Invoice"
        description="Marks the latest unpaid invoice as waived and removes its payment link."
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(waiveInvoiceAction, (formData) => {
              formData.set('invoiceId', row.latestInvoiceId || '');
            });
          }}
          className="space-y-4"
        >
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? 'Waiving...' : 'Waive Invoice'}
          </button>
        </form>
      </ModalShell>
    );
  }

  if (modalType === 'extendBilling') {
    return (
      <ModalShell
        title="Extend Billing Period 30 Days"
        description="Moves the subscription current period end forward by 30 days. For paid accounts, the next invoice date follows the new period end. It does not collect payment or create a new invoice."
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(extendSubscriptionAction, (formData) => {
              formData.set('subscriptionId', row.subscriptionId);
              formData.set('days', '30');
            });
          }}
          className="space-y-4"
        >
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Extending...' : 'Extend 30 Days'}
          </button>
        </form>
      </ModalShell>
    );
  }

  if (modalType === 'makeComplimentary') {
    return (
      <ModalShell
        title="Make Account Complimentary"
        description="Changes the subscription to complimentary, stops next invoice generation, clears grace-period tracking, and prevents Fygaro payment links while complimentary."
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(makeComplimentaryAction, (formData) => {
              formData.set('subscriptionId', row.subscriptionId);
              if (reason) formData.set('complimentaryReason', reason);
              if (until) formData.set('complimentaryUntil', until);
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              placeholder="Example: Pilot account / founding landlord"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Complimentary Until (optional)
            </label>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {busy ? 'Processing...' : 'Make Complimentary'}
          </button>
        </form>
      </ModalShell>
    );
  }

  if (modalType === 'extendComplimentary') {
    return (
      <ModalShell
        title="Extend Complimentary Access"
        description="Keeps the account complimentary, sets a new complimentary-until date, clears any grace period, and keeps next invoice disabled while complimentary."
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(extendComplimentaryAction, (formData) => {
              formData.set('subscriptionId', row.subscriptionId);
              if (until) formData.set('complimentaryUntil', until);
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Complimentary Until
            </label>
            <input
              type="date"
              required
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !until}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {busy ? 'Extending...' : 'Extend Complimentary'}
          </button>
        </form>
      </ModalShell>
    );
  }

  if (modalType === 'convertToPaid') {
    return (
      <ModalShell
        title="Convert Complimentary Account To Paid"
        description="Turns off complimentary status, clears complimentary notes and dates, sets the subscription to ACTIVE, sets next invoice to now, and creates the first paid invoice."
        onClose={onClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(convertToPaidAction, (formData) => {
              formData.set('subscriptionId', row.subscriptionId);
            });
          }}
          className="space-y-4"
        >
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'Converting...' : 'Convert to Paid'}
          </button>
        </form>
      </ModalShell>
    );
  }

  return null;
}

export function BillingManagementClient({
  rows,
  activeSubscribers,
  complimentaryCount,
  monthlyRevenue,
  overdueCount,
}: BillingManagementClientProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedRow, setSelectedRow] = useState<BillingRow | null>(null);

  function openModal(row: BillingRow, modalType: ModalType) {
    setSelectedRow(row);
    setActiveModal(modalType);
  }

  function closeModal() {
    setActiveModal(null);
    setSelectedRow(null);
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Active Subscribers
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{activeSubscribers}</p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Complimentary
          </p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{complimentaryCount}</p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Expected MRR
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-950">
            KYD {monthlyRevenue.toFixed(0)}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">Active paid subscriptions</p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Needs Attention
          </p>
          <p className="mt-1 text-xl font-semibold text-amber-600">{overdueCount}</p>
        </div>
      </section>

      {/* Subscription Table */}
      {rows.length === 0 ? (
        <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm text-center">
          <p className="text-sm text-slate-500">
            No subscriptions found. Billing tables may still be waiting for migration or seed data.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Landlord</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Billing Dates</th>
                  <th className="px-4 py-3 text-left font-medium">Latest Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Payment</th>
                  <th className="px-4 py-3 text-left font-medium">Quick Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.subscriptionId} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.landlordName}</div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">{row.planName}</td>

                    <td className="px-4 py-3 text-slate-700">{row.amountLabel}</td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${row.statusClassName}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div>Next invoice: {row.nextInvoiceLabel}</div>
                      <div>Period end: {row.currentPeriodEndLabel}</div>
                      {row.complimentary && (
                        <div>Comp until: {row.complimentaryUntilLabel}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {row.latestInvoiceNumber ?? '—'}
                    </td>

                    <td className="px-4 py-3">
                      {row.fygaroPaymentUrl && !row.complimentary ? (
                        <Link
                          href={row.fygaroPaymentUrl}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Open Link
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Not applicable</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {/* Create Invoice */}
                        {!row.complimentary && (
                          <IconActionButton
                            title="Create Invoice"
                            icon="🧾"
                            tone="billing"
                            onClick={() => openModal(row, 'createInvoice')}
                          />
                        )}

                        {/* Regenerate Fygaro Link */}
                        {!row.complimentary && row.latestInvoiceId && (
                          <IconActionButton
                            title="Regenerate Fygaro Link"
                            icon="🔗"
                            tone="billing"
                            onClick={() => openModal(row, 'regenerateLink')}
                          />
                        )}

                        {/* Mark Paid */}
                        {row.latestInvoiceId && (
                          <IconActionButton
                            title="Mark Paid"
                            icon="✓"
                            tone="good"
                            onClick={() => openModal(row, 'markPaid')}
                          />
                        )}

                        {/* Waive Invoice */}
                        {row.latestInvoiceId && (
                          <IconActionButton
                            title="Waive Invoice"
                            icon="⊘"
                            tone="warning"
                            onClick={() => openModal(row, 'waiveInvoice')}
                          />
                        )}

                        {/* Extend Billing Period 30 Days */}
                        <IconActionButton
                          title="Extend Billing Period 30 Days"
                          icon="⏱"
                          tone="neutral"
                          onClick={() => openModal(row, 'extendBilling')}
                        />

                        {/* Make Complimentary */}
                        {!row.complimentary && (
                          <IconActionButton
                            title="Make Complimentary"
                            icon="🎁"
                            tone="gift"
                            onClick={() => openModal(row, 'makeComplimentary')}
                          />
                        )}

                        {/* Extend Complimentary */}
                        {row.complimentary && (
                          <IconActionButton
                            title="Extend Complimentary"
                            icon="📅"
                            tone="gift"
                            onClick={() => openModal(row, 'extendComplimentary')}
                          />
                        )}

                        {/* Convert To Paid */}
                        {row.complimentary && (
                          <IconActionButton
                            title="Convert To Paid"
                            icon="💳"
                            tone="good"
                            onClick={() => openModal(row, 'convertToPaid')}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal */}
      {activeModal && selectedRow && (
        <ActionModal row={selectedRow} modalType={activeModal} onClose={closeModal} />
      )}
    </div>
  );
}
