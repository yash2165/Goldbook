import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // 1. Strictly accept @gmail.com accounts only
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return NextResponse.json({ error: 'Registration is restricted to verified Gmail addresses only.' }, { status: 400 })
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASS) {
      console.error('Email credentials missing from env variables')
      return NextResponse.json({ error: 'Mail server configuration missing' }, { status: 500 })
    }

    // 2. Pre-validate unique username
    const username = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (username.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 alphanumeric characters.' }, { status: 400 })
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: 'This username is already taken. Please choose another one.' }, { status: 400 })
    }

    // 3. Generate a secure 6-digit numeric OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins expiry

    // 4. Create user in Supabase auth as unconfirmed, saving OTP in user_metadata
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Must verify OTP to confirm email and login
      user_metadata: {
        full_name: name,
        display_name: name,
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt,
      }
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // 5. Pre-create user profile in profiles table
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userData.user.id,
      display_name: name,
      username: username,
      onboarding_completed: false,
    }, { onConflict: 'id' })

    if (profileError) {
      // Rollback auth user if profile database entry fails
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      return NextResponse.json({ error: 'Profile setup failed: ' + profileError.message }, { status: 500 })
    }

    // 6. Dispatch OTP email via Nodemailer & Gmail SMTP
    const mailOptions = {
      from: `"GoldBook" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your GoldBook trading account',
      text: `Hi ${name},\n\nYour 6-digit verification code is: ${otpCode}\n\nThis code will expire in 15 minutes.\n\nThanks,\nGoldBook Team`,
      html: `
        <div style="font-family: sans-serif; font-size: 16px; color: #1e293b; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #F59E0B; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">GOLDBOOK</h2>
            <p style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; font-weight: bold;">Secure Trading Console</p>
          </div>
          <p>Hi <strong>${name}</strong>,</p>
          <p>Please use the following 6-digit verification code to activate your trading terminal and start syncing your MT5 accounts:</p>
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #F59E0B; font-family: monospace;">${otpCode}</span>
          </div>
          <p style="font-size: 13px; color: #64748B;">This code is valid for <strong>15 minutes</strong>. If you did not request this code, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">Thanks,<br><strong>GoldBook Team</strong></p>
        </div>
      `,
    }

    try {
      await transporter.sendMail(mailOptions)
    } catch (emailError: any) {
      console.error('NODEMAILER GMAIL ERROR:', emailError)
      // Rollback user creation if email transmission fails
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      return NextResponse.json({ error: `Failed to send verification email: ${emailError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Verification code sent to Gmail', userId: userData.user.id })

  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
