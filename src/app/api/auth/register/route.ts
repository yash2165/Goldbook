import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendOtpEmail } from '@/lib/email'

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

    // 1. Strictly accept @gmail.com accounts only
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return NextResponse.json({ error: 'Registration is restricted to verified Gmail addresses only.' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is missing from environment variables')
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

    // 5. Pre-create user profile in profiles table
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

    // 6. Dispatch OTP email via Resend
    try {
      const { error: emailError } = await sendOtpEmail(email, name, otpCode)
      if (emailError) {
        throw new Error((emailError as any).message ?? 'Unknown Resend error')
      }
    } catch (emailError: any) {
      console.error('RESEND EMAIL ERROR:', emailError)
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
