import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { subject, category, message, screenshotUrl } = body

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and Message are required fields.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        email: user.email!,
        subject,
        category: category || 'other',
        message,
        screenshot_url: screenshotUrl || null,
        status: 'open'
      })
      .select()
      .single()

    if (error) {
      console.error('Support ticket DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Try sending confirmation email to the user
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASS) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASS,
          },
        })

        const mailOptions = {
          from: `"Goldbook Support" <${process.env.EMAIL_USER}>`,
          to: user.email!,
          subject: `Support Ticket Received: [#${data.id.substring(0, 8)}] ${subject}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-lg: 8px;">
              <h2 style="color: #38bdf8;">Hello,</h2>
              <p>We have received your support request! Our team will review it and get back to you as soon as possible.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p><strong>Ticket ID:</strong> #${data.id}</p>
              <p><strong>Category:</strong> ${category}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Message:</strong></p>
              <blockquote style="background-color: #f8fafc; border-left: 4px solid #38bdf8; padding: 10px 15px; margin: 15px 0;">
                ${message.replace(/\n/g, '<br/>')}
              </blockquote>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 11px; color: #64748b;">This is an automated confirmation of receipt. Please do not reply directly to this email.</p>
            </div>
          `,
        }

        await transporter.sendMail(mailOptions)
      }
    } catch (emailErr) {
      console.warn('Failed to send support ticket confirmation email:', emailErr)
    }

    return NextResponse.json({ success: true, ticket: data })
  } catch (error: any) {
    console.error('Support ticket submission error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
