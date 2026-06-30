'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { useMarketMode } from '@/context/MarketModeContext'
import {
  Send, Bot, Image as ImageIcon, Link as LinkIcon, X, Loader2, Heart, MessageSquare, AlertTriangle, ArrowRight, Check
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export function SocialFeed({ user, onOpenProfile }: { user: any, onOpenProfile: (username: string) => void }) {
  const [subTab, setSubTab] = useState<'foryou' | 'following' | 'trending'>('foryou')
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  // Compose State
  const [composeText, setComposeText] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [attachedImages, setAttachedImages] = useState<string[]>([])
  const [linkedTrade, setLinkedTrade] = useState<any | null>(null)
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Comments State per post
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)

  const { activeAccount } = useAccounts()
  const { trades } = useTrades(activeAccount?.id)
  const { currencySymbol, formatCurrency } = useMarketMode()
  const supabase = createClient()

  // Fetch posts
  const fetchPosts = async (reset = false) => {
    const nextPage = reset ? 0 : page
    setLoading(true)
    try {
      let url = `/api/posts?tab=${subTab}&page=${nextPage}&limit=10`
      if (selectedSymbol) {
        url += `&symbol=${selectedSymbol}`
      }
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data.posts) {
        if (reset) {
          setPosts(data.posts)
        } else {
          setPosts(prev => [...prev, ...data.posts])
        }
        setHasMore(data.posts.length === 10)
        setPage(nextPage + 1)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts(true)
  }, [subTab, selectedSymbol])

  // Handle post submit
  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!composeText.trim() || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: composeText,
          type: linkedTrade ? 'trade_idea' : 'text',
          mediaUrls: attachedImages,
          tradeId: linkedTrade?.id || null,
          symbol: linkedTrade?.symbol || null
        })
      })

      const data = await res.json()
      if (res.ok && data.post) {
        setPosts(prev => [data.post, ...prev])
        setComposeText('')
        setAttachedImages([])
        setLinkedTrade(null)
      } else {
        alert(data.error || 'Failed to submit post.')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Image Paste/Upload for compose box
  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tradeId', 'temp_post_' + Date.now()) // synthetic trade id to reuse the endpoint

    try {
      const res = await fetch('/api/trades/upload-screenshot', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok && data.screenshot?.url) {
        setAttachedImages(prev => [...prev, data.screenshot.url])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingImage(false)
    }
  }

  // Handle Likes
  const handleLikeToggle = async (post: any) => {
    const originalHasLiked = post.hasLiked
    const originalLikesCount = post.likes_count

    // Optimistic UI update
    setPosts(prev => prev.map(p => {
      if (p.id === post.id) {
        return {
          ...p,
          hasLiked: !originalHasLiked,
          likes_count: originalLikesCount + (originalHasLiked ? -1 : 1)
        }
      }
      return p
    }))

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: originalHasLiked ? 'DELETE' : 'POST'
      })
      if (!res.ok) {
        // Rollback
        setPosts(prev => prev.map(p => {
          if (p.id === post.id) {
            return { ...p, hasLiked: originalHasLiked, likes_count: originalLikesCount }
          }
          return p
        }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Handle Comments drawer toggle and fetch
  const handleCommentsToggle = async (postId: string) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null)
      return
    }

    setActiveCommentsPostId(postId)
    setComments([])
    setLoadingComments(true)

    try {
      const res = await fetch(`/api/posts/${postId}/comments`)
      const data = await res.json()
      if (res.ok && data.comments) {
        setComments(data.comments)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingComments(false)
    }
  }

  // Submit new comment
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !activeCommentsPostId) return

    try {
      const res = await fetch(`/api/posts/${activeCommentsPostId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      })

      const data = await res.json()
      if (res.ok && data.comment) {
        setComments(prev => [...prev, data.comment])
        setPosts(prev => prev.map(p => {
          if (p.id === activeCommentsPostId) {
            return { ...p, comments_count: (p.comments_count || 0) + 1 }
          }
          return p
        }))
        setNewComment('')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const closedTradesOnly = trades.filter(t => t.status === 'closed')

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07070b]">
      {/* Feed Headers & Tabs */}
      <div className="h-12 border-b border-white/5 px-5 flex items-center justify-between shrink-0 bg-[#0d0d14]">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-white leading-none">Trader Social Feed</h2>
          {selectedSymbol && (
            <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
              Tag: ${selectedSymbol} 
              <button onClick={() => setSelectedSymbol(null)} className="ml-1 text-white hover:text-[#EF4444] font-black">×</button>
            </span>
          )}
        </div>
        <div className="flex bg-[#060A12] border border-white/5 p-0.5 rounded-lg gap-0.5">
          {(['foryou', 'following', 'trending'] as const).map(tabOpt => (
            <button
              key={tabOpt}
              onClick={() => { setSubTab(tabOpt); setSelectedSymbol(null); }}
              className={cn(
                'px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                subTab === tabOpt ? 'bg-primary/10 border border-primary/15 text-primary' : 'text-[#64748B] hover:text-white'
              )}
            >
              {tabOpt === 'foryou' ? 'For You' : tabOpt === 'following' ? 'Following' : 'Trending'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 no-scrollbar">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Compose Box Card */}
          <form onSubmit={handleComposeSubmit} className="bg-[#0D1421] border border-white/5 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 border border-white/10 overflow-hidden flex items-center justify-center font-bold text-primary shrink-0">
                {user.email?.charAt(0).toUpperCase() || '?'}
              </div>
              <textarea
                value={composeText}
                onChange={e => setComposeText(e.target.value)}
                placeholder="Share your trade breakdown, setups, or market outlook... Use $TICKER to tag."
                className="flex-1 bg-transparent border-0 resize-none text-xs text-white placeholder-[#64748B] focus:ring-0 focus:outline-none min-h-[70px] pt-1"
                required
              />
            </div>

            {/* Link Preview / Media Attachments Preview */}
            {(attachedImages.length > 0 || linkedTrade) && (
              <div className="flex flex-wrap gap-2.5 p-3.5 bg-black/40 border border-white/5 rounded-xl">
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden w-20 h-20 border border-white/10 shrink-0">
                    <img src={img} alt="attachment" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 text-[8px]">×</button>
                  </div>
                ))}

                {linkedTrade && (
                  <div className="flex items-center justify-between bg-[#060A12] border border-white/10 rounded-lg p-2 flex-1 min-w-[200px]">
                    <div className="text-left space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-[9px] font-black uppercase px-1 rounded', linkedTrade.direction === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                          {linkedTrade.direction}
                        </span>
                        <span className="text-xs font-bold text-white">{linkedTrade.symbol}</span>
                      </div>
                      <p className="text-[10px] text-[#64748B] font-mono">Entry: {linkedTrade.entry_price} • Exit: {linkedTrade.exit_price}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className={cn('text-xs font-mono font-black', (linkedTrade.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                        {formatCurrency(linkedTrade.net_profit ?? 0)}
                      </span>
                      <button type="button" onClick={() => setLinkedTrade(null)} className="text-[#EF4444] text-xs font-bold">×</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Compose Toolbar Controls */}
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="compose-image-uploader"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files?.[0]) handleImageUpload(e.target.files[0])
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => document.getElementById('compose-image-uploader')?.click()}
                  className="p-2 hover:bg-white/5 rounded-xl border border-white/5 text-[#64748B] hover:text-white transition-colors cursor-pointer"
                >
                  {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTradeModal(true)}
                  className="p-2 hover:bg-white/5 rounded-xl border border-white/5 text-[#64748B] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span className="text-[9px] uppercase font-bold tracking-wider hidden sm:inline">Link Trade</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#38BDF8] hover:bg-[#7DD3FC] text-black font-black uppercase tracking-wider text-[10px] rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {submitting ? 'Publishing...' : <><Send className="w-3.5 h-3.5" /> Share Idea</>}
              </button>
            </div>
          </form>

          {/* Social Posts Feed Grid */}
          <div className="space-y-4">
            {posts.map(post => (
              <div key={post.id} className="bg-[#0D1421]/60 border border-white/5 rounded-2xl p-5 backdrop-blur-md space-y-4 text-left">
                {/* Post Author info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center font-bold text-white select-none cursor-pointer" onClick={() => post.profiles?.username && onOpenProfile(post.profiles.username)}>
                      {post.profiles?.avatar_url ? (
                        <img src={post.profiles.avatar_url} alt={post.profiles.username} className="w-full h-full object-cover" />
                      ) : (
                        post.profiles?.username?.charAt(0).toUpperCase() || '?'
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-white cursor-pointer hover:underline" onClick={() => post.profiles?.username && onOpenProfile(post.profiles.username)}>
                        {post.profiles?.display_name || post.profiles?.username || 'Trader'}
                      </p>
                      <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">{post.profiles?.headline || 'Standard Goldbook member'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#64748B] font-mono">{format(new Date(post.created_at), 'MMM d, HH:mm')}</span>
                </div>

                {/* Content */}
                <p className="text-xs text-[#94A3B8] leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>

                {/* Media Image Grid Carousel */}
                {post.media_urls?.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 rounded-xl overflow-hidden border border-white/5 bg-black/40">
                    {post.media_urls.map((url: string, i: number) => (
                      <img key={i} src={url} alt="Post content" className="w-full h-auto object-cover max-h-[380px]" />
                    ))}
                  </div>
                )}

                {/* Linked Trade Card embed */}
                {post.trades && (
                  <div className="bg-[#060A12]/80 border border-white/5 rounded-xl p-3.5 space-y-2 max-w-xl">
                    <div className="flex justify-between items-center text-[9px] font-mono text-[#64748B]">
                      <span className="uppercase tracking-widest font-black text-primary/80">Linked Verification Log</span>
                      <span className="uppercase tracking-widest font-bold">Closed Position</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded border', post.trades.direction === 'buy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-red-500/10 text-red-400 border-red-500/15')}>
                          {post.trades.direction} {post.trades.lot_size} Lots
                        </span>
                        <span className="text-xs font-black text-white">{post.trades.symbol}</span>
                      </div>
                      <span className={cn('text-xs font-mono font-black', (post.trades.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                        {formatCurrency(post.trades.net_profit ?? 0)}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#64748B] font-mono">Entry: {post.trades.entry_price} • Exit: {post.trades.exit_price}</p>
                  </div>
                )}

                {/* Footer Interaction buttons */}
                <div className="flex items-center gap-5 border-t border-white/5 pt-3 text-[#64748B]">
                  <button onClick={() => handleLikeToggle(post)} className={cn('flex items-center gap-1.5 text-xs hover:text-white transition-all cursor-pointer', post.hasLiked && 'text-rose-500 hover:text-rose-400')}>
                    <Heart className={cn('w-4 h-4', post.hasLiked && 'fill-rose-500')} />
                    <span className="font-bold tabular-nums">{post.likes_count || 0}</span>
                  </button>
                  <button onClick={() => handleCommentsToggle(post.id)} className={cn('flex items-center gap-1.5 text-xs hover:text-white transition-all cursor-pointer', activeCommentsPostId === post.id && 'text-primary')}>
                    <MessageSquare className="w-4 h-4" />
                    <span className="font-bold tabular-nums">{post.comments_count || 0}</span>
                  </button>
                </div>

                {/* Expandable Comments Section Drawer */}
                {activeCommentsPostId === post.id && (
                  <div className="border-t border-white/5 pt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-3">
                      {loadingComments ? (
                        <div className="flex items-center gap-2 text-xs text-[#64748B]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing comments...
                        </div>
                      ) : comments.length === 0 ? (
                        <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">No comments yet. Write the first reply!</p>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
                          {comments.map(c => (
                            <div key={c.id} className="flex items-start gap-2.5 text-xs">
                              <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center font-bold text-white shrink-0">
                                {c.profiles?.avatar_url ? (
                                  <img src={c.profiles.avatar_url} alt="author" className="w-full h-full object-cover" />
                                ) : (
                                  c.profiles?.username?.charAt(0).toUpperCase() || '?'
                                )}
                              </div>
                              <div className="bg-[#060A12]/80 border border-white/5 rounded-xl px-3 py-2 flex-1">
                                <div className="flex justify-between items-baseline mb-0.5">
                                  <span className="font-extrabold text-white">{c.profiles?.display_name || c.profiles?.username || 'Trader'}</span>
                                  <span className="text-[9px] text-[#64748B] font-mono">{format(new Date(c.created_at), 'HH:mm')}</span>
                                </div>
                                <p className="text-[#94A3B8] leading-relaxed">{c.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="flex gap-2">
                      <input
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Write a reply..."
                        className="flex-1 bg-[#060A12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50 placeholder-[#64748B]"
                        required
                      />
                      <button type="submit" className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 cursor-pointer">
                        Reply
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && !loading && (
            <button
              onClick={() => fetchPosts()}
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-wider text-white transition-all cursor-pointer"
            >
              Load More Ideas
            </button>
          )}

          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Trade Selector Linker Modal */}
      {showTradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0D1421] border border-white/10 rounded-2xl w-full max-w-md p-5 flex flex-col h-[400px] shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3 shrink-0">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Select a Trade to Link</h4>
              <button onClick={() => setShowTradeModal(false)} className="text-[#64748B] hover:text-white">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
              {closedTradesOnly.length === 0 ? (
                <p className="text-center text-xs text-[#64748B] uppercase tracking-wider font-bold py-12">No closed trades found to link.</p>
              ) : (
                closedTradesOnly.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setLinkedTrade(t)
                      setShowTradeModal(false)
                    }}
                    className="w-full text-left p-3 rounded-xl bg-[#060A12] border border-white/5 hover:border-primary/30 hover:bg-white/2 transition-all flex justify-between items-center cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-[9px] font-black uppercase px-1 rounded', t.direction === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                          {t.direction}
                        </span>
                        <span className="text-xs font-bold text-white">{t.symbol}</span>
                      </div>
                      <span className="text-[10px] text-[#64748B] font-mono leading-none mt-0.5 block">{format(new Date(t.close_time || ''), 'yyyy-MM-dd')}</span>
                    </div>
                    <span className={cn('text-xs font-mono font-black', (t.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                      {formatCurrency(t.net_profit ?? 0)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
