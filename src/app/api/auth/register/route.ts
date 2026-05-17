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
        redirectTo: `${req.headers.get('origin') || 'http://localhost:3000'}/onboarding`
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #050508; color: #fff; padding: 40px; border-radius: 8px;">
          <h1 style="color: #F59E0B; margin-bottom: 24px;">Welcome to GoldBook</h1>
          <p style="color: #94A3B8; font-size: 16px; line-height: 1.6;">
            Hi ${name},<br><br>
            Please verify your email address to activate your trading terminal and start syncing your MT5 accounts.
          </p>
          <div style="margin: 32px 0;">
            <a href="${actionLink}" style="background-color: #F59E0B; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Verify Email Address</a>
          </div>
          <p style="color: #64748B; font-size: 14px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <span style="color: #F59E0B; word-break: break-all;">${actionLink}</span>
          </p>
          <hr style="border: 0; border-top: 1px solid #1a1a24; margin: 32px 0;">
          <p style="color: #64748B; font-size: 12px;">
            Securely powered by GoldBook Infrastructure. If you did not request this, please ignore this email.
          </p>
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
