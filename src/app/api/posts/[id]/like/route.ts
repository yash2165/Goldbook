import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const { id: postId } = await params

    // Verify post exists
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select('user_id, content')
      .eq('id', postId)
      .single()

    if (postErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Insert like record
    const { error: likeErr } = await supabase
      .from('post_likes')
      .insert({
        post_id: postId,
        user_id: user.id
      })

    // If duplicate (already liked), just return success
    if (likeErr && likeErr.code !== '23505') {
      return NextResponse.json({ error: likeErr.message }, { status: 500 })
    }

    // Create a notification for the post owner (if it's not the user liking their own post)
    if (post.user_id !== user.id) {
      // Get liking user's profile info
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .single()

      const displayName = profile?.display_name || profile?.username || 'Someone'

      await supabase
        .from('notifications')
        .insert({
          user_id: post.user_id,
          actor_id: user.id,
          type: 'like',
          title: 'New Like',
          body: `${displayName} liked your post: "${post.content.substring(0, 30)}..."`,
          link: `/feed?post=${postId}`,
          is_read: false
        })
    }

    return NextResponse.json({ success: true, message: 'Post liked' })
  } catch (error: any) {
    console.error('Like post error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: postId } = await params

    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Post unliked' })
  } catch (error: any) {
    console.error('Unlike post error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
