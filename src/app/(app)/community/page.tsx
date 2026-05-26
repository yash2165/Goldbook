'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts } from '@/hooks/useAccounts'
import { computeStats, fmt } from '@/lib/calculations'
import { 
  Send, 
  Hash, 
  Users, 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Bot, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Paperclip, 
  X, 
  Mic, 
  UserPlus, 
  Smile, 
  AlertTriangle,
  Volume2
} from 'lucide-react'
import { format } from 'date-fns'
import { UserProfileModal } from '@/components/community/UserProfileModal'
import { cn } from '@/lib/utils'
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  VideoConference, 
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks
} from '@livekit/components-react'
import { Track } from 'livekit-client'

// Import LiveKit's default themes and layout styling
import '@livekit/components-styles'
import { useToast } from '@/context/ToastContext'

const CHANNELS = [
  { id: 'general', name: 'general', icon: Hash },
  { id: 'xauusd', name: 'xauusd', icon: Hash },
  { id: 'signals', name: 'signals', icon: Hash },
  { id: 'ai-insights', name: 'ai-insights', icon: Bot },
]

interface Message {
  id: string
  user_id: string
  channel: string
  content: string
  created_at: string
  image_url?: string
  shared_trade_id?: string
  profiles?: { username: string; avatar_url?: string }
  trades?: { 
    symbol: string; 
    direction: string; 
    entry_price: number; 
    net_profit: number; 
    status: string;
    source?: string;
    lot_size?: number;
    exit_price?: number;
    pips?: number;
    rr_ratio?: number;
    setup_tag?: string;
  }
}

export default function CommunityPage() {
  const [tab, setTab] = useState<'chat' | 'leaderboard' | 'friends' | 'voice'>('chat')
  const [channel, setChannel] = useState('general')
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [friends, setFriends] = useState<{id: string, username: string}[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { success: showSuccess, error: showError } = useToast()

  // LiveKit persistent voice connection state
  const [voiceToken, setVoiceToken] = useState('')
  const [voiceServerUrl, setVoiceServerUrl] = useState('')
  const [voiceConnected, setVoiceConnected] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)

  const joinVoiceRoom = async () => {
    setVoiceLoading(true)
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: 'trading-floor' })
      })
      const data = await res.json()
      if (data.token) {
        setVoiceToken(data.token)
        setVoiceServerUrl(data.url)
        setVoiceConnected(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setVoiceLoading(false)
    }
  }

  const leaveVoiceRoom = () => {
    setVoiceConnected(false)
    setVoiceToken('')
    setVoiceServerUrl('')
  }

  // Real-time broadcast states
  const [broadcastReactions, setBroadcastReactions] = useState<Record<string, Record<string, string[]>>>({})
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [isUserTypingState, setIsUserTypingState] = useState(false)

  // Ref tracking current active Supabase channel
  const channelRef = useRef<any>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Share Trade state
  const [showShareModal, setShowShareModal] = useState(false)
  const [myTrades, setMyTrades] = useState<any[]>([])
  const [selectedTrade, setSelectedTrade] = useState<any>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)

  // Quick Emoji Picker panel visibility
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false)

  const loadFriendsList = async (userId: string) => {
    const { data: fData } = await supabase.from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted')
    
    if (fData && fData.length > 0) {
      const friendIds = fData.map((f: any) => f.user_id === userId ? f.friend_id : f.user_id)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', friendIds)
      
      if (profilesData) {
        setFriends(profilesData.map((p: any) => ({
          id: p.id,
          username: p.username || 'Unknown',
          avatar_url: p.avatar_url || ''
        })))
      }
    } else {
      setFriends([])
    }
  }

  const handleAddFriendByUsername = async (username: string) => {
    if (!user) return { error: 'Not authenticated' }
    const cleanUsername = username.toLowerCase().trim()
    if (!cleanUsername) return { error: 'Please enter a username.' }

    // 1. Find profile by username
    const { data: profileData, error: profErr } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', cleanUsername)
      .single()

    if (profErr || !profileData) {
      return { error: `Trader '${username}' not found. Verify they have created a profile.` }
    }

    if (profileData.id === user.id) {
      return { error: "You cannot add yourself as a friend." }
    }

    // 2. Insert or check friendship
    const { data: existingFriendship } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${profileData.id}),and(user_id.eq.${profileData.id},friend_id.eq.${user.id})`)
      .maybeSingle()

    if (existingFriendship) {
      if (existingFriendship.status === 'accepted') {
        return { error: `${profileData.username} is already your friend.` }
      }
      // If pending, instantly accept it!
      const { error: updErr } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', existingFriendship.id)
      
      if (updErr) return { error: updErr.message }
      await loadFriendsList(user.id)
      return { success: `Instantly established friendship with ${profileData.username}!` }
    }

    // Otherwise insert new accepted friendship instantly
    const { error: insErr } = await supabase
      .from('friendships')
      .insert({
        user_id: user.id,
        friend_id: profileData.id,
        status: 'accepted'
      })

    if (insErr) {
      return { error: insErr.message }
    }

    await loadFriendsList(user.id)
    return { success: `Instantly established friendship with ${profileData.username}!` }
  }

  // Load current user, profile and friends
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user)
        
        // Load personal profile
        const { data: pData } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', data.user.id)
          .single()
        if (pData) setMyProfile(pData)

        // Load friends bidirectionally
        await loadFriendsList(data.user.id)

        // Load trades for sharing
        const { data: tData } = await supabase.from('trades')
          .select('*')
          .eq('user_id', data.user.id)
          .order('open_time', { ascending: false })
          .limit(20)
        if (tData) setMyTrades(tData)
      }
    })
  }, [])

  // Load persistent emoji reactions from cache when channel changes
  useEffect(() => {
    const cached = localStorage.getItem(`reactions_${channel}`)
    if (cached) {
      try {
        setBroadcastReactions(JSON.parse(cached))
      } catch (e) {
        console.error(e)
      }
    } else {
      setBroadcastReactions({})
    }
    setTypingUsers([])
  }, [channel])

  // Load messages + realtime channels & broadcasts
  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(username, avatar_url), trades(symbol, direction, entry_price, net_profit, status, source, lot_size, exit_price, pips, rr_ratio, setup_tag)')
        .eq('channel', channel)
        .order('created_at', { ascending: true })
        .limit(50)
      setMessages((data as Message[]) ?? [])
    }
    loadMessages()

    // Establish channel with broadcast configuration enabled
    const sub = supabase.channel(`chat-${channel}`, {
      config: {
        broadcast: { self: false } // don't loop broadcasts back to publisher
      }
    })
    
    // Listen for database inserts
    sub.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel=eq.${channel}` },
      async (payload) => {
        const { data } = await supabase
          .from('messages')
          .select('*, profiles(username, avatar_url), trades(symbol, direction, entry_price, net_profit, status, source, lot_size, exit_price, pips, rr_ratio, setup_tag)')
          .eq('id', payload.new.id)
          .single()
        if (data) setMessages(m => [...m, data as Message])
      })
    
    // Listen for real-time emoji reactions broadcast
    sub.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      setBroadcastReactions(prev => {
        const key = payload.messageId
        const current = prev[key] || {}
        const users = current[payload.emoji] || []
        
        let nextUsers
        if (users.includes(payload.userId)) {
          nextUsers = users.filter(u => u !== payload.userId)
        } else {
          nextUsers = [...users, payload.userId]
        }
        
        const updated = {
          ...prev,
          [key]: {
            ...current,
            [payload.emoji]: nextUsers
          }
        }
        localStorage.setItem(`reactions_${channel}`, JSON.stringify(updated))
        return updated
      })
    })

    // Listen for typing indicator broadcast
    sub.on('broadcast', { event: 'typing' }, ({ payload }) => {
      setTypingUsers(prev => {
        if (payload.isTyping) {
          if (prev.includes(payload.username)) return prev
          return [...prev, payload.username]
        } else {
          return prev.filter(u => u !== payload.username)
        }
      })
    })

    sub.subscribe()
    channelRef.current = sub

    return () => { 
      supabase.removeChannel(sub) 
      channelRef.current = null
    }
  }, [channel])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle key input change and trigger debounced typing broadcasts
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMsg(e.target.value)
    
    if (!user) return
    
    const myName = myProfile?.username || user.email?.split('@')[0] || 'Trader'

    if (!isUserTypingState && e.target.value.trim() !== '') {
      setIsUserTypingState(true)
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { username: myName, isTyping: true }
        })
      }
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsUserTypingState(false)
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { username: myName, isTyping: false }
        })
      }
    }, 1500)
  }

  // Toggle emoji reactions on messages and broadcast to channel
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return
    
    setBroadcastReactions(prev => {
      const current = prev[messageId] || {}
      const users = current[emoji] || []
      let nextUsers
      if (users.includes(user.id)) {
        nextUsers = users.filter(u => u !== user.id)
      } else {
        nextUsers = [...users, user.id]
      }
      
      const updated = {
        ...prev,
        [messageId]: {
          ...current,
          [emoji]: nextUsers
        }
      }
      localStorage.setItem(`reactions_${channel}`, JSON.stringify(updated))
      return updated
    })

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { messageId, emoji, userId: user.id }
      })
    }
  }

  const send = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if ((!newMsg.trim() && !selectedTrade && !imageUrl && !imageFile) || !user) return
    
    setSending(true)
    
    let uploadedUrl = imageUrl
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const fileName = `${Math.random()}.${ext}`
      const { data: uploadData, error } = await supabase.storage.from('chat_images').upload(fileName, imageFile)
      if (!error && uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('chat_images').getPublicUrl(fileName)
        uploadedUrl = publicUrl
      }
    }

    await supabase.from('messages').insert({ 
      user_id: user.id, 
      channel, 
      content: newMsg.trim() || (selectedTrade ? 'Shared a trade' : ''),
      shared_trade_id: selectedTrade?.id || null,
      image_url: uploadedUrl || null
    })
    
    // Clear state
    setNewMsg('')
    setSelectedTrade(null)
    setImageUrl('')
    setImageFile(null)
    setShowShareModal(false)
    setSending(false)

    // Stop typing state
    setIsUserTypingState(false)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { username: myProfile?.username || user.email?.split('@')[0] || 'Trader', isTyping: false }
      })
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (showShareModal && e.clipboardData.files.length > 0) {
      setImageFile(e.clipboardData.files[0])
    }
  }

  const selectEmoji = (emoji: string) => {
    setNewMsg(prev => prev + emoji)
    setShowEmojiDropdown(false)
  }

  const mainContent = (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden" onPaste={handlePaste}>
      {/* Left channel list */}
      <div className="w-56 bg-[#0c0c14] border-r border-white/5 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-white/5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#64748B]">Channels</p>
        </div>
        <div className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => { setChannel(ch.id); setTab('chat') }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all text-left',
                channel === ch.id && tab === 'chat' ? 'bg-[#38BDF8]/10 text-[#38BDF8]' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
              )}
            >
              <ch.icon className="w-4 h-4 shrink-0" />
              {ch.name}
            </button>
          ))}
          
          {/* DMs */}
          {friends.length > 0 && (
            <>
              <div className="pt-5 pb-1 px-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#334155]">Direct Messages</p>
              </div>
              {friends.map(f => {
                const dmChannelId = `dm_${[user?.id, f.id].sort().join('_')}`
                return (
                  <button
                    key={f.id}
                    onClick={() => { setChannel(dmChannelId); setTab('chat') }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                      channel === dmChannelId && tab === 'chat' ? 'bg-[#38BDF8]/10 text-[#38BDF8]' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
                    )}
                  >
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">
                      {f.username.charAt(0).toUpperCase()}
                    </div>
                    {f.username}
                  </button>
                )
              })}
            </>
          )}
        </div>
        
        {/* Navigation bottom menu options */}
        <div className="px-2 pb-3 border-t border-white/5 pt-3 space-y-1">
          <button
            onClick={() => setTab('friends')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors',
              tab === 'friends' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
            )}
          >
            <Users className="w-4 h-4" /> Friends
          </button>
          <button
            onClick={() => setTab('voice')}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors group/voice',
              tab === 'voice' ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
            )}
          >
            <div className="flex items-center gap-2.5">
              <Mic className={cn("w-4 h-4 transition-transform group-hover/voice:scale-110", voiceConnected && "text-[#22C55E] animate-pulse")} /> 
              <span>Voice Floor</span>
            </div>
            {voiceConnected && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping" />
            )}
          </button>
          <button
            onClick={() => setTab('leaderboard')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors',
              tab === 'leaderboard' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
            )}
          >
            <Trophy className="w-4 h-4" /> Leaderboard
          </button>
        </div>
      </div>

      {/* Main Chat space panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#07070b]">
        {tab === 'chat' ? (
          <>
            {/* Channel header */}
            <div className="h-12 border-b border-white/5 px-5 flex items-center justify-between shrink-0 bg-[#0d0d14]">
              <div className="flex items-center gap-2">
                {channel.startsWith('dm_') ? (
                  <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">@</div>
                ) : (
                  <Hash className="w-4 h-4 text-[#64748B]" />
                )}
                <span className="font-bold text-xs uppercase tracking-wider text-white/90">
                  {channel.startsWith('dm_') ? (() => {
                    const parts = channel.replace('dm_', '').split('_')
                    const friendId = parts.find(id => id !== user?.id)
                    const friend = friends.find(f => f.id === friendId)
                    return friend ? `@${friend.username}` : 'Direct Message'
                  })() : channel}
                </span>
                <span className="ml-2 text-[10px] text-[#64748B] bg-white/5 px-2 py-0.5 rounded font-mono">{messages.length} messages</span>
              </div>
            </div>

            {/* Messages feed */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 bg-[radial-gradient(ellipse_at_top_right,rgba(245,159,11,0.015),transparent_60%)] custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center py-20 text-[#334155] text-xs font-semibold uppercase tracking-wider">
                  No transmissions in #{channel} yet. Be the first to broadcast!
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex gap-3', msg.user_id === user?.id && 'flex-row-reverse')}>
                  <button 
                    onClick={() => setSelectedUser(msg.user_id)}
                    className="w-8 h-8 rounded-lg overflow-hidden border border-[#38BDF8]/20 flex items-center justify-center shrink-0 text-xs font-bold text-[#38BDF8] hover:scale-105 transition-transform animate-in fade-in zoom-in-75 duration-300 bg-[#38BDF8]/10"
                  >
                    {msg.profiles?.avatar_url ? (
                      <img src={msg.profiles.avatar_url} alt={msg.profiles.username} className="w-full h-full object-cover" />
                    ) : (
                      (msg.profiles?.username ?? 'U').charAt(0).toUpperCase()
                    )}
                  </button>
                  
                  <div className={cn('max-w-md space-y-1', msg.user_id === user?.id && 'items-end flex flex-col')}>
                    <div className="flex items-center gap-2 text-[9px] text-[#64748B] px-1 font-semibold uppercase tracking-wider">
                      <button onClick={() => setSelectedUser(msg.user_id)} className="font-bold text-[#94A3B8] hover:text-[#38BDF8] hover:underline">
                        {msg.profiles?.username ?? 'Anonymous'}
                      </button>
                      <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                    </div>

                    {/* Unified Message Block with hover reaction bridge */}
                    <div className="group relative">
                      {/* Floating reaction picker panel */}
                      {user && (
                        <div className={cn(
                          "absolute bg-[#0D1421]/95 border border-white/10 rounded-full px-2.5 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md flex gap-2 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-20 -top-6 origin-bottom",
                          msg.user_id === user?.id ? "right-2" : "left-2"
                        )}>
                          {['🔥', '🚀', '👏', '🎯', '💎', '⚠️'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className="hover:scale-125 active:scale-95 transition-transform text-xs cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className={cn(
                        'overflow-hidden rounded-xl border flex flex-col shadow-md transition-all duration-200',
                        msg.trades && msg.trades.source !== 'manual'
                          ? 'bg-gradient-to-br from-[#1c1c2b]/95 via-[#10101a]/95 to-[#08080d]/95 border-[#38BDF8]/30 shadow-[0_10px_35px_rgba(56,189,248,0.06)] rounded-xl hover:border-[#38BDF8]/50'
                          : msg.user_id === user?.id
                            ? 'bg-[#38BDF8]/5 border-[#38BDF8]/20 rounded-tr-none'
                            : 'bg-[#10101a]/90 border-white/5 rounded-tl-none hover:border-white/10'
                      )}>
                        {msg.content && msg.content !== 'Shared a trade' && (
                          <div className={cn('px-4 py-3 text-sm leading-relaxed text-white/95 font-medium', (msg.trades || msg.image_url) && 'border-b border-white/5')}>
                            {msg.content}
                          </div>
                        )}

                        {/* Premium custom Sync Trade Embed Card */}
                        {msg.trades && (
                          <div className="bg-black/25 backdrop-blur-sm relative w-64 md:w-80 shadow-inner rounded-xl overflow-hidden">
                            {/* Card header */}
                            <div className={cn(
                              "px-3 py-2 flex items-center justify-between text-[9px] font-extrabold tracking-wider uppercase border-b border-white/[0.04]",
                              msg.trades.source !== 'manual' 
                                ? "bg-gradient-to-r from-[#38BDF8]/15 via-[#F59E0B]/5 to-transparent text-[#38BDF8]" 
                                : "bg-white/5 text-[#94A3B8]"
                            )}>
                              <span className="flex items-center gap-1.5">
                                {msg.trades.source !== 'manual' ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-ping" />
                                    🛡️ Verified MT5 Trade
                                  </>
                                ) : (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" />
                                    📝 Journal Entry
                                  </>
                                )}
                              </span>
                              <span className="font-mono text-[#64748B] text-[8px]">
                                {msg.trades.source !== 'manual' ? 'Sync: mt5' : 'Manual'}
                              </span>
                            </div>

                            {/* Trade metrics */}
                            <div className="p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                                    {msg.trades.symbol}
                                    {msg.trades.source !== 'manual' && (
                                      <span className="text-[#38BDF8] text-[10px]" title="Verified Sync">⚡</span>
                                    )}
                                  </h4>
                                  <span className={cn(
                                    "text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest mt-1 inline-block border",
                                    msg.trades.direction?.toLowerCase() === 'buy' ? "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20" : "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20"
                                  )}>
                                    {msg.trades.direction}
                                  </span>
                                </div>
                                
                                {msg.trades.status === 'closed' ? (
                                  <div className="text-right">
                                    <span className="text-[8px] text-[#64748B] uppercase font-bold tracking-wider block">Net Return</span>
                                    <span className={cn(
                                      "text-sm font-extrabold font-mono tracking-tight",
                                      (msg.trades.net_profit ?? 0) >= 0 ? "text-[#22C55E] drop-shadow-[0_0_8px_rgba(34,197,94,0.25)]" : "text-[#EF4444]"
                                    )}>
                                      {(msg.trades.net_profit ?? 0) >= 0 ? '+' : ''}{fmt(msg.trades.net_profit ?? 0)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-right flex items-center gap-1.5 text-[9px] font-bold text-[#F59E0B] uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-ping" />
                                    Active Running
                                  </div>
                                )}
                              </div>

                              {/* 2x3 Grid */}
                              <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-white/[0.04] text-[10px] text-[#64748B]">
                                <div>
                                  <span className="block text-[8px] uppercase tracking-wider font-semibold">Lots</span>
                                  <span className="font-bold text-white/90 font-mono">{msg.trades.lot_size ? msg.trades.lot_size.toFixed(2) : 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] uppercase tracking-wider font-semibold">Entry</span>
                                  <span className="font-bold text-white/90 font-mono">{msg.trades.entry_price ? msg.trades.entry_price.toFixed(2) : 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] uppercase tracking-wider font-semibold">Exit</span>
                                  <span className="font-bold text-white/90 font-mono">{msg.trades.exit_price ? msg.trades.exit_price.toFixed(2) : 'Ticking'}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] uppercase tracking-wider font-semibold">Pips</span>
                                  <span className={cn("font-bold font-mono", (msg.trades.pips ?? 0) >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                                    {msg.trades.pips ? `${msg.trades.pips >= 0 ? '+' : ''}${msg.trades.pips.toFixed(1)}` : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[8px] uppercase tracking-wider font-semibold">R:R Ratio</span>
                                  <span className="font-bold text-white/90 font-mono">{msg.trades.rr_ratio ? `1:${msg.trades.rr_ratio.toFixed(1)}` : 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] uppercase tracking-wider font-semibold">Setup</span>
                                  <span className="font-bold text-[#38BDF8] uppercase tracking-wide truncate max-w-[70px] block">{msg.trades.setup_tag || 'Unset'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Attached Image */}
                        {msg.image_url && (
                          <div className="w-64 md:w-80">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.image_url} alt="Shared chart" className="w-full h-auto object-cover max-h-64 object-top" />
                          </div>
                        )}

                        {/* Render Tallied Reactions under message body */}
                        {Object.entries(broadcastReactions[msg.id] || {}).filter(([_, users]) => users.length > 0).length > 0 && (
                          <div className="flex flex-wrap gap-1 px-3 pb-2 pt-1.5 border-t border-white/[0.04] bg-black/10">
                            {Object.entries(broadcastReactions[msg.id] || {}).map(([emoji, users]) => {
                              if (users.length === 0) return null
                              const hasReacted = user && users.includes(user.id)
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(msg.id, emoji)}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors font-bold cursor-pointer",
                                    hasReacted 
                                      ? "bg-[#38BDF8]/20 border-[#38BDF8]/30 text-[#38BDF8]" 
                                      : "bg-white/5 border-white/5 text-[#64748B] hover:text-white"
                                  )}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-mono text-[9px]">{users.length}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Typing indicator alerts bar */}
            {typingUsers.length > 0 && (
              <div className="px-5 py-1 text-[10px] text-[#38BDF8] italic font-semibold font-sans bg-black/10 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            {/* Inputs bar */}
            <div className="px-5 py-4 border-t border-white/5 bg-[#0d0d14] relative">
              
              {/* Floating Emoji picker drawer */}
              {showEmojiDropdown && (
                <div className="absolute bottom-full mb-2 left-5 bg-[#0f0f18] border border-white/10 p-3 rounded-xl shadow-2xl flex gap-2 z-50">
                  {['🔥', '🚀', '👏', '🎯', '💎', '⚠️', '📈', '📉', '🤑', '🏆'].map(emoji => (
                    <button 
                      key={emoji} 
                      onClick={() => selectEmoji(emoji)}
                      className="hover:scale-125 transition-transform text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button onClick={() => setShowEmojiDropdown(false)} className="text-[10px] text-[#64748B] hover:text-white font-bold ml-1">Close</button>
                </div>
              )}

              <form onSubmit={send} className="flex items-center gap-3 bg-[#10101a] border border-white/10 rounded-xl px-2 py-1.5 focus-within:border-primary/50 transition-colors">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    className="p-2 text-[#64748B] hover:text-white transition-colors"
                    title="Share a trade or screenshot"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmojiDropdown(!showEmojiDropdown)}
                    className="p-2 text-[#64748B] hover:text-white transition-colors"
                    title="Insert Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>

                <input
                  value={newMsg}
                  onChange={handleInputChange}
                  placeholder={user ? `Message #${channel}...` : 'Sign in to chat'}
                  disabled={!user || sending}
                  className="flex-1 bg-transparent border-none text-sm focus:outline-none placeholder:text-[#334155]"
                />
                <button
                  type="submit"
                  disabled={(!newMsg.trim() && !selectedTrade && !imageUrl && !imageFile) || !user || sending}
                  className="w-8 h-8 rounded-lg bg-[#38BDF8] hover:bg-[#38BDF8]/95 flex items-center justify-center transition-colors disabled:opacity-40 text-black font-bold"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : tab === 'leaderboard' ? (
          <LeaderboardTab />
        ) : tab === 'friends' ? (
          <FriendsTab 
            friends={friends} 
            user={user} 
            onMessage={(dm) => { setChannel(dm); setTab('chat') }} 
            onAddFriend={handleAddFriendByUsername} 
          />
        ) : tab === 'voice' ? (
          <VoiceTab connected={voiceConnected} loading={voiceLoading} onConnect={joinVoiceRoom} onDisconnect={leaveVoiceRoom} />
        ) : null}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-[#0D1421] border border-white/10 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Share Trade & Chart</h2>
              <button onClick={() => setShowShareModal(false)} className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-white/5 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Select Trade */}
              <div>
                <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-2 block">Link a Trade (Optional)</label>
                <select 
                  value={selectedTrade?.id || ''}
                  onChange={e => setSelectedTrade(myTrades.find(t => t.id === e.target.value) || null)}
                  className="w-full bg-[#0D1421] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark] appearance-none"
                >
                  <option value="">-- No trade selected --</option>
                  {myTrades.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.status.toUpperCase()}: {t.symbol} {t.direction.toUpperCase()} @ {t.entry_price} {t.status === 'closed' ? `(${fmt(t.net_profit)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Attach Image / Link */}
              <div>
                <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-2 block flex items-center justify-between">
                  <span>Attach Screenshot (Optional)</span>
                  <span className="text-[#64748B] text-[10px] font-normal lowercase">Ctrl+V to paste image</span>
                </label>
                
                {imageFile ? (
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-white truncate max-w-[200px] flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-primary" /> {imageFile.name}
                    </span>
                    <button onClick={() => setImageFile(null)} className="text-[#EF4444] text-xs font-bold">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <LinkIcon className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
                      <input
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        placeholder="Paste TradingView image link..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <label className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-[#64748B]" />
                      <input type="file" className="hidden" accept="image/*" onChange={e => {
                        if (e.target.files?.[0]) setImageFile(e.target.files[0])
                      }} />
                    </label>
                  </div>
                )}
              </div>
              
              <div className="pt-2">
                <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-2 block">Comment (Optional)</label>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Add a comment to your trade..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                />
              </div>

              <button
                onClick={() => send()}
                disabled={(!newMsg.trim() && !selectedTrade && !imageUrl && !imageFile) || sending}
                className="w-full py-2.5 bg-[#38BDF8] hover:bg-[#38BDF8]/95 disabled:opacity-40 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#38BDF8]/25 flex items-center justify-center gap-2 text-black"
              >
                {sending ? 'Sending...' : <><Send className="w-4 h-4" /> Share to #{channel}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {voiceConnected && tab !== 'voice' && (
        <div className="fixed bottom-6 right-6 bg-[#0c0c14]/95 border border-[#8B5CF6]/30 px-4 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-xl z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]"></span>
            </span>
            <div className="text-left">
              <p className="text-[10px] font-black text-[#F1F5F9] uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-[#38BDF8]" /> Trading Floor
              </p>
              <p className="text-[8px] text-[#8B5CF6] uppercase tracking-widest font-extrabold mt-0.5">Voice Room Active</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-white/5 pl-4">
            <button 
              onClick={() => setTab('voice')}
              className="px-3 py-1.5 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 rounded-lg text-[9px] font-bold uppercase tracking-wider text-[#8B5CF6] transition-all cursor-pointer border border-[#8B5CF6]/20"
            >
              View Grid
            </button>
            <button 
              onClick={leaveVoiceRoom}
              className="px-3 py-1.5 bg-[#EF4444]/15 hover:bg-[#EF4444]/25 rounded-lg text-[9px] font-bold uppercase tracking-wider text-[#EF4444] transition-all cursor-pointer border border-[#EF4444]/20"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {selectedUser && (
        <UserProfileModal 
          userId={selectedUser} 
          currentUserId={user?.id}
          onClose={() => setSelectedUser(null)} 
          onMessage={(channelId) => {
            setChannel(channelId)
            setTab('chat')
            setSelectedUser(null)
          }}
        />
      )}
    </div>
  )

  if (voiceConnected && voiceToken && voiceServerUrl) {
    return (
      <LiveKitRoom
        video={true}
        audio={true}
        token={voiceToken}
        serverUrl={voiceServerUrl}
        data-lk-theme="default"
        style={{ 
          height: '100%', 
          background: 'transparent', 
          '--lk-bg': 'transparent', 
          '--lk-control-bar-bg': 'rgba(0,0,0,0.4)', 
          '--lk-border-color': 'rgba(255,255,255,0.05)',
          '--lk-grid-gap': '16px'
        } as any}
        onDisconnected={leaveVoiceRoom}
      >
        {mainContent}
        <RoomAudioRenderer />
      </LiveKitRoom>
    )
  }

  return mainContent
}

function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLeaderboard(data)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch leaderboard:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-[#07070b] flex flex-col items-center justify-center min-h-[350px]">
        <Trophy className="w-8 h-8 text-primary/40 animate-[pulse_1.5s_infinite] mb-3" />
        <div className="text-center text-[#64748B] text-[10px] font-black uppercase tracking-widest animate-pulse">
          Syncing global standings...
        </div>
      </div>
    )
  }

  const top3 = leaderboard.slice(0, 3)
  const remaining = leaderboard.slice(3)


  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#07070b]">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-6 h-6 text-[#38BDF8] drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]" />
          <h2 className="text-lg font-black uppercase tracking-wider text-white">Community Leaderboard</h2>
        </div>

        {leaderboard.length === 0 ? (
          <div className="bg-[#0D1421] border border-white/5 rounded-xl py-16 text-center text-[#64748B] text-xs font-bold uppercase tracking-wider">
            No traders on the leaderboard yet
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Esport-Style 3D Podium for Top 3 */}
            <div className="grid grid-cols-3 gap-4 items-end max-w-xl mx-auto pt-6 pb-4 border-b border-white/5">
              
              {/* 2nd Place (Silver) */}
              {top3[1] ? (
                <div className="flex flex-col items-center">
                  <div className="relative group mb-2">
                    <div className="w-16 h-16 rounded-full bg-slate-800/80 border-2 border-slate-300 flex items-center justify-center font-bold text-slate-300 text-lg shadow-[0_0_15px_rgba(203,213,225,0.2)] select-none overflow-hidden">
                      {top3[1].avatar_url ? (
                        <img src={top3[1].avatar_url} alt={top3[1].username} className="w-full h-full object-cover" />
                      ) : (
                        top3[1].username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="absolute -top-2 -right-2 text-lg">🥈</span>
                  </div>
                  <div className="text-center mb-2">
                    <p className="font-bold text-white text-xs truncate max-w-[85px]">{top3[1].username}</p>
                    <p className="text-[10px] text-slate-300 font-mono font-bold">{fmt(top3[1].pnl)}</p>
                  </div>
                  <div className="w-full bg-[#181825]/80 border border-slate-300/10 rounded-t-xl h-24 flex flex-col items-center justify-center p-2 shadow-lg relative overflow-hidden text-center">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-400 to-slate-200" />
                    <span className="text-slate-300 text-[9px] font-black tracking-widest uppercase">RANK #2</span>
                    <span className="text-[9px] text-[#64748B] mt-1">{top3[1].trades} Trades</span>
                    <span className="text-[8px] text-[#22C55E]/80 font-mono mt-0.5 font-bold">WR: {top3[1].winRate}% • {top3[1].mostTraded}</span>
                  </div>
                </div>
              ) : (
                <div className="h-10" />
              )}

              {/* 1st Place (Gold) */}
              {top3[0] ? (
                <div className="flex flex-col items-center">
                  <div className="relative group mb-2 scale-110">
                    <div className="w-20 h-20 rounded-full bg-sky-950/40 border-2 border-[#38BDF8] flex items-center justify-center font-bold text-[#38BDF8] text-xl shadow-[0_0_25px_rgba(56,189,248,0.3)] animate-[pulse_2s_infinite] select-none overflow-hidden">
                      {top3[0].avatar_url ? (
                        <img src={top3[0].avatar_url} alt={top3[0].username} className="w-full h-full object-cover" />
                      ) : (
                        top3[0].username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="absolute -top-3 -right-2 text-2xl animate-bounce">👑</span>
                  </div>
                  <div className="text-center mb-3 scale-105">
                    <p className="font-extrabold text-white text-sm truncate max-w-[100px]">{top3[0].username}</p>
                    <p className="text-xs text-primary font-mono font-black">{fmt(top3[0].pnl)}</p>
                  </div>
                  <div className="w-full bg-[#1c1c2e]/90 border border-primary/20 rounded-t-2xl h-32 flex flex-col items-center justify-center p-3 shadow-2xl shadow-primary/5 relative overflow-hidden text-center">
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-yellow-300 via-primary to-amber-500" />
                    <span className="text-[#38BDF8] text-xs font-black tracking-widest uppercase animate-pulse">CHAMPION</span>
                    <span className="text-[9px] text-[#64748B] mt-1">{top3[0].trades} Trades</span>
                    <span className="text-[8px] text-primary/80 font-mono mt-0.5 font-bold">WR: {top3[0].winRate}% • {top3[0].mostTraded}</span>
                  </div>
                </div>
              ) : (
                <div className="h-10" />
              )}

              {/* 3rd Place (Bronze) */}
              {top3[2] ? (
                <div className="flex flex-col items-center">
                  <div className="relative group mb-2">
                    <div className="w-16 h-16 rounded-full bg-[#3d2719]/40 border-2 border-[#CD7F32] flex items-center justify-center font-bold text-[#CD7F32] text-lg shadow-[0_0_15px_rgba(205,127,50,0.2)] select-none overflow-hidden">
                      {top3[2].avatar_url ? (
                        <img src={top3[2].avatar_url} alt={top3[2].username} className="w-full h-full object-cover" />
                      ) : (
                        top3[2].username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="absolute -top-2 -right-2 text-lg">🥉</span>
                  </div>
                  <div className="text-center mb-2">
                    <p className="font-bold text-white text-xs truncate max-w-[85px]">{top3[2].username}</p>
                    <p className="text-[10px] text-[#CD7F32] font-mono font-bold">{fmt(top3[2].pnl)}</p>
                  </div>
                  <div className="w-full bg-[#181825]/80 border border-[#CD7F32]/10 rounded-t-xl h-20 flex flex-col items-center justify-center p-2 shadow-lg relative overflow-hidden text-center">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#CD7F32] to-[#A0522D]" />
                    <span className="text-[#CD7F32] text-[9px] font-black tracking-widest uppercase">RANK #3</span>
                    <span className="text-[9px] text-[#64748B] mt-1">{top3[2].trades} Trades</span>
                    <span className="text-[8px] text-[#CD7F32]/80 font-mono mt-0.5 font-bold">WR: {top3[2].winRate}% • {top3[2].mostTraded}</span>
                  </div>
                </div>
              ) : (
                <div className="h-10" />
              )}
            </div>

            {/* Ranks 4+ */}
            {remaining.length > 0 && (
              <div className="bg-[#0D1421]/60 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
                {remaining.map((entry, idx) => {
                  const rank = idx + 4
                  return (
                    <div key={entry.uid} className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.03] hover:bg-white/2 transition-colors">
                      <div className="w-8 text-center text-[#64748B] font-bold text-sm font-mono">
                        #{rank}
                      </div>
                      <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-white/90 overflow-hidden">
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt={entry.username} className="w-full h-full object-cover" />
                        ) : (
                          entry.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-white">{entry.username}</p>
                        <p className="text-xs text-[#64748B]">{entry.trades} trades • Win Rate: {entry.winRate}% • Most Traded: {entry.mostTraded}</p>
                      </div>
                      <div className={cn('font-bold tabular-nums text-sm font-mono', entry.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                        {fmt(entry.pnl)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FriendsTab({ 
  friends, 
  user, 
  onMessage, 
  onAddFriend 
}: { 
  friends: any[]
  user: any
  onMessage: (dm: string) => void
  onAddFriend: (username: string) => Promise<{ error?: string; success?: string }>
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [adding, setAdding] = useState(false)
  const { success: showSuccess, error: showError } = useToast()

  const handleAddClick = async () => {
    const targetUser = searchTerm.trim()
    if (!targetUser) return

    setAdding(true)
    try {
      const res = await onAddFriend(targetUser)
      if (res.error) {
        showError('Friend Request Failed', res.error)
      } else if (res.success) {
        showSuccess('Friend Added!', res.success)
        setSearchTerm('')
      }
    } catch (err) {
      console.error(err)
      showError('Action Failed', 'An unexpected error occurred.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#07070b]">
      <div className="max-w-xl space-y-6">
        <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-[#22C55E]" /> Friends & Following
        </h2>

        <div className="bg-[#0D1421]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/90 mb-4">Add a Friend</h3>
          <div className="flex gap-2">
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddClick()}
              disabled={adding}
              placeholder="Search by exact username..." 
              className="flex-1 bg-[#060A12] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 text-white disabled:opacity-50" 
            />
            <button 
              onClick={handleAddClick}
              disabled={adding || !searchTerm.trim()}
              className="px-4 py-2 bg-[#38BDF8] hover:bg-[#38BDF8]/95 text-black rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              <UserPlus className="w-4 h-4" /> {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>

        <div className="bg-[#0D1421]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/90 mb-4">Your Friends</h3>
          {friends.length === 0 ? (
            <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">You have no friends added yet.</p>
          ) : (
            <div className="space-y-2">
              {friends.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-[#0d1017] rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary relative overflow-hidden">
                      {f.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.avatar_url} alt={f.username} className="w-full h-full object-cover" />
                      ) : (
                        f.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="font-bold text-sm">{f.username}</span>
                  </div>
                  <button onClick={() => onMessage(`dm_${[user?.id, f.id].sort().join('_')}`)} className="text-xs text-primary hover:underline">Message</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function VoiceTab({ 
  connected, 
  loading, 
  onConnect, 
  onDisconnect 
}: { 
  connected: boolean
  loading: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  if (!connected) {
    return (
      <div className="flex-1 overflow-hidden p-6 h-full bg-[#07070b]">
        <div className="max-w-xl mx-auto mt-10 animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-[#0c0c14]/90 border border-white/10 rounded-3xl p-10 text-center space-y-6 shadow-2xl backdrop-blur-2xl">
            <div className="w-20 h-20 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center mx-auto text-[#8B5CF6] shadow-[0_0_30px_rgba(139,92,246,0.25)] border border-[#8B5CF6]/20 animate-pulse">
              <Mic className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-wider text-white">Trading Floor (Live Voice)</h2>
              <p className="text-[#64748B] text-xs max-w-sm mx-auto leading-relaxed font-semibold">
                Join the premium high-fidelity live voice and screensharing channel to discuss active setups, price action, and execute trades in synchrony.
              </p>
            </div>
            
            <button 
              onClick={onConnect}
              disabled={loading}
              className="px-8 py-3.5 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#8B5CF6]/20 transition-all hover:scale-105 w-full max-w-xs mx-auto flex justify-center items-center gap-2 border border-white/10 cursor-pointer"
            >
              {loading ? 'Negotiating Link...' : <><Mic className="w-4 h-4" /> Connect to Trading Floor</>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <VoiceRoomActive onDisconnect={onDisconnect} />
}

function VoiceRoomActive({ onDisconnect }: { onDisconnect: () => void }) {
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false })
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false })

  const hasScreenShare = screenShareTracks.length > 0

  return (
    <div className="flex-1 overflow-hidden p-6 h-full bg-[#07070b] flex flex-col">
      <div className="bg-[#0c0c14]/90 border border-white/10 rounded-2xl p-6 h-full flex flex-col shadow-[0_30px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl relative animate-in fade-in zoom-in-95 duration-300">
        
        {/* Live Room header */}
        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
          <h2 className="text-sm font-black flex items-center gap-3 tracking-widest uppercase">
            <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
            <span className="text-[#F1F5F9] flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#38BDF8]" />
              Trading Floor <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] to-[#F59E0B]">Live Broadcast</span>
            </span>
          </h2>
          <button 
            onClick={onDisconnect} 
            className="px-4 py-2 bg-[#EF4444]/10 text-[#EF4444] rounded-lg text-xs font-bold hover:bg-[#EF4444]/20 transition-all border border-[#EF4444]/20 uppercase tracking-widest cursor-pointer"
          >
            Disconnect Floor
          </button>
        </div>

        {/* Video & Screensharing Custom Layout */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6 min-h-[300px]">
          {hasScreenShare ? (
            <>
              {/* Main Screenshare container (Large) */}
              <div className="flex-[3] relative rounded-xl border border-[#38BDF8]/20 bg-black/60 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] group">
                <ParticipantTile trackRef={screenShareTracks[0]} className="w-full h-full object-contain" />
                <div className="absolute top-4 left-4 bg-black/60 border border-white/10 px-3 py-1.5 rounded-lg text-[9px] uppercase font-extrabold tracking-widest text-[#38BDF8] backdrop-blur-md">
                  🖥️ Live Presentation
                </div>
              </div>

              {/* Sidebar Cameras (Smaller list) */}
              <div className="flex-1 min-w-[200px] flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                {cameraTracks.map(track => (
                  <div key={track.publication?.trackSid || track.participant.sid} className="h-32 shrink-0 relative rounded-lg overflow-hidden border border-white/5 bg-black/30">
                    <ParticipantTile trackRef={track} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Normal Grid Layout for participants */
            <div className="flex-1 overflow-hidden rounded-xl border border-white/5 bg-black/40 shadow-inner">
              <GridLayout tracks={cameraTracks} className="h-full">
                <ParticipantTile />
              </GridLayout>
            </div>
          )}
        </div>
        
        {/* Floating Capsule style Control Bar */}
        <div className="mt-6 flex justify-center bg-black/20 p-2.5 rounded-xl border border-white/5 w-fit mx-auto">
          <ControlBar variation="minimal" controls={{ microphone: true, screenShare: true, camera: true, leave: false }} />
        </div>
      </div>
    </div>
  )
}
