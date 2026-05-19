import { describe, expect, it } from 'vitest';
import { buildTenantInviteEmail } from '@/lib/notifications/invite-email';

const expiresAt = new Date('2026-05-26T12:00:00Z');

describe('buildTenantInviteEmail', () => {
  it('subject contains the landlord name', () => {
    const { subject } = buildTenantInviteEmail({
      landlordName: 'Acme Rentals',
      locationLabel: 'Sunset Villas / Unit 2B',
      inviteUrl: 'https://app.example.com/invite/abc',
      expiresAt,
    });
    expect(subject).toContain('Acme Rentals');
  });

  it('plain body contains the invite url, the location label, and a formatted expiry date', () => {
    const { body } = buildTenantInviteEmail({
      landlordName: 'Acme Rentals',
      locationLabel: 'Sunset Villas / Unit 2B',
      inviteUrl: 'https://app.example.com/invite/abc',
      expiresAt,
    });
    expect(body).toContain('https://app.example.com/invite/abc');
    expect(body).toContain('Sunset Villas / Unit 2B');
    expect(body).toContain('2026');
    expect(body).toMatch(/expires on/i);
  });

  it('omits a location line when locationLabel is null', () => {
    const { body } = buildTenantInviteEmail({
      landlordName: 'Acme Rentals',
      locationLabel: null,
      inviteUrl: 'https://app.example.com/invite/abc',
      expiresAt,
    });
    expect(body).not.toMatch(/Location:/);
  });

  it('html body anchors to the invite url and HTML-escapes the landlord name', () => {
    const { bodyHtml } = buildTenantInviteEmail({
      landlordName: `<script>x</script> & "Bob's"`,
      locationLabel: null,
      inviteUrl: 'https://app.example.com/invite/abc',
      expiresAt,
    });
    expect(bodyHtml).toContain('href="https://app.example.com/invite/abc"');
    expect(bodyHtml).not.toContain('<script>x</script>');
    expect(bodyHtml).toContain('&lt;script&gt;');
    expect(bodyHtml).toContain('&amp;');
    expect(bodyHtml).toContain('&quot;');
    expect(bodyHtml).toContain('&#39;');
  });

  it('is deterministic for fixed inputs', () => {
    const args = {
      landlordName: 'Acme Rentals',
      locationLabel: 'Sunset Villas / Unit 2B',
      inviteUrl: 'https://app.example.com/invite/abc',
      expiresAt,
    };
    expect(buildTenantInviteEmail(args)).toEqual(buildTenantInviteEmail(args));
  });

  it('respects the timezone param and still includes a date', () => {
    const utc = buildTenantInviteEmail({
      landlordName: 'Acme',
      locationLabel: null,
      inviteUrl: 'https://app.example.com/invite/abc',
      expiresAt,
      timezone: 'UTC',
    });
    const tokyo = buildTenantInviteEmail({
      landlordName: 'Acme',
      locationLabel: null,
      inviteUrl: 'https://app.example.com/invite/abc',
      expiresAt: new Date('2026-05-26T23:30:00Z'),
      timezone: 'Asia/Tokyo',
    });
    expect(utc.body).toContain('2026');
    expect(tokyo.body).toContain('2026');
    // Tokyo (UTC+9) rolls 23:30Z onto the next day vs UTC.
    expect(tokyo.body).toMatch(/May 27/);
  });
});
