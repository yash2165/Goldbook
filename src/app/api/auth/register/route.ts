import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// We use the service role key here to bypass RLS and generate secure admin links
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Generate an admin signup link (this bypasses Supabase's 3/hr email limit)
    // The action_link contains the secure token that verifies the email
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
      return NextResponse.json({ error: 'Failed to generate secure link' }, { status: 500 })
    }

    // 2. Create the user's profile securely on the server
    await supabaseAdmin.from('profiles').upsert({
      id: linkData.user.id,
      display_name: name,
      username: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    }, { onConflict: 'id' })

    // 3. Send the custom email using Resend
    const { error: emailError } = await resend.emails.send({
      from: 'GoldBook Security <security@goldbook.app>', // Change to your verified Resend domain if different
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
      `
    })

    if (emailError) {
      // Clean up user if email fails to send
      await supabaseAdmin.auth.admin.deleteUser(linkData.user.id)
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Verification email sent' })

  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
