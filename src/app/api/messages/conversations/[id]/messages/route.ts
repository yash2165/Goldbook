import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await params

    // Verify user is member of the conversation
    const { data: memberCheck } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!memberCheck) {
      return NextResponse.json({ error: 'Access Denied: You are not a member of this conversation' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '30')
    const page = parseInt(searchParams.get('page') || '0')
    const offset = page * limit

    const { data: messages, error } = await supabase
      .from('direct_messages')
      .select(`
        *,
        sender:sender_id (username, display_name, avatar_url),
        trades:trade_id (symbol, direction, entry_price, exit_price, net_profit, status, lot_size, currency)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return in chronological order for UI display
    return NextResponse.json({ success: true, messages: messages.reverse() })
  } catch (error: any) {
    console.error('Fetch messages error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await params
    const body = await req.json()
    const { content, type, mediaUrl, tradeId } = body // type: 'text' | 'image' | 'trade_card' | 'system'

    // Verify membership
    const { data: memberCheck } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!memberCheck) {
      return NextResponse.json({ error: 'Access Denied: You are not a member of this conversation' }, { status: 403 })
    }

    // Insert message
    const { data: message, error } = await supabase
      .from('direct_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content || null,
        type: type || 'text',
        media_url: mediaUrl || null,
        trade_id: tradeId || null
      })
      .select(`
        *,
        sender:sender_id (username, display_name, avatar_url),
        trades:trade_id (symbol, direction, entry_price, exit_price, net_profit, status, lot_size, currency)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create notifications for other members in conversation
    const { data: otherMembers } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', user.id)

    if (otherMembers && otherMembers.length > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .single()

      const displayName = profile?.display_name || profile?.username || 'Someone'

      const notifications = otherMembers.map(member => ({
        user_id: member.user_id,
        actor_id: user.id,
        type: 'message',
        title: 'New Message',
        body: `${displayName}: ${type === 'trade_card' ? 'Shared a trade' : content.substring(0, 30)}`,
        link: `/messages?id=${conversationId}`,
        is_read: false
      }))

      await supabase.from('notifications').insert(notifications)
    }

    return NextResponse.json({ success: true, message })
  } catch (error: any) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
