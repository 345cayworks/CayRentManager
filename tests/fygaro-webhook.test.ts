import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  verifyFygaroWebhookSignature,
  verifyFygaroJwt,
} from '@/lib/billing/fygaro';
import { isInvoiceAlreadyPaid } from '@/lib/billing/subscriptions';

const SECRET = 'super-secret-webhook-key';
const BODY = JSON.stringify({ custom_reference: 'CRM-INV-2026-000123', reference: 'pay_abc' });

function b64url(input: string) {
  return Buffer.from(input).toString('base64url');
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${sig}`;
}

describe('verifyFygaroWebhookSignature', () => {
  let savedSecret: string | undefined;

  beforeEach(() => {
    savedSecret = process.env.FYGARO_WEBHOOK_SECRET;
    process.env.FYGARO_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.FYGARO_WEBHOOK_SECRET;
    else process.env.FYGARO_WEBHOOK_SECRET = savedSecret;
  });

  it('rejects when the secret is unset (fail closed) — with and without a signature', () => {
    delete process.env.FYGARO_WEBHOOK_SECRET;
    const hex = crypto.createHmac('sha256', SECRET).update(BODY).digest('hex');
    expect(verifyFygaroWebhookSignature(BODY, hex)).toBe(false);
    expect(verifyFygaroWebhookSignature(BODY, null)).toBe(false);
    expect(verifyFygaroWebhookSignature(BODY)).toBe(false);
  });

  it('rejects when the secret is an empty string (fail closed)', () => {
    process.env.FYGARO_WEBHOOK_SECRET = '';
    const hex = crypto.createHmac('sha256', SECRET).update(BODY).digest('hex');
    expect(verifyFygaroWebhookSignature(BODY, hex)).toBe(false);
  });

  it('accepts a valid HMAC-SHA256 hex digest', () => {
    const hex = crypto.createHmac('sha256', SECRET).update(BODY).digest('hex');
    expect(verifyFygaroWebhookSignature(BODY, hex)).toBe(true);
  });

  it('accepts a valid HMAC-SHA256 base64 digest', () => {
    const b64 = crypto.createHmac('sha256', SECRET).update(BODY).digest('base64');
    expect(verifyFygaroWebhookSignature(BODY, b64)).toBe(true);
  });

  it('accepts a valid HMAC-SHA256 base64url digest', () => {
    const b64u = crypto.createHmac('sha256', SECRET).update(BODY).digest('base64url');
    expect(verifyFygaroWebhookSignature(BODY, b64u)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const hex = crypto.createHmac('sha256', SECRET).update(BODY).digest('hex');
    expect(verifyFygaroWebhookSignature(`${BODY}x`, hex)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const hex = crypto.createHmac('sha256', 'other-secret').update(BODY).digest('hex');
    expect(verifyFygaroWebhookSignature(BODY, hex)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyFygaroWebhookSignature(BODY, null)).toBe(false);
    expect(verifyFygaroWebhookSignature(BODY)).toBe(false);
  });

  it('accepts a valid HS256 JWT signed with the secret (header or body)', () => {
    const jwt = signJwt({ custom_reference: 'CRM-INV-2026-000123' }, SECRET);
    expect(verifyFygaroWebhookSignature('ignored', jwt)).toBe(true);
    expect(verifyFygaroWebhookSignature(jwt, 'header-not-a-sig')).toBe(true);
  });

  it('never throws on arbitrary junk input', () => {
    expect(verifyFygaroWebhookSignature('', '')).toBe(false);
    expect(verifyFygaroWebhookSignature('a.b.c', 'a.b.c')).toBe(false);
    expect(verifyFygaroWebhookSignature('{not json', '%%%')).toBe(false);
    // @ts-expect-error intentionally wrong type to prove it never throws
    expect(verifyFygaroWebhookSignature(undefined, undefined)).toBe(false);
  });
});

describe('verifyFygaroJwt', () => {
  it('accepts a valid HS256 JWT', () => {
    const jwt = signJwt({ sub: '1' }, SECRET);
    expect(verifyFygaroJwt(jwt, { secret: SECRET })).toBe(true);
  });

  it('rejects an expired JWT (exp in the past)', () => {
    const jwt = signJwt({ exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    expect(verifyFygaroJwt(jwt, { secret: SECRET })).toBe(false);
  });

  it('rejects a not-yet-valid JWT (nbf in the future)', () => {
    const jwt = signJwt({ nbf: Math.floor(Date.now() / 1000) + 600 }, SECRET);
    expect(verifyFygaroJwt(jwt, { secret: SECRET })).toBe(false);
  });

  it('rejects a JWT signed with the wrong secret', () => {
    const jwt = signJwt({ sub: '1' }, 'wrong-secret');
    expect(verifyFygaroJwt(jwt, { secret: SECRET })).toBe(false);
  });

  it('rejects garbage a.b.c without throwing', () => {
    expect(verifyFygaroJwt('a.b.c', { secret: SECRET })).toBe(false);
    expect(verifyFygaroJwt('not-a-jwt', { secret: SECRET })).toBe(false);
    expect(verifyFygaroJwt('', { secret: SECRET })).toBe(false);
  });

  it('rejects when no secret is available', () => {
    const jwt = signJwt({ sub: '1' }, SECRET);
    const saved = process.env.FYGARO_WEBHOOK_SECRET;
    const savedKey = process.env.FYGARO_SECRET_KEY;
    delete process.env.FYGARO_WEBHOOK_SECRET;
    delete process.env.FYGARO_SECRET_KEY;
    try {
      expect(verifyFygaroJwt(jwt)).toBe(false);
    } finally {
      if (saved !== undefined) process.env.FYGARO_WEBHOOK_SECRET = saved;
      if (savedKey !== undefined) process.env.FYGARO_SECRET_KEY = savedKey;
    }
  });
});

describe('isInvoiceAlreadyPaid', () => {
  it('is true only for PAID', () => {
    expect(isInvoiceAlreadyPaid('PAID')).toBe(true);
    expect(isInvoiceAlreadyPaid('OPEN')).toBe(false);
    expect(isInvoiceAlreadyPaid('VOID')).toBe(false);
  });
});
