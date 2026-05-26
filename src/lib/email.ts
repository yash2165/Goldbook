import nodemailer from 'nodemailer'

// Create transporter using verified Gmail SMTP credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS,
  },
})

// Common styles for Frost Platinum & Ice Blue email templates
const commonStyles = {
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  bodyBg: '#060A12',
  cardBg: '#0D1421',
  borderColor: '#1E3A5F',
  textMain: '#F1F5F9',
  textMuted: '#94A3B8',
  iceBlue: '#38BDF8',
  frostGlow: '#7DD3FC',
  mintGreen: '#34D399',
  dangerRed: '#F87171',
}

// ── Email templates ──────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  const mailOptions = {
    from: `"GoldBook" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Welcome to GoldBook — Your Trading Journal',
    html: `
      <div style="font-family: ${commonStyles.fontFamily}; background: ${commonStyles.bodyBg}; color: ${commonStyles.textMain}; padding: 40px; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid ${commonStyles.borderColor};">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1.5px; color: ${commonStyles.textMain};">
            <span style="color: ${commonStyles.iceBlue};">GOLD</span>BOOK
          </h1>
          <p style="margin: 4px 0 0; color: ${commonStyles.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Your Professional Trading Console</p>
        </div>
        
        <h2 style="font-size: 20px; color: ${commonStyles.textMain}; margin-bottom: 16px; font-weight: 700;">Welcome, ${name}! 🎉</h2>
        <p style="color: ${commonStyles.textMuted}; line-height: 1.6; font-size: 14px;">Your professional trading journal is ready. Connect your MT5 account, start logging trades, and let our AI coach help you become a consistently profitable trader.</p>
        
        <div style="text-align: center; margin-top: 32px; margin-bottom: 32px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://goldbook.app'}/dashboard" 
             style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, ${commonStyles.iceBlue}, ${commonStyles.frostGlow}); color: #020617; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(56, 189, 248, 0.25);">
            Go to Dashboard →
          </a>
        </div>
        
        <hr style="border: 0; border-top: 1px solid ${commonStyles.borderColor}; margin: 24px 0;">
        <p style="color: ${commonStyles.textMuted}; font-size: 12px; text-align: center; margin: 0;">GoldBook — Built for serious traders.</p>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}

export async function sendWeeklyReport(to: string, name: string, reportData: {
  grade: string
  totalPnl: number
  winRate: number
  topAction: string
}) {
  const isProfit = reportData.totalPnl >= 0
  const pnlColor = isProfit ? commonStyles.mintGreen : commonStyles.dangerRed

  const mailOptions = {
    from: `"GoldBook AI Coach" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Your Weekly Trading Report — Grade: ${reportData.grade}`,
    html: `
      <div style="font-family: ${commonStyles.fontFamily}; background: ${commonStyles.bodyBg}; color: ${commonStyles.textMain}; padding: 40px; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid ${commonStyles.borderColor};">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1.5px; color: ${commonStyles.textMain};">
            <span style="color: ${commonStyles.iceBlue};">GOLD</span>BOOK
          </h1>
          <p style="margin: 4px 0 0; color: ${commonStyles.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Weekly Performance Analytics</p>
        </div>

        <p style="color: ${commonStyles.textMuted}; margin-bottom: 24px; font-size: 14px;">Hi ${name}, here's your trading week in review.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="width: 33%; padding: 4px;">
              <div style="background: ${commonStyles.cardBg}; border: 1px solid ${commonStyles.borderColor}; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="color: ${commonStyles.textMuted}; font-size: 10px; text-transform: uppercase; margin: 0 0 8px; font-weight: 700; letter-spacing: 1px;">Grade</p>
                <p style="font-size: 28px; font-weight: 900; color: ${commonStyles.iceBlue}; margin: 0;">${reportData.grade}</p>
              </div>
            </td>
            <td style="width: 33%; padding: 4px;">
              <div style="background: ${commonStyles.cardBg}; border: 1px solid ${commonStyles.borderColor}; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="color: ${commonStyles.textMuted}; font-size: 10px; text-transform: uppercase; margin: 0 0 8px; font-weight: 700; letter-spacing: 1px;">P&L</p>
                <p style="font-size: 20px; font-weight: 900; color: ${pnlColor}; margin: 0;">${isProfit ? '+' : ''}$${reportData.totalPnl.toFixed(2)}</p>
              </div>
            </td>
            <td style="width: 33%; padding: 4px;">
              <div style="background: ${commonStyles.cardBg}; border: 1px solid ${commonStyles.borderColor}; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="color: ${commonStyles.textMuted}; font-size: 10px; text-transform: uppercase; margin: 0 0 8px; font-weight: 700; letter-spacing: 1px;">Win Rate</p>
                <p style="font-size: 20px; font-weight: 900; color: ${commonStyles.textMain}; margin: 0;">${reportData.winRate.toFixed(0)}%</p>
              </div>
            </td>
          </tr>
        </table>

        <div style="background: ${commonStyles.cardBg}; border-left: 4px solid ${commonStyles.iceBlue}; border-radius: 0 12px 12px 0; padding: 20px; margin-bottom: 24px; border-top: 1px solid ${commonStyles.borderColor}; border-right: 1px solid ${commonStyles.borderColor}; border-bottom: 1px solid ${commonStyles.borderColor};">
          <p style="color: ${commonStyles.textMuted}; font-size: 10px; text-transform: uppercase; margin: 0 0 8px; font-weight: 700; letter-spacing: 1px;">Top Action for Next Week</p>
          <p style="color: ${commonStyles.textMain}; font-size: 14px; margin: 0; line-height: 1.5; font-weight: 600;">${reportData.topAction}</p>
        </div>
        
        <div style="text-align: center; margin-top: 28px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://goldbook.app'}/ai-report" 
             style="display: inline-block; padding: 12px 24px; background: ${commonStyles.cardBg}; color: ${commonStyles.iceBlue}; border: 1px solid ${commonStyles.iceBlue}; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; transition: all 0.2s;">
            View Full AI Report →
          </a>
        </div>
        <p style="color: ${commonStyles.textMuted}; font-size: 11px; text-align: center; margin-top: 32px;">Unsubscribe from weekly emails in Settings → Notifications.</p>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}

export async function sendHighImpactNewsAlert(to: string, name: string, events: {
  title: string
  country: string
  date: string
  time: string
}[]) {
  const eventRows = events.map(e => `
    <tr style="border-bottom: 1px solid ${commonStyles.borderColor};">
      <td style="padding: 12px; color: ${commonStyles.textMuted}; font-size: 12px; font-weight: 600;">${e.country}</td>
      <td style="padding: 12px; font-size: 13px; color: ${commonStyles.textMain}; font-weight: 600;">${e.title}</td>
      <td style="padding: 12px; color: ${commonStyles.dangerRed}; font-size: 12px; font-weight: 700; text-align: right;">${e.time}</td>
    </tr>
  `).join('')

  const mailOptions = {
    from: `"GoldBook Alerts" <${process.env.EMAIL_USER}>`,
    to,
    subject: `⚠️ High Impact News Alert — ${events.length} event(s) in the next hour`,
    html: `
      <div style="font-family: ${commonStyles.fontFamily}; background: ${commonStyles.bodyBg}; color: ${commonStyles.textMain}; padding: 40px; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid ${commonStyles.borderColor};">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: ${commonStyles.dangerRed}; letter-spacing: 1px;">
            ⚠️ HIGH IMPACT NEWS ALERT
          </h1>
          <p style="margin: 4px 0 0; color: ${commonStyles.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Market Volatility Warning</p>
        </div>

        <p style="color: ${commonStyles.textMuted}; margin-bottom: 24px; font-size: 14px;">Hi ${name}, the following macro events are scheduled within the next hour and could trigger massive market volatility. Protect your capital.</p>
        
        <table style="width: 100%; background: ${commonStyles.cardBg}; border: 1px solid ${commonStyles.borderColor}; border-radius: 12px; border-collapse: collapse; overflow: hidden;">
          <thead>
            <tr style="border-bottom: 1px solid ${commonStyles.borderColor}; background: rgba(255, 255, 255, 0.02);">
              <th style="padding: 12px; color: ${commonStyles.textMuted}; font-size: 10px; text-transform: uppercase; text-align: left; font-weight: 800; letter-spacing: 1px;">Country</th>
              <th style="padding: 12px; color: ${commonStyles.textMuted}; font-size: 10px; text-transform: uppercase; text-align: left; font-weight: 800; letter-spacing: 1px;">Event</th>
              <th style="padding: 12px; color: ${commonStyles.textMuted}; font-size: 10px; text-transform: uppercase; text-align: right; font-weight: 800; letter-spacing: 1px;">Time</th>
            </tr>
          </thead>
          <tbody>${eventRows}</tbody>
        </table>
        
        <p style="color: ${commonStyles.textMuted}; font-size: 12px; margin-top: 24px; text-align: center; line-height: 1.5;">Consider managing your open positions or tightening stop-losses before these events trigger.</p>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}

export async function sendOtpEmail(to: string, name: string, otpCode: string) {
  const mailOptions = {
    from: `"GoldBook" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Verify your GoldBook trading account',
    html: `
      <div style="font-family: ${commonStyles.fontFamily}; background: ${commonStyles.bodyBg}; color: ${commonStyles.textMain}; padding: 40px; max-width: 500px; margin: 0 auto; border-radius: 16px; border: 1px solid ${commonStyles.borderColor};">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1.5px; color: ${commonStyles.textMain};">
            <span style="color: ${commonStyles.iceBlue};">GOLD</span>BOOK
          </h1>
          <p style="margin: 4px 0 0; color: ${commonStyles.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Secure Trading Console</p>
        </div>
        
        <p style="font-size: 14px; color: ${commonStyles.textMain};">Hi <strong>${name}</strong>,</p>
        <p style="font-size: 14px; color: ${commonStyles.textMuted}; line-height: 1.6;">Please use the following 6-digit verification code to activate your trading terminal and start syncing your MT5 accounts:</p>
        
        <div style="background: ${commonStyles.cardBg}; border: 1px dashed ${commonStyles.borderColor}; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0;">
          <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: ${commonStyles.iceBlue}; font-family: monospace;">${otpCode}</span>
        </div>
        
        <p style="font-size: 13px; color: ${commonStyles.textMuted}; line-height: 1.5; text-align: center;">This code is valid for <strong style="color: ${commonStyles.textMain};">15 minutes</strong>. If you did not request this code, please ignore this email.</p>
        
        <hr style="border: 0; border-top: 1px solid ${commonStyles.borderColor}; margin: 24px 0;">
        <p style="font-size: 12px; color: ${commonStyles.textMuted}; text-align: center; margin: 0;">Thanks,<br><strong style="color: ${commonStyles.textMain};">GoldBook Team</strong></p>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}
