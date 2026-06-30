import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await params
    const cleanUsername = username.toLowerCase().trim()

    // Fetch target user id
    const { data: targetProfile, error: targetErr } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('username', cleanUsername)
      .single()

    if (targetErr || !targetProfile) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 })
    }

    if (targetProfile.id === user.id) {
      return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 })
    }

    // Insert follow record
    const { error: followErr } = await supabase
      .from('follows')
      .insert({
        follower_id: user.id,
        following_id: targetProfile.id
      })

    if (followErr && followErr.code !== '23505') {
      return NextResponse.json({ error: followErr.message }, { status: 500 })
    }

    // Create notification for followed user
    if (!followErr) {
      const { data: followerProfile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .single()

      const displayName = followerProfile?.display_name || followerProfile?.username || 'Someone'

      await supabase
        .from('notifications')
        .insert({
          user_id: targetProfile.id,
          actor_id: user.id,
          type: 'follow',
          title: 'New Follower',
          body: `${displayName} started following you!`,
          link: `/trader/${followerProfile?.username}`,
          is_read: false
        })
    }

    return NextResponse.json({ success: true, message: 'Successfully followed trader' })
  } catch (error: any) {
    console.error('Follow trader error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await params
    const cleanUsername = username.toLowerCase().trim()

    // Fetch target user id
    const { data: targetProfile, error: targetErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .single()

    if (targetErr || !targetProfile) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 })
    }

    const { error: deleteErr } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetProfile.id)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Successfully unfollowed trader' })
  } catch (error: any) {
    console.error('Unfollow trader error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
