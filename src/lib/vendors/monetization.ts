/**
 * Pure helpers for the vendor monetization layer (Phase 5.3).
 * Kept DB-free so they can be unit tested.
 */

export type BillingStatus = 'NONE' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

export const BILLING_STATUSES: BillingStatus[] = [
  'NONE',
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
];

export function isBillingStatus(v: string): v is BillingStatus {
  return (BILLING_STATUSES as string[]).includes(v);
}

export type RevenueVendor = {
  monthlyFee: number | null;
  billingStatus: string;
  featured: boolean;
  sponsored: boolean;
  status: string; // RecordStatus
};

/**
 * Monthly recurring revenue = sum of monthlyFee for vendors that are
 * status ACTIVE and billingStatus in {ACTIVE, PAST_DUE} (PAST_DUE still
 * owes money so it's billed/expected). TRIAL/NONE/CANCELLED contribute 0.
 * Vendors whose RecordStatus !== 'ACTIVE' (e.g. ARCHIVED) are excluded
 * from MRR and the billable count regardless of billingStatus.
 * Unknown billingStatus contributes 0 and is not counted billable.
 */
export function computeVendorRevenue(vendors: RevenueVendor[]): {
  mrr: number;
  billable: number;
  atRisk: number;
  trialing: number;
  sponsoredCount: number;
  featuredCount: number;
} {
  let mrr = 0;
  let billable = 0;
  let atRisk = 0;
  let trialing = 0;
  let sponsoredCount = 0;
  let featuredCount = 0;

  for (const v of vendors) {
    if (v.sponsored) sponsoredCount += 1;
    if (v.featured) featuredCount += 1;

    if (v.status !== 'ACTIVE') continue;

    if (v.billingStatus === 'TRIAL') {
      trialing += 1;
      continue;
    }

    if (v.billingStatus === 'ACTIVE' || v.billingStatus === 'PAST_DUE') {
      const fee = v.monthlyFee == null ? 0 : v.monthlyFee;
      mrr += fee;
      billable += 1;
      if (v.billingStatus === 'PAST_DUE') atRisk += 1;
    }
  }

  return { mrr, billable, atRisk, trialing, sponsoredCount, featuredCount };
}

export type LeadRow = { globalVendorId: string; type: string };

/**
 * Per-vendor lead counts keyed by globalVendorId. ADD_TO_LIST and INQUIRY
 * are split out; any other type still counts toward total only. Vendors
 * with no leads are absent from the result.
 */
export function summarizeLeads(
  leads: LeadRow[],
): Record<string, { total: number; addToList: number; inquiry: number }> {
  const out: Record<string, { total: number; addToList: number; inquiry: number }> = {};

  for (const lead of leads) {
    const entry = out[lead.globalVendorId] ?? { total: 0, addToList: 0, inquiry: 0 };
    entry.total += 1;
    if (lead.type === 'ADD_TO_LIST') entry.addToList += 1;
    else if (lead.type === 'INQUIRY') entry.inquiry += 1;
    out[lead.globalVendorId] = entry;
  }

  return out;
}
