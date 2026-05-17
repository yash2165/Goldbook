import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// ── Email templates ──────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  return resend.emails.send({
    from: 'GoldBook <noreply@goldbook.app>',
    to,
    subject: 'Welcome to GoldBook — Your Trading Journal',
    html: `
      <div style="font-family:Inter,sans-serif;background:#0A0A0F;color:#F1F5F9;padding:40px;max-width:600px;margin:0 auto;border-radius:16px;">
        <h1 style="color:#3B82F6;font-size:28px;margin-bottom:8px;">GoldBook</h1>
        <h2 style="font-size:20px;color:#F1F5F9;margin-bottom:16px;">Welcome, ${name}! 🎉</h2>
        <p style="color:#94A3B8;line-height:1.6;">Your professional trading journal is ready. Connect your MT5 account, start logging trades, and let our AI coach help you become a consistently profitable trader.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://goldbook.app'}/dashboard" 
           style="display:inline-block;margin-top:24px;padding:12px 24px;background:#3B82F6;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">
          Go to Dashboard →
        </a>
        <p style="color:#334155;font-size:12px;margin-top:32px;">GoldBook — Built for serious traders.</p>
      </div>
    `,
  })
}

export async function sendWeeklyReport(to: string, name: string, reportData: {
  grade: string
  totalPnl: number
  winRate: number
  topAction: string
}) {
  const isProfit = reportData.totalPnl >= 0
  return resend.emails.send({
    from: 'GoldBook AI Coach <coach@goldbook.app>',
    to,
    subject: `Your Weekly Trading Report — Grade: ${reportData.grade}`,
    html: `
      <div style="font-family:Inter,sans-serif;background:#0A0A0F;color:#F1F5F9;padding:40px;max-width:600px;margin:0 auto;border-radius:16px;">
        <h1 style="color:#3B82F6;font-size:24px;margin-bottom:4px;">GoldBook Weekly Report</h1>
        <p style="color:#64748B;margin-bottom:24px;">Hi ${name}, here's your week in review.</p>
        
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;">
          <div style="background:#12121A;border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:16px;text-align:center;">
            <p style="color:#64748B;font-size:11px;text-transform:uppercase;margin:0 0 8px;">Grade</p>
            <p style="font-size:28px;font-weight:900;color:#F59E0B;margin:0;">${reportData.grade}</p>
          </div>
          <div style="background:#12121A;border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:16px;text-align:center;">
            <p style="color:#64748B;font-size:11px;text-transform:uppercase;margin:0 0 8px;">P&L</p>
            <p style="font-size:20px;font-weight:900;color:${isProfit ? '#22C55E' : '#EF4444'};margin:0;">${isProfit ? '+' : ''}$${reportData.totalPnl.toFixed(2)}</p>
          </div>
          <div style="background:#12121A;border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:16px;text-align:center;">
            <p style="color:#64748B;font-size:11px;text-transform:uppercase;margin:0 0 8px;">Win Rate</p>
            <p style="font-size:20px;font-weight:900;color:#3B82F6;margin:0;">${reportData.winRate.toFixed(0)}%</p>
          </div>
        </div>

        <div style="background:#12121A;border-left:3px solid #3B82F6;border-radius:0 12px 12px 0;padding:16px;margin-bottom:24px;">
          <p style="color:#64748B;font-size:11px;text-transform:uppercase;margin:0 0 8px;">Top Action for Next Week</p>
          <p style="color:#F1F5F9;font-size:14px;margin:0;">${reportData.topAction}</p>
        </div>
        
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://goldbook.app'}/ai-report" 
           style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">
          View Full AI Report →
        </a>
        <p style="color:#334155;font-size:12px;margin-top:32px;">Unsubscribe from weekly emails in Settings → Notifications.</p>
      </div>
    `,
  })
}

export async function sendHighImpactNewsAlert(to: string, name: string, events: {
  title: string
  country: string
  date: string
  time: string
}[]) {
  const eventRows = events.map(e => `
    <tr>
      <td style="padding:8px 12px;color:#64748B;font-size:12px;">${e.country}</td>
      <td style="padding:8px 12px;font-size:13px;color:#F1F5F9;">${e.title}</td>
      <td style="padding:8px 12px;color:#EF4444;font-size:12px;font-weight:600;">${e.time}</td>
    </tr>
  `).join('')

  return resend.emails.send({
    from: 'GoldBook Alerts <alerts@goldbook.app>',
    to,
    subject: `⚠️ High Impact News Alert — ${events.length} event(s) in the next hour`,
    html: `
      <div style="font-family:Inter,sans-serif;background:#0A0A0F;color:#F1F5F9;padding:40px;max-width:600px;margin:0 auto;border-radius:16px;">
        <h1 style="color:#EF4444;font-size:20px;margin-bottom:4px;">⚠️ High Impact News Alert</h1>
        <p style="color:#94A3B8;margin-bottom:24px;">Hi ${name}, these events could cause significant market volatility.</p>
        
        <table style="width:100%;background:#12121A;border-radius:12px;border-collapse:collapse;overflow:hidden;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
              <th style="padding:10px 12px;color:#64748B;font-size:10px;text-transform:uppercase;text-align:left;">Country</th>
              <th style="padding:10px 12px;color:#64748B;font-size:10px;text-transform:uppercase;text-align:left;">Event</th>
              <th style="padding:10px 12px;color:#64748B;font-size:10px;text-transform:uppercase;text-align:left;">Time</th>
            </tr>
          </thead>
          <tbody>${eventRows}</tbody>
        </table>
        
        <p style="color:#64748B;font-size:12px;margin-top:24px;">Consider managing your open positions before these events.</p>
      </div>
    `,
  })
}
