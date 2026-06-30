import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET handler to fetch posts for the social feed
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') || 'foryou' // 'foryou', 'following', 'trending'
    const symbol = searchParams.get('symbol') // e.g. 'NIFTY'
    const limit = parseInt(searchParams.get('limit') || '10')
    const page = parseInt(searchParams.get('page') || '0')
    const offset = page * limit

    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (username, display_name, avatar_url, headline),
        trades:trade_id (symbol, direction, entry_price, exit_price, net_profit, status, lot_size)
      `)

    // Filter by ticker symbol if provided
    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase())
    }

    // Tab-specific filters
    if (tab === 'following') {
      // Fetch user IDs of followed traders
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      const followingIds = followingData?.map(f => f.following_id) || []
      followingIds.push(user.id) // Include user's own posts in following tab
      
      query = query.in('user_id', followingIds)
    }

    // Sorting logic
    if (tab === 'trending') {
      // Sort by engagement metric (likes + comments)
      query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false })
    } else {
      // Default: chronological
      query = query.order('created_at', { ascending: false })
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: posts, error } = await query

    if (error) {
      console.error('Fetch posts error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check which posts the current user liked
    const postIds = posts?.map(p => p.id) || []
    let likedPostIds: string[] = []

    if (postIds.length > 0) {
      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds)

      likedPostIds = likes?.map(l => l.post_id) || []
    }

    const postsWithLikes = posts?.map(p => ({
      ...p,
      hasLiked: likedPostIds.includes(p.id)
    })) || []

    return NextResponse.json({ success: true, posts: postsWithLikes })
  } catch (error: any) {
    console.error('Fetch posts error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// POST handler to create a new post
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { content, type, mediaUrls, tradeId, symbol } = body

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content cannot be empty.' }, { status: 400 })
    }

    // Detect cashtags/symbols automatically (e.g. $NIFTY, $XAUUSD)
    let detectedSymbol = symbol || null
    if (!detectedSymbol) {
      const cashtagMatch = content.match(/\$([A-Z0-9]{3,12})/i)
      if (cashtagMatch) {
        detectedSymbol = cashtagMatch[1].toUpperCase()
      }
    }

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content,
        type: type || 'text',
        media_urls: mediaUrls || [],
        trade_id: tradeId || null,
        symbol: detectedSymbol
      })
      .select(`
        *,
        profiles:user_id (username, display_name, avatar_url, headline),
        trades:trade_id (symbol, direction, entry_price, exit_price, net_profit, status, lot_size)
      `)
      .single()

    if (error) {
      console.error('Create post error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Trigger notification for mentions (optional future polish hook)

    return NextResponse.json({ success: true, post })
  } catch (error: any) {
    console.error('Create post error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
