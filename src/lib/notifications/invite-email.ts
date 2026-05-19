import { formatDate } from '@/lib/time/format';

/**
 * Escape HTML-significant characters in interpolated values. Mirrors the
 * private helper in digest.ts so invite emails get the same injection
 * protection without coupling the two builders.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a tenant-invitation email payload. Pure and deterministic given its
 * inputs — no IO. Produces subject + plaintext + escaped HTML bodies that
 * mirror the digest.ts dark-header card style.
 */
export function buildTenantInviteEmail(params: {
  landlordName: string;
  locationLabel: string | null;
  inviteUrl: string;
  expiresAt: Date;
  timezone?: string;
}): { subject: string; body: string; bodyHtml: string } {
  const { landlordName, locationLabel, inviteUrl, expiresAt, timezone = 'America/Cayman' } = params;

  const expiryLabel = formatDate(expiresAt, timezone, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const subject = `You're invited to ${landlordName} on CayRentManager`;

  const plainLines = [
    `Hello,`,
    '',
    `${landlordName} has invited you to join their tenant portal on CayRentManager.`,
  ];
  if (locationLabel) {
    plainLines.push(`Location: ${locationLabel}`);
  }
  plainLines.push('');
  plainLines.push('Accept your invitation by opening this link:');
  plainLines.push(inviteUrl);
  plainLines.push('');
  plainLines.push(`This invitation expires on ${expiryLabel}.`);
  plainLines.push('');
  plainLines.push("If you didn't expect this invitation, you can safely ignore this email.");

  const locationRow = locationLabel
    ? `<div style="font-size:13px;color:#64748b;margin-top:6px;">Location: ${escapeHtml(locationLabel)}</div>`
    : '';

  const bodyHtml = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="padding:24px;background:#0f172a;color:#ffffff;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">CayRentManager</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px;">You're invited</div>
        <div style="font-size:13px;color:#cbd5e1;margin-top:4px;">${escapeHtml(landlordName)}</div>
      </div>
      <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:14px;color:#0f172a;line-height:1.6;">
          ${escapeHtml(landlordName)} has invited you to join their tenant portal on CayRentManager.
        </div>
        ${locationRow}
      </div>
      <div style="padding:24px;text-align:center;">
        <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
          Accept invitation
        </a>
        <div style="font-size:12px;color:#64748b;margin-top:16px;word-break:break-all;">
          Or open this link: ${escapeHtml(inviteUrl)}
        </div>
      </div>
      <div style="padding:20px 24px;background:#f8fafc;">
        <div style="font-size:13px;color:#475569;">
          This invitation expires on ${escapeHtml(expiryLabel)}.
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-top:12px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </div>
      </div>
    </div>
  </body>
</html>`;

  return {
    subject,
    body: plainLines.join('\n'),
    bodyHtml,
  };
}
