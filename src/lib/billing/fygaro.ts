import crypto from 'crypto';
import type { SubscriptionInvoice } from '@prisma/client';

type FygaroJwtPayload = {
  amount: string;
  currency: string;
  custom_reference: string;
  nbf: number;
  exp: number;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString('base64url');
}

export function createFygaroJwt(payload: FygaroJwtPayload) {
  const publicKey = process.env.FYGARO_PUBLIC_KEY;
  const secret = process.env.FYGARO_SECRET_KEY;
  if (!publicKey || !secret) throw new Error('Fygaro keys are not configured.');

  const header = { alg: 'HS256', typ: 'JWT', kid: publicKey };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

export function createFygaroPaymentUrl(invoice: Pick<SubscriptionInvoice, 'amount' | 'currency' | 'invoiceNumber' | 'dueDate'>) {
  const buttonUrl = process.env.FYGARO_BUTTON_URL;
  if (!buttonUrl) throw new Error('FYGARO_BUTTON_URL is required.');
  const nbf = Math.floor(Date.now() / 1000);
  const exp = Math.floor((invoice.dueDate.getTime() + 3 * 86_400_000) / 1000);
  const jwt = createFygaroJwt({
    amount: Number(invoice.amount).toFixed(2),
    currency: invoice.currency,
    custom_reference: invoice.invoiceNumber,
    nbf,
    exp,
  });

  return `${buttonUrl}?jwt=${encodeURIComponent(jwt)}`;
}

export function verifyFygaroWebhookSignature(payloadRaw: string, signature?: string | null) {
  const secret = process.env.FYGARO_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(payloadRaw).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
