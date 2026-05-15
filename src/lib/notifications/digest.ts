import { formatDate } from '@/lib/time/format';
import { filterAlertsForUser, type AlertPreferenceInput, type FilterableAlert } from './preferences';

export type DigestAlert = FilterableAlert & {
  alertKey: string;
  title: string;
  description: string;
  daysRemaining?: number | null;
};

export type DigestResult = {
  alertCount: number;
  subject: string;
  body: string;
  bodyHtml: string;
  alertKeys: string[];
};

function severityRank(severity: string): number {
  if (severity === 'CRITICAL') return 3;
  if (severity === 'URGENT') return 2;
  if (severity === 'WARNING') return 1;
  return 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a daily-digest payload for one recipient. The caller is expected to
 * have already filtered alerts to the user's workspace; this function applies
 * the user's preferences and produces the email subject + plaintext + HTML
 * bodies. When no alerts qualify, the result is empty and the caller should
 * skip queueing.
 */
export function buildAlertDigest(params: {
  workspaceName: string;
  alerts: DigestAlert[];
  preference: AlertPreferenceInput;
  generatedAt?: Date;
  appUrl?: string;
  timezone?: string;
}): DigestResult {
  const {
    workspaceName,
    alerts,
    preference,
    generatedAt = new Date(),
    appUrl,
    timezone = 'America/Cayman',
  } = params;

  if (!preference.digestEnabled) {
    return { alertCount: 0, subject: '', body: '', bodyHtml: '', alertKeys: [] };
  }

  const filtered = filterAlertsForUser(alerts, preference);
  if (filtered.length === 0) {
    return { alertCount: 0, subject: '', body: '', bodyHtml: '', alertKeys: [] };
  }

  // Sort by severity (critical first), then by daysRemaining ascending so the
  // most-overdue items are at the top of each bucket.
  const sorted = [...filtered].sort((a, b) => {
    const rankDiff = severityRank(b.severity) - severityRank(a.severity);
    if (rankDiff !== 0) return rankDiff;
    const ad = a.daysRemaining ?? Number.POSITIVE_INFINITY;
    const bd = b.daysRemaining ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });

  const dateLabel = formatDate(generatedAt, timezone, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const subject = `[CayRentManager] ${sorted.length} alert${sorted.length === 1 ? '' : 's'} for ${workspaceName}`;

  const plainLines = [
    `Daily alert digest — ${dateLabel}`,
    `Workspace: ${workspaceName}`,
    `${sorted.length} active alert${sorted.length === 1 ? '' : 's'} need your attention.`,
    '',
  ];

  for (const alert of sorted) {
    plainLines.push(`• [${alert.severity}] ${alert.title}`);
    plainLines.push(`  ${alert.description}`);
    if (typeof alert.daysRemaining === 'number') {
      plainLines.push(`  Days remaining: ${alert.daysRemaining}`);
    }
    plainLines.push('');
  }

  if (appUrl) {
    plainLines.push(`Open the Alert Center: ${appUrl.replace(/\/$/, '')}/alerts`);
  }
  plainLines.push('');
  plainLines.push(
    'You are receiving this because daily digest is enabled on your CayRentManager account.',
  );
  plainLines.push('Manage notification preferences: /account/notifications');

  const htmlRows = sorted
    .map((alert) => {
      const sevColor =
        alert.severity === 'CRITICAL'
          ? '#dc2626'
          : alert.severity === 'URGENT'
            ? '#ea580c'
            : alert.severity === 'WARNING'
              ? '#ca8a04'
              : '#2563eb';
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${sevColor};margin-bottom:4px;">
              ${escapeHtml(alert.severity)}
            </div>
            <div style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:4px;">
              ${escapeHtml(alert.title)}
            </div>
            <div style="font-size:13px;color:#475569;line-height:1.5;">
              ${escapeHtml(alert.description)}
            </div>
            ${
              typeof alert.daysRemaining === 'number'
                ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">Days remaining: ${alert.daysRemaining}</div>`
                : ''
            }
          </td>
        </tr>`;
    })
    .join('');

  const ctaHref = appUrl ? `${appUrl.replace(/\/$/, '')}/alerts` : '/alerts';

  const bodyHtml = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="padding:24px;background:#0f172a;color:#ffffff;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">CayRentManager</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px;">Daily alert digest</div>
        <div style="font-size:13px;color:#cbd5e1;margin-top:4px;">${escapeHtml(dateLabel)}</div>
      </div>
      <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(workspaceName)}</div>
        <div style="font-size:13px;color:#64748b;margin-top:2px;">
          ${sorted.length} active alert${sorted.length === 1 ? '' : 's'} need your attention.
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;">${htmlRows}</table>
      <div style="padding:20px 24px;background:#f8fafc;">
        <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          Open Alert Center
        </a>
        <div style="font-size:11px;color:#94a3b8;margin-top:16px;">
          You are receiving this because daily digest is enabled on your account.
          Manage preferences at /account/notifications.
        </div>
      </div>
    </div>
  </body>
</html>`;

  return {
    alertCount: sorted.length,
    subject,
    body: plainLines.join('\n'),
    bodyHtml,
    alertKeys: sorted.map((alert) => alert.alertKey),
  };
}
