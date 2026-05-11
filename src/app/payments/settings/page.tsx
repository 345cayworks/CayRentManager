import { PaymentMethodType } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createBankAccountAction, createPaymentMethodAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const [bankAccounts, paymentMethods] = await Promise.all([
    prisma.bankAccount.findMany({ where: { landlordId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }),
    prisma.paymentMethod.findMany({ where: { landlordId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <Shell title="Payment Settings">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white border shadow-sm p-6">
          <h3 className="font-semibold">Add Bank Account</h3>
          <p className="text-sm text-slate-500 mt-1">Store masked Cayman bank transfer details for invoices and tenant instructions.</p>
          <form action={createBankAccountAction} className="grid gap-3 mt-4">
            <input required name="bankName" placeholder="Bank name, e.g. Cayman National Bank" className="border rounded px-3 py-2" />
            <input name="accountName" placeholder="Account name" className="border rounded px-3 py-2" />
            <input required name="accountNumber" placeholder="Account number" className="border rounded px-3 py-2" />
            <div className="grid md:grid-cols-2 gap-3">
              <input name="branch" placeholder="Branch" className="border rounded px-3 py-2" />
              <input name="swiftCode" placeholder="SWIFT code" className="border rounded px-3 py-2" />
            </div>
            <input name="routingInfo" placeholder="Routing / transfer notes" className="border rounded px-3 py-2" />
            <label className="flex gap-2 text-sm text-slate-700">
              <input name="isDefault" type="checkbox" /> Default account
            </label>
            <button className="rounded bg-brand-navy text-white px-4 py-2">Save bank account</button>
          </form>
        </section>

        <section className="rounded-xl bg-white border shadow-sm p-6">
          <h3 className="font-semibold">Add Payment Method</h3>
          <p className="text-sm text-slate-500 mt-1">Configure accepted payment methods such as bank transfer, cash, Fygaro, CNB, or Butterfield.</p>
          <form action={createPaymentMethodAction} className="grid gap-3 mt-4">
            <select required name="type" className="border rounded px-3 py-2">
              <option value="">Payment method type</option>
              {Object.values(PaymentMethodType).map((type) => (
                <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>
              ))}
            </select>
            <input required name="label" placeholder="Label, e.g. Bank Transfer - CNB" className="border rounded px-3 py-2" />
            <textarea name="details" placeholder="Instructions or notes" className="border rounded px-3 py-2" rows={4} />
            <label className="flex gap-2 text-sm text-slate-700">
              <input name="isDefault" type="checkbox" /> Default method
            </label>
            <button className="rounded bg-brand-navy text-white px-4 py-2">Save payment method</button>
          </form>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-semibold">Bank Accounts</h3></div>
          {bankAccounts.length === 0 ? <p className="p-4 text-slate-600">No bank accounts saved.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Bank</th>
                    <th className="text-left p-3">Account</th>
                    <th className="text-left p-3">SWIFT</th>
                    <th className="text-left p-3">Default</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bankAccounts.map((account) => (
                    <tr key={account.id}>
                      <td className="p-3">{account.bankName}</td>
                      <td className="p-3">{account.accountNumberMasked}</td>
                      <td className="p-3">{account.swiftCode ?? '—'}</td>
                      <td className="p-3">{account.isDefault ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-semibold">Payment Methods</h3></div>
          {paymentMethods.length === 0 ? <p className="p-4 text-slate-600">No payment methods saved.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Label</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Default</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paymentMethods.map((method) => (
                    <tr key={method.id}>
                      <td className="p-3">{method.label}</td>
                      <td className="p-3">{method.type.replaceAll('_', ' ')}</td>
                      <td className="p-3">{method.isDefault ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
