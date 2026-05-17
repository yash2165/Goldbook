'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { computeStats, fmt } from '@/lib/calculations'
import { Send, Hash, Users, Trophy, TrendingUp, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { UserProfileModal } from '@/components/community/UserProfileModal'

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
  profiles?: { username: string; avatar_url?: string }
}

export default function CommunityPage() {
  const [tab, setTab] = useState<'chat' | 'leaderboard'>('chat')
  const [channel, setChannel] = useState('general')
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [friends, setFriends] = useState<{id: string, username: string}[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

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
      }
    })
  }, [])

  // Load messages + realtime
  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(username, avatar_url)')
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
            .select('*, profiles(username, avatar_url)')
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

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim() || !user) return
    setSending(true)
    await supabase.from('messages').insert({ user_id: user.id, channel, content: newMsg.trim() })
    setNewMsg('')
    setSending(false)
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Left channel list */}
      <div className="w-56 bg-[#0d0d14] border-r border-white/5 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-white/5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#334155]">Channels</p>
        </div>
        <div className="flex-1 py-2 px-2 space-y-0.5">
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
        <div className="px-2 pb-3 border-t border-white/5 pt-2">
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
            <div className="h-12 border-b border-white/5 px-5 flex items-center gap-2 shrink-0">
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
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
                  <div className={cn('max-w-sm space-y-0.5', msg.user_id === user?.id && 'items-end flex flex-col')}>
                    <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                      <button onClick={() => setSelectedUser(msg.user_id)} className="font-medium text-[#94A3B8] hover:text-white hover:underline">
                        {msg.profiles?.username ?? 'Anonymous'}
                      </button>
                      <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                    </div>
                    <div className={cn(
                      'px-3 py-2 rounded-xl text-sm leading-relaxed',
                      msg.user_id === user?.id
                        ? 'bg-primary/20 text-foreground rounded-tr-sm'
                        : 'bg-[#12121a] border border-white/5 rounded-tl-sm'
                    )}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={send} className="px-5 py-4 border-t border-white/5 flex gap-3">
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder={user ? `Message #${channel}...` : 'Sign in to chat'}
                disabled={!user || sending}
                className="flex-1 bg-[#12121a] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors placeholder:text-[#334155]"
              />
              <button
                type="submit"
                disabled={!newMsg.trim() || !user || sending}
                className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <LeaderboardTab />
        )}
      </div>

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
    // Aggregate by user_id from trades
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
