import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { userId, code } = await req.json()

    if (!userId || !code) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // 1. Fetch user securely by ID
    const { data: { user }, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (fetchError || !user) {
      return NextResponse.json({ error: 'Verification record not found. Please register again.' }, { status: 400 })
    }

    const { otp_code, otp_expires_at } = user.user_metadata || {}

    if (!otp_code || !otp_expires_at) {
      return NextResponse.json({ error: 'No active verification request found for this account.' }, { status: 400 })
    }

    // 2. Validate expiration (15 minutes)
    if (new Date(otp_expires_at).getTime() < Date.now()) {
      // Cleanup the unconfirmed user to allow them to register again
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Verification code has expired. Please register again.' }, { status: 400 })
    }

    // 3. Verify OTP code matches
    if (code.trim() !== otp_code.trim()) {
      return NextResponse.json({ error: 'Invalid verification code. Please check your Gmail inbox.' }, { status: 400 })
    }

    // 4. Confirm user's email and clear the OTP flags in metadata
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        otp_code: null,
        otp_expires_at: null,
      }
    })

    if (confirmError) {
      return NextResponse.json({ error: 'Failed to confirm account: ' + confirmError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Account verified successfully!' })

  } catch (error: any) {
    console.error('Verify OTP API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
