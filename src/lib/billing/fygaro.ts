/**
 * Fygaro webhook signature verification.
 *
 * SECURITY POSTURE (fail closed):
 *   - `FYGARO_WEBHOOK_SECRET` is MANDATORY for webhook-confirmed payments.
 *     When it is unset/empty, every webhook is REJECTED. Until the operator
 *     sets the secret, payment confirmation falls back to the existing
 *     SuperAdmin manual mark-paid flow — that is the correct secure default.
 *   - There is intentionally NO "no secret => accept" path.
 *
 * ASSUMED SCHEMES (constant-time, never throws):
 *   1. HMAC-SHA256 of the raw request body keyed with FYGARO_WEBHOOK_SECRET,
 *      sent as either a hex or base64/base64url digest in the
 *      `x-fygaro-signature` header.
 *   2. A signed HS256 JWT (xxx.yyy.zzz) in the header or body, verified with
 *      FYGARO_WEBHOOK_SECRET (fallback FYGARO_SECRET_KEY); `exp`/`nbf`
 *      validated when present.
 *
 * OPERATOR ACTION REQUIRED: confirm Fygaro's REAL webhook signing scheme and
 * header name against the Fygaro dashboard. If they differ from the above,
 * adjust `FYGARO_SIGNATURE_HEADER` and/or the algorithm here accordingly.
 */
import crypto from 'crypto';
import type { SubscriptionInvoice } from '@prisma/client';

/**
 * Header carrying the Fygaro webhook signature. Single-sourced here so the
 * route does not hardcode it. CONFIRM this against the Fygaro dashboard and
 * change it if Fygaro uses a different header name.
 */
export const FYGARO_SIGNATURE_HEADER = 'x-fygaro-signature';

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
  const keyId = process.env.FYGARO_KID ?? process.env.FYGARO_PUBLIC_KEY;
  const secret = process.env.FYGARO_SECRET_KEY;
  if (!keyId || !secret) throw new Error('Fygaro keys are not configured.');

  const header = { alg: 'HS256', typ: 'JWT', kid: keyId };
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

/** Constant-time string compare that never throws on length/encoding mismatch. */
function constantTimeEquals(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Still run a constant-time compare against a same-length buffer so the
      // early-return does not leak length via timing, then return false.
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

type VerifyFygaroJwtOptions = {
  /** Override the secret; defaults to FYGARO_WEBHOOK_SECRET ?? FYGARO_SECRET_KEY. */
  secret?: string;
  /** Clock for exp/nbf checks (seconds). Defaults to Date.now(). */
  nowMs?: number;
};

/**
 * Verify an HS256-signed Fygaro JWT (`xxx.yyy.zzz`) with the webhook secret
 * (fallback FYGARO_SECRET_KEY). Validates `exp`/`nbf` when present. Never
 * throws — any malformed input returns false.
 */
export function verifyFygaroJwt(token: string, opts?: VerifyFygaroJwtOptions): boolean {
  try {
    if (typeof token !== 'string') return false;
    const secret = opts?.secret ?? process.env.FYGARO_WEBHOOK_SECRET ?? process.env.FYGARO_SECRET_KEY;
    if (!secret) return false;

    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) return false;

    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
      alg?: string;
    };
    if (header?.alg !== 'HS256') return false;

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');
    if (!constantTimeEquals(expectedSignature, encodedSignature)) return false;

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      exp?: unknown;
      nbf?: unknown;
    };
    const nowSec = Math.floor((opts?.nowMs ?? Date.now()) / 1000);
    if (typeof payload?.exp === 'number' && nowSec >= payload.exp) return false;
    if (typeof payload?.nbf === 'number' && nowSec < payload.nbf) return false;

    return true;
  } catch {
    return false;
  }
}

function looksLikeJwt(value: string): boolean {
  return typeof value === 'string' && value.split('.').length === 3;
}

/**
 * Verify a Fygaro webhook request.
 *
 * Fails closed: when FYGARO_WEBHOOK_SECRET is unset/empty, ALWAYS returns
 * false (no insecure accept path). Never throws.
 *
 * @param payloadRaw the raw request body (read once, before JSON.parse)
 * @param signature  the value of FYGARO_SIGNATURE_HEADER (may be null)
 */
export function verifyFygaroWebhookSignature(payloadRaw: string, signature?: string | null): boolean {
  try {
    const secret = process.env.FYGARO_WEBHOOK_SECRET;
    if (!secret) return false;
    if (!signature) return false;

    // 1. Signed JWT either in the header or as the raw body.
    if (looksLikeJwt(signature) && verifyFygaroJwt(signature, { secret })) return true;
    if (looksLikeJwt(payloadRaw) && verifyFygaroJwt(payloadRaw, { secret })) return true;

    // 2. HMAC-SHA256 of the raw body, hex or base64/base64url digest.
    const digest = crypto.createHmac('sha256', secret).update(payloadRaw).digest();
    const expectedHex = digest.toString('hex');
    const expectedBase64 = digest.toString('base64');
    const expectedBase64Url = digest.toString('base64url');

    if (constantTimeEquals(expectedHex, signature)) return true;
    if (constantTimeEquals(expectedBase64, signature)) return true;
    if (constantTimeEquals(expectedBase64Url, signature)) return true;

    return false;
  } catch {
    return false;
  }
}
