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

    const { id: postId } = await params

    const { data: comments, error } = await supabase
      .from('post_comments')
      .select(`
        *,
        profiles:user_id (username, display_name, avatar_url, headline)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, comments })
  } catch (error: any) {
    console.error('Fetch comments error:', error)
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

    const { id: postId } = await params
    const body = await req.json()
    const { content, parentId } = body

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Comment content is required.' }, { status: 400 })
    }

    // Verify post exists
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select('user_id, content')
      .eq('id', postId)
      .single()

    if (postErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Insert comment
    const { data: comment, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content,
        parent_id: parentId || null
      })
      .select(`
        *,
        profiles:user_id (username, display_name, avatar_url, headline)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create a notification for the post owner (if it's not the user commenting on their own post)
    if (post.user_id !== user.id) {
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
          type: 'comment',
          title: 'New Comment',
          body: `${displayName} commented on your post: "${content.substring(0, 30)}..."`,
          link: `/feed?post=${postId}`,
          is_read: false
        })
    }

    return NextResponse.json({ success: true, comment })
  } catch (error: any) {
    console.error('Create comment error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
