import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all user data across all tables
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)

    const { data: mt5Accounts } = await supabase
      .from('mt5_accounts')
      .select('*')
      .eq('user_id', user.id)

    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)

    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)

    const { data: comments } = await supabase
      .from('post_comments')
      .select('*')
      .eq('user_id', user.id)

    const exportPayload = {
      export_metadata: {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        gdpr_scope: 'Full Account Record Archive'
      },
      profile: profile || null,
      trading_logs: trades || [],
      mt5_connected_accounts: mt5Accounts || [],
      friendships: friendships || [],
      social_posts: posts || [],
      social_replies: comments || []
    }

    const jsonString = JSON.stringify(exportPayload, null, 2)

    return new Response(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="goldbook_trader_export.json"'
      }
    })
  } catch (error: any) {
    console.error('Export data error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
