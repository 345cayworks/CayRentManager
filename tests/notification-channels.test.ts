import { describe, expect, it } from 'vitest';
import { selectChannelProvider } from '@/lib/notifications/outbox';

describe('selectChannelProvider', () => {
  it('selects resend for EMAIL when configured, else log', () => {
    expect(
      selectChannelProvider('EMAIL', {
        NOTIFICATION_PROVIDER: 'resend',
        RESEND_API_KEY: 'key',
      }),
    ).toBe('resend');
    expect(selectChannelProvider('EMAIL', {})).toBe('log');
    expect(
      selectChannelProvider('EMAIL', { NOTIFICATION_PROVIDER: 'resend' }),
    ).toBe('log');
  });

  it('selects twilio for SMS when fully configured, else log', () => {
    expect(
      selectChannelProvider('SMS', {
        SMS_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'sid',
        TWILIO_AUTH_TOKEN: 'tok',
        TWILIO_SMS_FROM: '+1345',
      }),
    ).toBe('twilio');
    expect(
      selectChannelProvider('SMS', {
        SMS_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'sid',
        TWILIO_AUTH_TOKEN: 'tok',
      }),
    ).toBe('log');
    expect(selectChannelProvider('SMS', {})).toBe('log');
  });

  it('selects twilio for WHATSAPP when fully configured, else log', () => {
    expect(
      selectChannelProvider('WHATSAPP', {
        WHATSAPP_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'sid',
        TWILIO_AUTH_TOKEN: 'tok',
        TWILIO_WHATSAPP_FROM: '+1345',
      }),
    ).toBe('twilio');
    expect(
      selectChannelProvider('WHATSAPP', {
        WHATSAPP_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'sid',
      }),
    ).toBe('log');
  });

  it('falls back to log for unknown channels', () => {
    expect(selectChannelProvider('CARRIER_PIGEON', {})).toBe('log');
  });
});
