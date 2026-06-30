'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts } from '@/hooks/useAccounts'
import { fmt } from '@/lib/calculations'
import { 
  Users, Trophy, Mic, UserPlus, Volume2, Globe, Mail, Loader2
} from 'lucide-react'
import { UserProfileModal } from '@/components/community/UserProfileModal'
import { cn } from '@/lib/utils'
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  GridLayout,
  ParticipantTile,
  useTracks
} from '@livekit/components-react'
import { Track } from 'livekit-client'

// Import LiveKit's default themes and layout styling
import '@livekit/components-styles'
import { useToast } from '@/context/ToastContext'
import { SocialFeed } from '@/components/community/SocialFeed'
import { DirectMessages } from '@/components/community/DirectMessages'
import { useSearchParams, useRouter } from 'next/navigation'

export default function CommunityPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paramTab = searchParams.get('tab') as 'feed' | 'dms' | 'leaderboard' | 'friends' | 'voice' | null

  const [tab, setTab] = useState<'feed' | 'dms' | 'leaderboard' | 'friends' | 'voice'>('feed')
  const [user, setUser] = useState<any>(null)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [friends, setFriends] = useState<{id: string, username: string, avatar_url?: string}[]>([])
  const supabase = createClient()
  const { success: showSuccess, error: showError } = useToast()

  // Sync tab from query parameter if present
  useEffect(() => {
    if (paramTab && ['feed', 'dms', 'leaderboard', 'friends', 'voice'].includes(paramTab)) {
      setTab(paramTab)
    }
  }, [paramTab])

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

  // Load user session and profiles on mount
  useEffect(() => {
    async function initUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        setUser(authUser)
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
        setMyProfile(prof)
        loadFriendsList(authUser.id)
      }
    }
    initUser()
  }, [])

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
      loadFriendsList(user.id)
      return { success: `Successfully added ${profileData.username} as a friend!` }
    }

    const { error: insErr } = await supabase
      .from('friendships')
      .insert({
        user_id: user.id,
        friend_id: profileData.id,
        status: 'accepted' // Autoconfirm friends initially for direct platform engagement
      })

    if (insErr) return { error: insErr.message }
    loadFriendsList(user.id)
    return { success: `Sent friend request to ${profileData.username}!` }
  }

  const handleStartDM = async (recipientId: string) => {
    if (!user) return
    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'direct', recipientId })
      })
      const data = await res.json()
      if (res.ok && data.conversation) {
        router.push(`/community?tab=dms&id=${data.conversation.id}`)
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#07070b]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  const mainContent = (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Left Menu Sidebar */}
      <div className="w-56 bg-[#0c0c14] border-r border-white/5 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-white/5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#64748B]">Community Hub</p>
        </div>
        <div className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto no-scrollbar">
          <button
            onClick={() => setTab('feed')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer',
              tab === 'feed' ? 'bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/15' : 'text-[#64748B] hover:text-foreground hover:bg-white/5 border border-transparent'
            )}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span>Social Feed</span>
          </button>
          
          <button
            onClick={() => setTab('dms')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer',
              tab === 'dms' ? 'bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/15' : 'text-[#64748B] hover:text-foreground hover:bg-white/5 border border-transparent'
            )}
          >
            <Mail className="w-4 h-4 shrink-0" />
            <span>Direct Messages</span>
          </button>

          <button
            onClick={() => setTab('friends')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer',
              tab === 'friends' ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/15' : 'text-[#64748B] hover:text-foreground hover:bg-white/5 border border-transparent'
            )}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Friends list</span>
          </button>
          
          <button
            onClick={() => setTab('voice')}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer group/voice',
              tab === 'voice' ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/15' : 'text-[#64748B] hover:text-foreground hover:bg-white/5 border border-transparent'
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
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer',
              tab === 'leaderboard' ? 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/15' : 'text-[#64748B] hover:text-foreground hover:bg-white/5 border border-transparent'
            )}
          >
            <Trophy className="w-4 h-4 shrink-0" />
            <span>Leaderboard</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Display Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#07070b]">
        {tab === 'feed' ? (
          <SocialFeed user={user} onOpenProfile={(username) => router.push(`/trader/${username}`)} />
        ) : tab === 'dms' ? (
          <DirectMessages user={user} />
        ) : tab === 'friends' ? (
          <FriendsTab 
            friends={friends} 
            user={user} 
            onMessage={handleStartDM} 
            onAddFriend={handleAddFriendByUsername} 
          />
        ) : tab === 'leaderboard' ? (
          <LeaderboardTab />
        ) : (
          <VoiceTab 
            connected={voiceConnected} 
            loading={voiceLoading} 
            onConnect={joinVoiceRoom} 
            onDisconnect={leaveVoiceRoom} 
          />
        )}
      </div>

      {/* Floating active voice call popup card */}
      {voiceConnected && tab !== 'voice' && (
        <div className="fixed bottom-6 right-20 bg-[#0c0c14]/95 border border-[#8B5CF6]/30 px-4 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-xl z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]"></span>
            </span>
            <div className="text-left">
              <p className="text-[10px] font-black text-[#F1F5F9] uppercase tracking-wider flex items-center gap-1.5 leading-none">
                Voice Floor
              </p>
              <p className="text-[8px] text-[#8B5CF6] uppercase tracking-widest font-extrabold mt-1">Active Call</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-white/5 pl-4">
            <button 
              onClick={() => setTab('voice')}
              className="px-3 py-1.5 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 rounded-lg text-[9px] font-bold uppercase tracking-wider text-[#8B5CF6] transition-all cursor-pointer border border-[#8B5CF6]/20"
            >
              View
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
          onMessage={(recipientId) => {
            handleStartDM(recipientId)
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
    <div className="flex-1 overflow-y-auto p-6 bg-[#07070b] no-scrollbar">
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
            {/* 3D Podium for Top 3 */}
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
                    <span className="text-[8px] text-[#22C55E]/80 font-mono mt-0.5 font-bold">WR: {top3[1].winRate}%</span>
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
                    <span className="text-[8px] text-primary/80 font-mono mt-0.5 font-bold">WR: {top3[0].winRate}%</span>
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
                    <span className="text-[8px] text-[#CD7F32]/80 font-mono mt-0.5 font-bold">WR: {top3[2].winRate}%</span>
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
                        <p className="text-xs text-[#64748B]">{entry.trades} trades • Win Rate: {entry.winRate}%</p>
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
  onMessage: (recipientId: string) => void
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
    <div className="flex-1 overflow-y-auto p-6 bg-[#07070b] no-scrollbar">
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
              className="px-4 py-2 bg-[#38BDF8] hover:bg-[#38BDF8]/95 text-black rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
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
                        <img src={f.avatar_url} alt={f.username} className="w-full h-full object-cover" />
                      ) : (
                        f.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="font-bold text-sm text-white">{f.username}</span>
                  </div>
                  <button onClick={() => onMessage(f.id)} className="text-xs text-primary hover:underline cursor-pointer">Message</button>
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
      </div>
    </div>
  )
}
