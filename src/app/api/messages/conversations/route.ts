import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET handler to fetch conversations list for direct messaging
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch conversation IDs the user is a member of
    const { data: memberships, error: memErr } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 })
    }

    const conversationIds = memberships?.map(m => m.conversation_id) || []

    if (conversationIds.length === 0) {
      return NextResponse.json({ success: true, conversations: [] })
    }

    // Fetch conversations detailed list
    const { data: conversations, error: convErr } = await supabase
      .from('conversations')
      .select(`
        *,
        conversation_members (*, profiles:user_id (username, display_name, avatar_url))
      `)
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false })

    if (convErr) {
      return NextResponse.json({ error: convErr.message }, { status: 500 })
    }

    // Map each conversation to find the "other member" details for DM display
    const formattedConversations = conversations.map((c: any) => {
      if (c.type === 'direct') {
        const otherMember = c.conversation_members.find((m: any) => m.user_id !== user.id)
        return {
          ...c,
          otherMember: otherMember ? otherMember.profiles : null
        }
      }
      return c
    })

    return NextResponse.json({ success: true, conversations: formattedConversations })
  } catch (error: any) {
    console.error('Fetch conversations error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// POST handler to start a new DM or Group Chat
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, recipientId, name, memberIds } = body // type: 'direct' | 'group'

    if (type === 'direct') {
      if (!recipientId) {
        return NextResponse.json({ error: 'recipientId is required for DM.' }, { status: 400 })
      }

      // Verify privacy permissions
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('allow_messages')
        .eq('id', recipientId)
        .single()

      if (recipientProfile && recipientProfile.allow_messages === 'friends') {
        const { data: friendCheck } = await supabase
          .from('friendships')
          .select('status')
          .or(`and(user_id.eq.${user.id},friend_id.eq.${recipientId}),and(user_id.eq.${recipientId},friend_id.eq.${user.id})`)
          .eq('status', 'accepted')
          .maybeSingle()

        if (!friendCheck) {
          return NextResponse.json({ error: 'This trader only accepts direct messages from friends.' }, { status: 403 })
        }
      }

      // Check if a DM already exists between these two users
      const { data: existingMemberships, error: checkErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)

      const myConvIds = existingMemberships?.map(m => m.conversation_id) || []

      if (myConvIds.length > 0) {
        const { data: sharedDM } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', recipientId)
          .in('conversation_id', myConvIds)
          .single()

        if (sharedDM) {
          // Verify if it's indeed a 'direct' type conversation
          const { data: conv } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', sharedDM.conversation_id)
            .eq('type', 'direct')
            .single()

          if (conv) {
            // Fetch profiles details for DM
            const { data: recipientInfo } = await supabase
              .from('profiles')
              .select('username, display_name, avatar_url')
              .eq('id', recipientId)
              .single()

            return NextResponse.json({ success: true, conversation: { ...conv, otherMember: recipientInfo } })
          }
        }
      }

      // Create new DM conversation
      const { data: newConv, error: newConvErr } = await supabase
        .from('conversations')
        .insert({
          type: 'direct',
          created_by: user.id
        })
        .select()
        .single()

      if (newConvErr || !newConv) {
        return NextResponse.json({ error: newConvErr?.message || 'Failed to create DM' }, { status: 500 })
      }

      // Add both members
      const { error: memberErr } = await supabase
        .from('conversation_members')
        .insert([
          { conversation_id: newConv.id, user_id: user.id, role: 'admin' },
          { conversation_id: newConv.id, user_id: recipientId, role: 'member' }
        ])

      if (memberErr) {
        return NextResponse.json({ error: memberErr.message }, { status: 500 })
      }

      // Fetch recipient profile for return payload
      const { data: finalRecipientInfo } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('id', recipientId)
        .single()

      return NextResponse.json({ success: true, conversation: { ...newConv, otherMember: finalRecipientInfo } })
    }

    if (type === 'group') {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Group name is required.' }, { status: 400 })
      }

      const allMemberIds = Array.isArray(memberIds) ? memberIds : []
      if (!allMemberIds.includes(user.id)) {
        allMemberIds.push(user.id)
      }

      // Create Group conversation
      const { data: newGroup, error: groupErr } = await supabase
        .from('conversations')
        .insert({
          type: 'group',
          name,
          created_by: user.id
        })
        .select()
        .single()

      if (groupErr || !newGroup) {
        return NextResponse.json({ error: groupErr?.message || 'Failed to create Group' }, { status: 500 })
      }

      // Add all group members
      const memberInsertions = allMemberIds.map(mId => ({
        conversation_id: newGroup.id,
        user_id: mId,
        role: mId === user.id ? 'admin' : 'member'
      }))

      const { error: membersErr } = await supabase
        .from('conversation_members')
        .insert(memberInsertions)

      if (membersErr) {
        return NextResponse.json({ error: membersErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, conversation: newGroup })
    }

    return NextResponse.json({ error: 'Invalid conversation type' }, { status: 400 })
  } catch (error: any) {
    console.error('Create conversation error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
