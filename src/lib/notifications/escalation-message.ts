function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function severityColor(severity: string): string {
  if (severity === 'CRITICAL') return '#dc2626';
  if (severity === 'URGENT') return '#ea580c';
  if (severity === 'WARNING') return '#ca8a04';
  return '#2563eb';
}

export type EscalationMessage = {
  subject: string;
  body: string;
  bodyHtml: string;
};

/**
 * Build a single-alert escalation notification. The plaintext body is kept
 * short and self-contained so it works as-is for SMS/WhatsApp; the HTML body
 * reuses the digest's dark-header card style with every interpolated value
 * escaped.
 */
export function buildEscalationMessage(params: {
  workspaceName: string;
  alert: {
    title: string;
    description: string;
    severity: string;
    daysRemaining?: number | null;
  };
  level: number;
  appUrl?: string;
  timezone?: string;
}): EscalationMessage {
  const { workspaceName, alert, level, appUrl } = params;

  const subject = `[CayRentManager] ESCALATION L${level}: ${alert.title}`;
  const alertsUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/alerts` : '/alerts';

  const plainLines = [
    `ESCALATION L${level} — ${workspaceName}`,
    `[${alert.severity}] ${alert.title}`,
    alert.description,
  ];
  if (typeof alert.daysRemaining === 'number') {
    plainLines.push(`Days remaining: ${alert.daysRemaining}`);
  }
  plainLines.push(`Open: ${alertsUrl}`);

  const sevColor = severityColor(alert.severity);

  const bodyHtml = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="padding:24px;background:#0f172a;color:#ffffff;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">CayRentManager</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px;">Alert escalation — Level ${escapeHtml(String(level))}</div>
        <div style="font-size:13px;color:#cbd5e1;margin-top:4px;">${escapeHtml(workspaceName)}</div>
      </div>
      <div style="padding:20px 24px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${sevColor};margin-bottom:4px;">
          ${escapeHtml(alert.severity)}
        </div>
        <div style="font-size:16px;font-weight:600;color:#0f172a;margin-bottom:6px;">
          ${escapeHtml(alert.title)}
        </div>
        <div style="font-size:13px;color:#475569;line-height:1.5;">
          ${escapeHtml(alert.description)}
        </div>
        ${
          typeof alert.daysRemaining === 'number'
            ? `<div style="font-size:12px;color:#64748b;margin-top:6px;">Days remaining: ${escapeHtml(String(alert.daysRemaining))}</div>`
            : ''
        }
      </div>
      <div style="padding:20px 24px;background:#f8fafc;">
        <a href="${escapeHtml(alertsUrl)}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          Open Alert Center
        </a>
        <div style="font-size:11px;color:#94a3b8;margin-top:16px;">
          This alert has remained unresolved past your escalation threshold.
          Manage escalation policy at /account/notifications.
        </div>
      </div>
    </div>
  </body>
</html>`;

  return { subject, body: plainLines.join('\n'), bodyHtml };
}
