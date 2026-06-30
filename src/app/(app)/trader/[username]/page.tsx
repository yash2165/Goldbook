'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMarketMode } from '@/context/MarketModeContext'
import {
  Globe, Award, Calendar, MessageSquare, Loader2, ArrowLeft, Heart, Sparkles
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export default function TraderProfilePage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any | null>(null)
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [posts, setPosts] = useState<any[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [submittingFollow, setSubmittingFollow] = useState(false)

  // Friend status state
  const [friendship, setFriendship] = useState<any | null>(null)
  const [submittingFriend, setSubmittingFriend] = useState(false)

  const supabase = createClient()
  const { currencySymbol, formatCurrency } = useMarketMode()

  useEffect(() => {
    async function loadData() {
      if (!username) return
      setLoading(true)

      try {
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        // Fetch trader profile
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username.toLowerCase())
          .single()

        if (error || !prof) {
          setProfile(null)
          setLoading(false)
          return
        }

        setProfile(prof)

        // Fetch followers count
        const { count: followers } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', prof.id)

        setFollowersCount(followers || 0)

        // Check if following
        if (user) {
          const { data: followCheck } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', prof.id)
            .maybeSingle()

          setIsFollowing(!!followCheck)

          // Check friendship status
          const { data: friendCheck } = await supabase
            .from('friendships')
            .select('*')
            .or(`and(user_id.eq.${user.id},friend_id.eq.${prof.id}),and(user_id.eq.${prof.id},friend_id.eq.${user.id})`)
            .maybeSingle()

          setFriendship(friendCheck)
        }

        // Fetch trader's posts
        const { data: traderPosts } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (username, display_name, avatar_url, headline),
            trades:trade_id (symbol, direction, entry_price, exit_price, net_profit, status, lot_size)
          `)
          .eq('user_id', prof.id)
          .order('created_at', { ascending: false })

        // Check which posts the current user liked
        let likedPostIds: string[] = []
        if (user && traderPosts && traderPosts.length > 0) {
          const postIds = traderPosts.map(p => p.id)
          const { data: likes } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', postIds)

          likedPostIds = likes?.map(l => l.post_id) || []
        }

        const postsWithLikes = traderPosts?.map(p => ({
          ...p,
          hasLiked: likedPostIds.includes(p.id)
        })) || []

        setPosts(postsWithLikes)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
        setLoadingPosts(false)
      }
    }
    loadData()
  }, [username])

  const handleFollowToggle = async () => {
    if (!currentUser || !profile || submittingFollow) return

    setSubmittingFollow(true)
    try {
      const res = await fetch(`/api/traders/${profile.username}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST'
      })

      if (res.ok) {
        setIsFollowing(!isFollowing)
        setFollowersCount(prev => prev + (isFollowing ? -1 : 1))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingFollow(false)
    }
  }

  const handleFriendAction = async () => {
    if (!currentUser || !profile || submittingFriend) return
    setSubmittingFriend(true)
    try {
      if (!friendship) {
        // Send request
        const { data, error } = await supabase
          .from('friendships')
          .insert({
            user_id: currentUser.id,
            friend_id: profile.id,
            status: 'pending'
          })
          .select()
          .single()

        if (!error && data) {
          setFriendship(data)
        }
      } else if (friendship.status === 'pending' && friendship.friend_id === currentUser.id) {
        // Accept request
        const { data, error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', friendship.id)
          .select()
          .single()

        if (!error && data) {
          setFriendship(data)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingFriend(false)
    }
  }

  const handleMessage = async () => {
    if (!currentUser || !profile) return

    try {
      // Call create conversation API
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'direct', recipientId: profile.id })
      })

      const data = await res.json()
      if (res.ok && data.conversation) {
        // Redirect to community page and pass DMs query
        router.push(`/community?tab=dms&id=${data.conversation.id}`)
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060A12] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#060A12] text-white p-6 flex flex-col items-center justify-center space-y-4">
        <h2 className="text-xl font-bold uppercase tracking-wider">Trader Profile Not Found</h2>
        <p className="text-xs text-[#64748B] max-w-xs text-center leading-relaxed">
          The requested username could not be resolved. Make sure the username is spelled correctly.
        </p>
        <button onClick={() => router.back()} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/10">
          Go Back
        </button>
      </div>
    )
  }

  const isSelf = currentUser?.id === profile.id
  const isFriends = friendship?.status === 'accepted'
  const isPendingSent = friendship?.status === 'pending' && friendship?.user_id === currentUser?.id
  const isPendingReceived = friendship?.status === 'pending' && friendship?.friend_id === currentUser?.id

  const canViewContent = isSelf || profile.is_public || isFriends
  const canSendMessage = isSelf || (profile.allow_messages === 'everyone') || (profile.allow_messages === 'friends_only' && isFriends)
  const canViewTrades = isSelf || (profile.allow_trade_visibility === 'everyone') || (profile.allow_trade_visibility === 'friends_only' && isFriends)

  return (
    <div className="min-h-screen bg-[#060A12] text-white">
      {/* Cover Image backdrop */}
      <div className="h-44 w-full bg-gradient-to-r from-sky-950 via-[#0A0D14] to-amber-950/20 border-b border-white/5 relative">
        <button onClick={() => router.back()} className="absolute top-4 left-4 p-2 bg-black/60 hover:bg-black/80 rounded-xl border border-white/10 text-white transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-16 space-y-6 relative -mt-16">
        {/* Profile Card details */}
        <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 md:p-6 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="flex gap-4 items-end">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-2xl bg-white/5 border-2 border-white/10 flex items-center justify-center font-bold text-white text-3xl shadow-xl overflow-hidden shrink-0 select-none">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                ) : (
                  profile.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-white">{profile.display_name || profile.username}</h1>
                  {profile.tier === 'pro' && (
                    <span className="text-[8px] px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-full font-black uppercase tracking-widest flex items-center gap-1">
                      <Award className="w-3 h-3" /> PRO TRADER
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#64748B] font-mono leading-none">@{profile.username}</p>
              </div>
            </div>

            {/* Actions button */}
            {!isSelf && currentUser && (
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {/* Follow Button */}
                <button
                  onClick={handleFollowToggle}
                  disabled={submittingFollow}
                  className={cn(
                    'flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-transform hover:scale-105 active:scale-95 border cursor-pointer',
                    isFollowing 
                      ? 'bg-transparent border-white/10 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 text-white' 
                      : 'bg-primary text-black border-transparent hover:bg-primary/90'
                  )}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>

                {/* Friend Button */}
                <button
                  onClick={handleFriendAction}
                  disabled={submittingFriend || isPendingSent}
                  className={cn(
                    'flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-transform hover:scale-105 active:scale-95 border cursor-pointer',
                    isFriends 
                      ? 'bg-transparent border-[#22C55E]/30 text-[#22C55E]' 
                      : isPendingSent 
                      ? 'bg-white/5 text-[#64748B] border-white/5 cursor-not-allowed'
                      : isPendingReceived
                      ? 'bg-[#22C55E] text-black border-transparent hover:bg-[#22C55E]/90'
                      : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
                  )}
                >
                  {isFriends ? '✓ Friends' : isPendingSent ? 'Request Sent' : isPendingReceived ? 'Accept Request' : 'Add Friend'}
                </button>

                {/* Message Button */}
                {canSendMessage && (
                  <button
                    onClick={handleMessage}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider transition-transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer text-white"
                  >
                    <MessageSquare className="w-4 h-4" /> Message
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-[#94A3B8] leading-relaxed max-w-2xl text-left whitespace-pre-wrap">
            {profile.bio || 'This trader has not authored a bio description yet.'}
          </p>

          {/* Social details / followers counts */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-3 border-t border-white/5 text-xs text-[#64748B] font-medium uppercase tracking-wider">
            <span className="text-white font-extrabold tabular-nums">
              {followersCount} <span className="text-[#64748B] font-medium">Followers</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Joined {format(new Date(profile.created_at), 'MMMM yyyy')}
            </span>
            {profile.twitter_url && (
              <a href={profile.twitter_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Globe className="w-4 h-4 text-[#38BDF8]" /> Twitter
              </a>
            )}
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Globe className="w-4 h-4 text-emerald-400" /> Website
              </a>
            )}
          </div>
        </div>

        {/* Content view restrictions based on privacy settings */}
        {!canViewContent ? (
          <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-10 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-[#64748B]">
              <Award className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Private Profile</h3>
              <p className="text-xs text-[#64748B] max-w-xs mx-auto leading-relaxed">
                Add @{profile.username} as a friend to view their posts, trade logs, and setups.
              </p>
            </div>
          </div>
        ) : (
          /* Authored trade ideas */
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#64748B]">Authored Trade Ideas & Posts ({posts.length})</h2>

            {loadingPosts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-[#0D1421]/30 border border-dashed border-white/5 rounded-2xl py-16 text-center text-[#64748B] text-xs font-bold uppercase tracking-wider">
                No ideas published yet
              </div>
            ) : (
              posts.map(post => (
                <div key={post.id} className="bg-[#0D1421]/60 border border-white/5 rounded-2xl p-5 backdrop-blur-md space-y-4 text-left">
                  <div className="flex justify-between items-center text-[10px] text-[#64748B] font-mono">
                    <span className="uppercase tracking-widest font-black text-primary flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Published Log
                    </span>
                    <span>{format(new Date(post.created_at), 'MMM d, HH:mm')}</span>
                  </div>

                  <p className="text-xs text-[#94A3B8] leading-relaxed whitespace-pre-wrap font-semibold">
                    {post.content}
                  </p>

                  {post.media_urls?.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 rounded-xl overflow-hidden border border-white/5 bg-black/40">
                      {post.media_urls.map((url: string, i: number) => (
                        <img key={i} src={url} alt="Post content" className="w-full h-auto object-cover max-h-[380px]" />
                      ))}
                    </div>
                  )}

                  {post.trades && (
                    <>
                      {canViewTrades ? (
                        <div className="bg-[#060A12]/80 border border-white/5 rounded-xl p-3.5 space-y-2 max-w-xl">
                          <div className="flex justify-between items-center text-[9px] font-mono text-[#64748B]">
                            <span className="uppercase tracking-widest font-black text-primary/80">Verified Log</span>
                            <span className="uppercase tracking-widest font-bold">Closed</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded border', post.trades.direction === 'buy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-red-500/10 text-red-400 border-red-500/15')}>
                                {post.trades.direction}
                              </span>
                              <span className="text-xs font-black text-white">{post.trades.symbol}</span>
                            </div>
                            <span className={cn('text-xs font-mono font-black', (post.trades.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                              {profile.show_pnl_amounts ? (
                                formatCurrency(post.trades.net_profit ?? 0)
                              ) : (
                                (post.trades.net_profit ?? 0) >= 0 ? '+Protected' : '-Protected'
                              )}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#64748B] font-mono">Entry: {post.trades.entry_price} • Exit: {post.trades.exit_price}</p>
                        </div>
                      ) : (
                        <div className="bg-[#060A12]/80 border border-white/5 rounded-xl p-3.5 text-center text-[10px] text-[#64748B] font-black uppercase tracking-wider">
                          🔒 Trade Details Protected by Privacy Settings
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-5 border-t border-white/5 pt-3 text-[#64748B]">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Heart className="w-4 h-4" />
                      <span className="font-bold tabular-nums">{post.likes_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <MessageSquare className="w-4 h-4" />
                      <span className="font-bold tabular-nums">{post.comments_count || 0}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
