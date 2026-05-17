import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Configure Nodemailer with Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS,
  },
})

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASS) {
      console.error('Email credentials missing from env variables')
      return NextResponse.json({ error: 'Mail server configuration missing' }, { status: 500 })
    }

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = req.headers.get('host') || 'localhost:3000'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`

    // 1. Generate secure Supabase signup link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: {
          full_name: name,
          display_name: name,
        },
        redirectTo: `${siteUrl}/onboarding`
      }
    })

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    const actionLink = linkData.properties?.action_link

    if (!actionLink) {
      return NextResponse.json({ error: 'Failed to generate secure verification link' }, { status: 500 })
    }

    // 2. Pre-create the user's profile securely
    await supabaseAdmin.from('profiles').upsert({
      id: linkData.user.id,
      display_name: name,
      username: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    }, { onConflict: 'id' })

    // 3. Send email via Nodemailer & Gmail
    const mailOptions = {
      from: `"GoldBook" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your GoldBook trading account',
      text: `Hi ${name},\n\nPlease verify your email address to activate your trading terminal.\n\nClick here to verify: ${actionLink}\n\nThanks,\nGoldBook Team`,
      html: `
        <div style="font-family: sans-serif; font-size: 16px; color: #333;">
          <p>Hi ${name},</p>
          <p>Please verify your email address to activate your trading terminal and start syncing your MT5 accounts.</p>
          <p><a href="${actionLink}" style="color: #F59E0B; font-weight: bold;">Click here to verify your account</a></p>
          <br>
          <p>Or paste this link into your browser:<br>${actionLink}</p>
          <br>
          <p>Thanks,<br><strong>GoldBook Team</strong></p>
        </div>
      `,
    }

    try {
      await transporter.sendMail(mailOptions)
    } catch (emailError: any) {
      console.error('NODEMAILER GMAIL ERROR:', emailError)
      // Rollback user creation if email fails
      await supabaseAdmin.auth.admin.deleteUser(linkData.user.id)
      return NextResponse.json({ error: `Failed to send verification email: ${emailError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Verification email sent' })

  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
