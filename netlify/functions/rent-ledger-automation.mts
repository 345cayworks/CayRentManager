import type { Config } from '@netlify/functions';
import { markOverdueInvoices } from '../../src/lib/payments/automation';

export default async () => {
  const overdueCount = await markOverdueInvoices();
  console.log(`Rent ledger automation marked ${overdueCount} invoices overdue.`);
};

export const config: Config = {
  schedule: '0 8 * * *',
};
