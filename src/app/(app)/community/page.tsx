'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts } from '@/hooks/useAccounts'
import { computeStats, fmt } from '@/lib/calculations'
import { Send, Hash, Users, Trophy, TrendingUp, TrendingDown, Bot, Image as ImageIcon, Link as LinkIcon, Paperclip, X, Mic, UserPlus } from 'lucide-react'
import { format } from 'date-fns'
import { UserProfileModal } from '@/components/community/UserProfileModal'
import { cn } from '@/lib/utils'
import { LiveKitRoom, RoomAudioRenderer, AudioConference, ControlBar } from '@livekit/components-react'

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
  trades?: { symbol: string; direction: string; entry_price: number; net_profit: number; status: string }
}

export default function CommunityPage() {
  const [tab, setTab] = useState<'chat' | 'leaderboard' | 'friends' | 'voice'>('chat')
  const [channel, setChannel] = useState('general')
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [friends, setFriends] = useState<{id: string, username: string}[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Share Trade state
  const [showShareModal, setShowShareModal] = useState(false)
  const [myTrades, setMyTrades] = useState<any[]>([])
  const [selectedTrade, setSelectedTrade] = useState<any>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)

  // Load current user and friends
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user)
        // Load friends
        const { data: fData } = await supabase.from('friendships')
          .select('friend_id, profiles!friendships_friend_id_fkey(username)')
          .eq('user_id', data.user.id)
          .eq('status', 'accepted')
        
        if (fData) {
          setFriends(fData.map((f: any) => ({
            id: f.friend_id,
            username: f.profiles?.username || 'Unknown'
          })))
        }

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

  // Load messages + realtime
  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(username, avatar_url), trades(symbol, direction, entry_price, net_profit, status)')
        .eq('channel', channel)
        .order('created_at', { ascending: true })
        .limit(50)
      setMessages((data as Message[]) ?? [])
    }
    loadMessages()

    const sub = supabase.channel(`chat-${channel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel=eq.${channel}` },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select('*, profiles(username, avatar_url), trades(symbol, direction, entry_price, net_profit, status)')
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages(m => [...m, data as Message])
        })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [channel])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    
    setNewMsg('')
    setSelectedTrade(null)
    setImageUrl('')
    setImageFile(null)
    setShowShareModal(false)
    setSending(false)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    // If we're in the modal, handle image paste
    if (showShareModal && e.clipboardData.files.length > 0) {
      setImageFile(e.clipboardData.files[0])
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden" onPaste={handlePaste}>
      {/* Left channel list */}
      <div className="w-56 bg-[#0d0d14] border-r border-white/5 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-white/5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#334155]">Channels</p>
        </div>
        <div className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => { setChannel(ch.id); setTab('chat') }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                channel === ch.id && tab === 'chat' ? 'bg-primary/10 text-primary' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
              )}
            >
              <ch.icon className="w-4 h-4 shrink-0" />
              {ch.name}
            </button>
          ))}
          
          {/* DMs */}
          {friends.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-3">
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
                      channel === dmChannelId && tab === 'chat' ? 'bg-primary/10 text-primary' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
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
        <div className="px-2 pb-3 border-t border-white/5 pt-3 space-y-1">
          <button
            onClick={() => setTab('friends')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              tab === 'friends' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
            )}
          >
            <Users className="w-4 h-4" /> Friends
          </button>
          <button
            onClick={() => setTab('voice')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              tab === 'voice' ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
            )}
          >
            <Mic className="w-4 h-4" /> Voice Rooms
          </button>
          <button
            onClick={() => setTab('leaderboard')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              tab === 'leaderboard' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'text-[#64748B] hover:text-foreground hover:bg-white/5'
            )}
          >
            <Trophy className="w-4 h-4" /> Leaderboard
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === 'chat' ? (
          <>
            {/* Channel header */}
            <div className="h-12 border-b border-white/5 px-5 flex items-center gap-2 shrink-0 bg-[#0d1017]">
              {channel.startsWith('dm_') ? (
                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">@</div>
              ) : (
                <Hash className="w-4 h-4 text-[#64748B]" />
              )}
              <span className="font-semibold text-sm">
                {channel.startsWith('dm_') ? 'Direct Message' : channel}
              </span>
              <span className="ml-2 text-xs text-[#334155]">{messages.length} messages</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-16 text-[#334155] text-sm">
                  No messages yet. Be the first!
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex gap-3', msg.user_id === user?.id && 'flex-row-reverse')}>
                  <button 
                    onClick={() => setSelectedUser(msg.user_id)}
                    className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary hover:scale-105 transition-transform"
                  >
                    {(msg.profiles?.username ?? 'U').charAt(0).toUpperCase()}
                  </button>
                  <div className={cn('max-w-md space-y-1', msg.user_id === user?.id && 'items-end flex flex-col')}>
                    <div className="flex items-center gap-2 text-[10px] text-[#64748B] px-1">
                      <button onClick={() => setSelectedUser(msg.user_id)} className="font-medium text-[#94A3B8] hover:text-white hover:underline">
                        {msg.profiles?.username ?? 'Anonymous'}
                      </button>
                      <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                    </div>

                    {/* Unified Message Block */}
                    <div className={cn(
                      'overflow-hidden rounded-2xl border flex flex-col',
                      msg.user_id === user?.id
                        ? 'bg-primary/10 border-primary/20 rounded-tr-sm'
                        : 'bg-[#12121a] border-white/10 rounded-tl-sm'
                    )}>
                      {msg.content && msg.content !== 'Shared a trade' && (
                        <div className={cn('px-4 py-3 text-sm leading-relaxed text-foreground', (msg.trades || msg.image_url) && 'border-b border-white/5')}>
                          {msg.content}
                        </div>
                      )}

                      {/* Shared Trade Embed */}
                      {msg.trades && (
                        <div className={cn('p-4 w-64 md:w-80', msg.image_url && 'border-b border-white/5 bg-black/20')}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm text-white">{msg.trades.symbol}</span>
                            <span className={cn(
                              'text-[10px] px-2 py-0.5 rounded font-bold uppercase',
                              msg.trades.direction === 'buy' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                            )}>
                              {msg.trades.direction}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-[#94A3B8] mb-2">
                            <span>Entry: {msg.trades.entry_price}</span>
                            <span className="uppercase">{msg.trades.status}</span>
                          </div>
                          {msg.trades.status === 'closed' && (
                            <div className={cn('font-bold text-sm', (msg.trades.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                              {fmt(msg.trades.net_profit ?? 0)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Attached Image */}
                      {msg.image_url && (
                        <div className="w-64 md:w-80">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={msg.image_url} alt="Shared chart" className="w-full h-auto object-cover max-h-64 object-top" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-4 border-t border-white/5 bg-[#0d1017]">
              <form onSubmit={send} className="flex items-center gap-3 bg-[#12121a] border border-white/10 rounded-xl px-2 py-1.5 focus-within:border-primary/50 transition-colors">
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="p-2 text-[#64748B] hover:text-white transition-colors"
                  title="Share a trade or screenshot"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder={user ? `Message #${channel}...` : 'Sign in to chat'}
                  disabled={!user || sending}
                  className="flex-1 bg-transparent border-none text-sm focus:outline-none placeholder:text-[#334155]"
                />
                <button
                  type="submit"
                  disabled={(!newMsg.trim() && !selectedTrade && !imageUrl && !imageFile) || !user || sending}
                  className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : tab === 'leaderboard' ? (
          <LeaderboardTab />
        ) : tab === 'friends' ? (
          <FriendsTab friends={friends} user={user} onMessage={(dm) => { setChannel(dm); setTab('chat') }} />
        ) : tab === 'voice' ? (
          <VoiceTab />
        ) : null}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
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
                  className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark] appearance-none"
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
                className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {sending ? 'Sending...' : <><Send className="w-4 h-4" /> Share to #{channel}</>}
              </button>
            </div>
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
}

function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('trades')
      .select('user_id, net_profit, profiles(username)')
      .eq('status', 'closed')
      .then(({ data }) => {
        if (!data) return
        const byUser: Record<string, { username: string; pnl: number; trades: number }> = {}
        for (const t of data as any[]) {
          const uid = t.user_id
          if (!byUser[uid]) byUser[uid] = { username: t.profiles?.username ?? 'Anonymous', pnl: 0, trades: 0 }
          byUser[uid].pnl += t.net_profit ?? 0
          byUser[uid].trades++
        }
        const sorted = Object.entries(byUser)
          .map(([uid, v]) => ({ uid, ...v }))
          .sort((a, b) => b.pnl - a.pnl)
          .slice(0, 20)
        setLeaderboard(sorted)
      })
  }, [])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-6 h-6 text-[#F59E0B]" />
          <h2 className="text-xl font-bold">Community Leaderboard</h2>
        </div>

        {leaderboard.length === 0 ? (
          <div className="bg-[#12121a] border border-white/5 rounded-xl py-16 text-center text-[#334155] text-sm">
            No traders on the leaderboard yet
          </div>
        ) : (
          <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
            {leaderboard.map((entry, i) => (
              <div key={entry.uid} className={cn('flex items-center gap-4 px-5 py-4 border-b border-white/[0.03] hover:bg-white/2 transition-colors', i === 0 && 'bg-[#F59E0B]/5')}>
                <div className="w-8 text-center">
                  {i < 3 ? <span className="text-xl">{medals[i]}</span> : <span className="text-[#334155] font-bold text-sm">#{i + 1}</span>}
                </div>
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  {entry.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{entry.username}</p>
                  <p className="text-xs text-[#64748B]">{entry.trades} trades</p>
                </div>
                <div className={cn('font-bold tabular-nums', entry.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {fmt(entry.pnl)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FriendsTab({ friends, user, onMessage }: { friends: any[], user: any, onMessage: (dm: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-[#22C55E]" /> Friends & Following
        </h2>

        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold mb-4">Add a Friend</h3>
          <div className="flex gap-2">
            <input placeholder="Search by exact username..." className="flex-1 bg-[#0d1017] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold mb-4">Your Friends</h3>
          {friends.length === 0 ? (
            <p className="text-[#64748B] text-sm">You have no friends added yet.</p>
          ) : (
            <div className="space-y-2">
              {friends.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-[#0d1017] rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {f.username.charAt(0).toUpperCase()}
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

function VoiceTab() {
  const [token, setToken] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  const joinRoom = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: 'trading-floor' })
      })
      const data = await res.json()
      if (data.token) {
        setToken(data.token)
        setServerUrl(data.url)
        setConnected(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 h-full">
      {!connected ? (
        <div className="max-w-xl mx-auto mt-10">
          <div className="bg-[#0A0A0F] border border-[#1A1A2E] rounded-3xl p-10 text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center mx-auto text-[#8B5CF6] shadow-[0_0_30px_rgba(139,92,246,0.3)]">
              <Mic className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Trading Floor (Voice)</h2>
              <p className="text-[#64748B] text-sm max-w-sm mx-auto leading-relaxed">
                Join the live voice channel to discuss setups, price action, and execute trades together with the community.
              </p>
            </div>
            
            <button 
              onClick={joinRoom}
              disabled={loading}
              className="px-8 py-3.5 bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white rounded-xl text-sm font-bold shadow-lg shadow-[#8B5CF6]/20 transition-all hover:scale-105 w-full max-w-xs mx-auto flex justify-center items-center gap-2"
            >
              {loading ? 'Connecting...' : <><Mic className="w-4 h-4" /> Connect to Audio Room</>}
            </button>
          </div>
        </div>
      ) : (
        <LiveKitRoom
          video={false}
          audio={true}
          token={token}
          serverUrl={serverUrl}
          data-lk-theme="default"
          style={{ height: '100%', background: 'transparent', '--lk-bg': 'transparent', '--lk-control-bar-bg': 'rgba(255,255,255,0.05)' } as any}
          onDisconnected={() => setConnected(false)}
        >
          <div className="bg-[#0A0A0F] border border-[#1A1A2E] rounded-3xl p-6 h-full flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
                <span className="text-[#F1F5F9]">Trading Floor Live</span>
              </h2>
              <button 
                onClick={() => setConnected(false)} 
                className="px-4 py-2 bg-[#EF4444]/10 text-[#EF4444] rounded-lg text-sm font-bold hover:bg-[#EF4444]/20 transition-colors border border-[#EF4444]/20"
              >
                Disconnect
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-xl border border-white/5 bg-black/20">
              <AudioConference />
            </div>
            <RoomAudioRenderer />
            <div className="mt-4 flex justify-center">
              <ControlBar variation="minimal" controls={{ microphone: true, screenShare: false, camera: false, leave: false }} />
            </div>
          </div>
        </LiveKitRoom>
      )}
    </div>
  )
}
