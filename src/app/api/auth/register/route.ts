import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Restrict to Gmail accounts only
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return NextResponse.json({ error: 'Registration is restricted to verified Gmail addresses only.' }, { status: 400 })
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASS) {
      console.error('EMAIL_USER or EMAIL_APP_PASS is missing from environment variables')
      return NextResponse.json({ error: 'Mail server configuration missing' }, { status: 500 })
    }

    // 2. Validate username uniqueness
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

    // 3. Generate a secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // 4. Create user in Supabase (unconfirmed) with OTP stored in metadata
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
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

    // 5. Pre-create profile row
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userData.user.id,
      display_name: name,
      username: username,
      onboarding_completed: false,
    }, { onConflict: 'id' })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      return NextResponse.json({ error: 'Profile setup failed: ' + profileError.message }, { status: 500 })
    }

    // 6. Send OTP via Gmail SMTP using Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASS,
      },
    })

    const mailOptions = {
      from: `"GoldBook" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your GoldBook Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f0f12; color: #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; color: #fff; letter-spacing: 2px;">GOLDBOOK</h1>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Trade Journal Platform</p>
          </div>
          <div style="padding: 40px 32px;">
            <p style="margin: 0 0 8px; color: #a78bfa; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">Verification Code</p>
            <p style="margin: 0 0 24px; color: #e2e8f0; font-size: 15px;">Hi <strong>${name}</strong>, use the code below to verify your account:</p>
            <div style="background: #1a1a2e; border: 2px solid #7c3aed; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
              <span style="font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #a78bfa;">${otpCode}</span>
            </div>
            <p style="color: #64748b; font-size: 13px; margin: 0;">This code expires in <strong style="color:#e2e8f0">15 minutes</strong>. Do not share it with anyone.</p>
          </div>
          <div style="padding: 20px 32px; border-top: 1px solid #1e293b; text-align: center;">
            <p style="color: #475569; font-size: 12px; margin: 0;">© 2025 GoldBook. All rights reserved.</p>
          </div>
        </div>
      `,
    }

    try {
      await transporter.sendMail(mailOptions)
    } catch (emailError: any) {
      console.error('NODEMAILER EMAIL ERROR:', emailError)
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      return NextResponse.json({ error: `Failed to send verification email: ${emailError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to Gmail',
      userId: userData.user.id
    })

  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
