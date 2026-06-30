'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts } from '@/hooks/useAccounts'
import { fmt } from '@/lib/calculations'
import { 
  Users, Trophy, Mic, UserPlus, Volume2, Globe, Mail, Loader2,
  MicOff, Video, VideoOff, ScreenShare, Fullscreen, Settings, MessageSquare, PhoneOff, Send, VolumeX
} from 'lucide-react'
import { UserProfileModal } from '@/components/community/UserProfileModal'
import { cn } from '@/lib/utils'
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  GridLayout,
  ParticipantTile,
  useTracks,
  useLocalParticipant,
  useChat,
  MediaDeviceSelect,
  useMediaDeviceSelect,
  useParticipants
} from '@livekit/components-react'
import { Track } from 'livekit-client'

// Import LiveKit's default themes and layout styling
import '@livekit/components-styles'
import { format } from 'date-fns'
import { useToast } from '@/context/ToastContext'
import { SocialFeed } from '@/components/community/SocialFeed'
import { DirectMessages } from '@/components/community/DirectMessages'
import { GlobalChat } from '@/components/community/GlobalChat'
import { useVoiceRoom } from '@/context/VoiceRoomContext'
import { useSearchParams, useRouter } from 'next/navigation'

export default function CommunityPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paramTab = searchParams.get('tab') as 'feed' | 'chat' | 'dms' | 'leaderboard' | 'friends' | 'voice' | null

  const [tab, setTab] = useState<'feed' | 'chat' | 'dms' | 'leaderboard' | 'friends' | 'voice'>('feed')
  const [user, setUser] = useState<any>(null)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [friends, setFriends] = useState<{id: string, username: string, avatar_url?: string}[]>([])
  const supabase = createClient()
  const { success: showSuccess, error: showError } = useToast()

  const { voiceConnected, voiceLoading, joinVoiceRoom, leaveVoiceRoom } = useVoiceRoom()

  // Sync tab from query parameter if present
  useEffect(() => {
    if (paramTab && ['feed', 'chat', 'dms', 'leaderboard', 'friends', 'voice'].includes(paramTab)) {
      setTab(paramTab)
    }
  }, [paramTab])

  // Resolve invite link parameter
  useEffect(() => {
    const roomParam = searchParams.get('room')
    if (roomParam && user) {
      setTab('voice')
      async function resolveInvite() {
        const { data: room } = await supabase
          .from('voice_rooms')
          .select('*')
          .eq('name', roomParam)
          .single()

        if (room) {
          const isCreator = room.created_by === user.id
          if (room.type === 'public' || isCreator) {
            joinVoiceRoom(room.name, room.type === 'private')
          } else {
            // Check request status
            const { data: req } = await supabase
              .from('voice_room_requests')
              .select('status')
              .eq('room_id', room.id)
              .eq('user_id', user.id)
              .single()

            if (req?.status === 'approved') {
              joinVoiceRoom(room.name, true)
            } else {
              alert(`Room "${room.name}" is Private. Please click 'Request to Join' in the Voice tab to access this room.`)
            }
          }
        }
      }
      resolveInvite()
    }
  }, [searchParams, user])

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
            onClick={() => setTab('chat')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-left cursor-pointer',
              tab === 'chat' ? 'bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/15' : 'text-[#64748B] hover:text-foreground hover:bg-white/5 border border-transparent'
            )}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>Global Chats</span>
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
        ) : tab === 'chat' ? (
          <GlobalChat user={user} onOpenProfile={(username) => router.push(`/trader/${username}`)} />
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
            user={user}
          />
        )}
      </div>

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
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  
  const supabase = createClient()
  const { success: showSuccess, error: showError } = useToast()

  // Flexible search listener (Debounced)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, headline')
          .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
          .limit(10)

        if (!error && data) {
          // Exclude self
          setSearchResults(data.filter((u: any) => u.id !== user.id))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const handleAddClick = async (targetUsername: string) => {
    setAdding(true)
    try {
      const res = await onAddFriend(targetUsername)
      if (res.error) {
        showError('Request Failed', res.error)
      } else if (res.success) {
        showSuccess('Friend Request Sent!', res.success)
        setSearchTerm('')
        setSearchResults([])
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

        {/* Flexible Search Section */}
        <div className="bg-[#0D1421]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-md relative">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/90 mb-4">Discover Friends</h3>
          <div className="flex gap-2">
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              disabled={adding}
              placeholder="Search by username or name..." 
              className="flex-1 bg-[#060A12] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 text-white disabled:opacity-50" 
            />
          </div>

          {/* Dynamic Search Results list */}
          {searchTerm.trim() !== '' && (
            <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
              {searching ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold py-2">No traders found matching "{searchTerm}"</p>
              ) : (
                searchResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-[#060a12]/50 border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary overflow-hidden border border-white/10 shrink-0">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />
                        ) : (
                          p.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-sm text-white block leading-none">{p.display_name || p.username}</span>
                        <span className="text-[10px] text-[#64748B] font-mono leading-none mt-1 block">@{p.username}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddClick(p.username)}
                      disabled={adding}
                      className="px-3.5 py-1.5 bg-primary text-black rounded-lg text-[10px] font-black uppercase tracking-wider hover:scale-105 transition-transform disabled:opacity-50 cursor-pointer"
                    >
                      Add Friend
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Existing Friends List */}
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
  onDisconnect,
  user
}: { 
  connected: boolean
  loading: boolean
  onConnect: (roomName: string, isPrivate: boolean) => void
  onDisconnect: () => void
  user: any
}) {
  const [rooms, setRooms] = useState<any[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomType, setNewRoomType] = useState<'public' | 'private'>('public')

  // Request statuses lookup map: room_id -> status
  const [requestStatuses, setRequestStatuses] = useState<Record<string, string>>({})
  
  // Pending requests for rooms created by the current user
  const [adminRequests, setAdminRequests] = useState<any[]>([])

  const supabase = createClient()
  const { success: showSuccess, error: showError } = useToast()

  const loadVoiceRooms = async () => {
    if (!user) return
    setLoadingRooms(true)
    try {
      // 0. Auto-clean custom rooms older than 12 hours
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      await supabase.from('voice_rooms').delete().lt('created_at', twelveHoursAgo)

      // 1. Fetch all voice rooms
      const { data: roomsData } = await supabase
        .from('voice_rooms')
        .select('*, profiles:created_by(username, display_name, avatar_url)')
        .order('created_at', { ascending: false })

      // 2. Fetch my requests
      const { data: myReqs } = await supabase
        .from('voice_room_requests')
        .select('*')
        .eq('user_id', user.id)

      // 3. Fetch admin requests (for rooms I created)
      const { data: adminReqs } = await supabase
        .from('voice_room_requests')
        .select('*, profiles:user_id(username, display_name, avatar_url), voice_rooms!inner(name, created_by)')
        .eq('voice_rooms.created_by', user.id)
        .eq('status', 'pending')

      if (roomsData) {
        // Prepend default public Trading Floor
        const defaultFloor = {
          id: 'trading-floor-default',
          name: 'trading-floor',
          type: 'public',
          profiles: { username: 'System', display_name: 'Platform Broadcast' }
        }
        setRooms([defaultFloor, ...roomsData])
      }

      if (myReqs) {
        const statuses: Record<string, string> = {}
        myReqs.forEach(r => {
          statuses[r.room_id] = r.status
        })
        setRequestStatuses(statuses)
      }

      if (adminReqs) {
        setAdminRequests(adminReqs)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRooms(false)
    }
  }

  useEffect(() => {
    loadVoiceRooms()

    // Realtime channel for request updates
    const channel = supabase
      .channel('voice_room_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_room_requests' }, () => {
        loadVoiceRooms()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_rooms' }, () => {
        loadVoiceRooms()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    const nameStr = newRoomName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    if (!nameStr) return

    try {
      const { data, error } = await supabase
        .from('voice_rooms')
        .insert({
          name: nameStr,
          type: newRoomType,
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        showError('Room Creation Failed', error.message)
      } else {
        showSuccess('Voice Room Created', `Room "${nameStr}" is active.`)
        setShowCreateModal(false)
        setNewRoomName('')
        // Automatically join the newly created room
        onConnect(nameStr, newRoomType === 'private')
      }
    } catch (err: any) {
      showError('Action Failed', err.message || 'Error creating room.')
    }
  }

  const handleRequestJoin = async (room: any) => {
    try {
      const { error } = await supabase
        .from('voice_room_requests')
        .insert({
          room_id: room.id,
          user_id: user.id,
          status: 'pending'
        })

      if (error) {
        showError('Request Failed', error.message)
      } else {
        showSuccess('Join Request Sent', 'Waiting for admin approval.')
        loadVoiceRooms()
      }
    } catch (err: any) {
      showError('Action Failed', err.message)
    }
  }

  const handleUpdateRequest = async (reqId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('voice_room_requests')
        .update({ status })
        .eq('id', reqId)

      if (error) {
        showError('Action Failed', error.message)
      } else {
        showSuccess(`Request ${status}`, 'Status updated successfully.')
        loadVoiceRooms()
      }
    } catch (err: any) {
      showError('Action Failed', err.message)
    }
  }

  const handleCloseRoom = async (roomId: string) => {
    if (confirm('Are you sure you want to close this voice room? All users will be disconnected.')) {
      const { error } = await supabase.from('voice_rooms').delete().eq('id', roomId)
      if (error) {
        showError('Action Failed', error.message)
      } else {
        showSuccess('Room Closed', 'Voice room closed successfully.')
        loadVoiceRooms()
      }
    }
  }

  const handleCopyInviteLink = (roomName: string) => {
    const link = `${window.location.origin}/community?tab=voice&room=${encodeURIComponent(roomName)}`
    navigator.clipboard.writeText(link)
    showSuccess('Link Copied', 'Invite link copied to clipboard!')
  }

  if (connected) {
    return <VoiceRoomActive onDisconnect={onDisconnect} user={user} />
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#07070b] no-scrollbar">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" /> Live Voice Channels
            </h2>
            <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-widest mt-1">Connect or create private voice rooms</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/95 text-black rounded-lg text-xs font-bold uppercase tracking-wider transition-transform hover:scale-105 cursor-pointer"
          >
            Create Voice Room
          </button>
        </div>

        {/* Pending Requests for Admins */}
        {adminRequests.length > 0 && (
          <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-2xl p-5 space-y-3 text-left">
            <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest">Pending Access Requests</h3>
            <div className="space-y-2">
              {adminRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between bg-black/40 border border-white/5 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                      {req.profiles?.avatar_url ? (
                        <img src={req.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        req.profiles?.username?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-bold text-white block">@{req.profiles?.username}</span>
                      <span className="text-[9px] text-[#64748B] font-mono leading-none mt-0.5 block">wants to join: {req.voice_rooms?.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateRequest(req.id, 'approved')}
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateRequest(req.id, 'rejected')}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loadingRooms ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            rooms.map(room => {
              const isDefault = room.id === 'trading-floor-default'
              const isCreator = room.created_by === user?.id
              const isPrivate = room.type === 'private'
              const status = requestStatuses[room.id] || 'none'
              const isApproved = status === 'approved'

              return (
                <div key={room.id} className="bg-[#0D1421]/60 border border-white/5 rounded-2xl p-5 flex flex-col justify-between backdrop-blur-md">
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">{room.name}</h4>
                      <span className={cn(
                        'text-[8px] font-black uppercase px-2 py-0.5 rounded-full border',
                        isPrivate ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      )}>
                        {room.type}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#64748B] font-mono leading-none">Created by: {room.profiles?.display_name || room.profiles?.username || 'Trader'}</p>
                  </div>

                  <div className="mt-5 shrink-0">
                    <div className="flex gap-2">
                      {isDefault || !isPrivate || isCreator || isApproved ? (
                        <button
                          onClick={() => onConnect(room.name, isPrivate)}
                          disabled={loading}
                          className="flex-1 py-2 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-1.5 transition-transform hover:scale-[1.02] cursor-pointer"
                        >
                          <Mic className="w-3.5 h-3.5" /> Join
                        </button>
                      ) : status === 'pending' ? (
                        <button
                          disabled
                          className="flex-1 py-2 bg-white/5 border border-white/10 text-[#64748B] rounded-xl text-xs font-bold uppercase tracking-wider"
                        >
                          Pending
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRequestJoin(room)}
                          className="flex-1 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-transform hover:scale-[1.02] cursor-pointer"
                        >
                          Request
                        </button>
                      )}

                      {/* Invite Link Option for Admin */}
                      {((isPrivate && isCreator) || (!isPrivate && !isDefault)) && (
                        <button
                          onClick={() => handleCopyInviteLink(room.name)}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold uppercase cursor-pointer"
                          title="Copy Invite Link"
                        >
                          🔗 Invite
                        </button>
                      )}

                      {/* Close/Delete Room Option for Creator */}
                      {!isDefault && isCreator && (
                        <button
                          onClick={() => handleCloseRoom(room.id)}
                          className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold uppercase cursor-pointer"
                          title="Close Room"
                        >
                          ✕ Close
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Create Voice Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleCreateRoom} className="bg-[#0D1421] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Create Custom Voice Room</h4>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-[#64748B] hover:text-white">✕</button>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[9px] text-[#64748B] uppercase tracking-wider font-extrabold">Room Name</label>
              <input
                type="text"
                required
                placeholder="e.g. gold-scalps"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                className="w-full bg-[#060A12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[9px] text-[#64748B] uppercase tracking-wider font-extrabold">Room Privacy</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewRoomType('public')}
                  className={cn(
                    'py-2 rounded-lg text-xs font-bold uppercase border cursor-pointer',
                    newRoomType === 'public' ? 'bg-primary/10 text-primary border-primary/25' : 'bg-black/20 text-[#64748B] border-white/5'
                  )}
                >
                  🌐 Public
                </button>
                <button
                  type="button"
                  onClick={() => setNewRoomType('private')}
                  className={cn(
                    'py-2 rounded-lg text-xs font-bold uppercase border cursor-pointer',
                    newRoomType === 'private' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' : 'bg-black/20 text-[#64748B] border-white/5'
                  )}
                >
                  🔒 Private
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-black rounded-lg text-xs font-bold uppercase tracking-wider hover:scale-[1.02] transition-transform cursor-pointer mt-2"
            >
              Create Room
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function AudioInputSelect() {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind: 'audioinput' })
  return (
    <select
      value={activeDeviceId || ''}
      onChange={e => setActiveMediaDevice(e.target.value)}
      className="w-full bg-[#060A12] border border-white/10 rounded-lg text-xs text-white p-2.5 focus:outline-none focus:border-primary/50 truncate cursor-pointer"
    >
      {devices.map((d: any) => (
        <option key={d.deviceId} value={d.deviceId} className="bg-[#0D1421] text-white">
          {d.label}
        </option>
      ))}
    </select>
  )
}

function AudioOutputSelect() {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind: 'audiooutput' })
  return (
    <select
      value={activeDeviceId || ''}
      onChange={e => setActiveMediaDevice(e.target.value)}
      className="w-full bg-[#060A12] border border-white/10 rounded-lg text-xs text-white p-2.5 focus:outline-none focus:border-primary/50 truncate cursor-pointer"
    >
      {devices.map((d: any) => (
        <option key={d.deviceId} value={d.deviceId} className="bg-[#0D1421] text-white">
          {d.label}
        </option>
      ))}
    </select>
  )
}

function VideoInputSelect() {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind: 'videoinput' })
  return (
    <select
      value={activeDeviceId || ''}
      onChange={e => setActiveMediaDevice(e.target.value)}
      className="w-full bg-[#060A12] border border-white/10 rounded-lg text-xs text-white p-2.5 focus:outline-none focus:border-primary/50 truncate cursor-pointer"
    >
      {devices.map((d: any) => (
        <option key={d.deviceId} value={d.deviceId} className="bg-[#0D1421] text-white">
          {d.label}
        </option>
      ))}
    </select>
  )
}

function VoiceRoomActive({ onDisconnect, user }: { onDisconnect: () => void; user: any }) {
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false })
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false })
  const participants = useParticipants()
  
  const { localParticipant } = useLocalParticipant()
  const { send, chatMessages } = useChat()
  const [chatInput, setChatInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showChatPanel, setShowChatPanel] = useState(true)
  const [profileMap, setProfileMap] = useState<Record<string, any>>({})
  const supabase = createClient()

  const hasScreenShare = screenShareTracks.length > 0

  // Resolve profiles for all active participants in room
  useEffect(() => {
    async function resolveProfiles() {
      const missingIds = participants
        .map(p => p.identity)
        .filter(id => id && !profileMap[id])

      if (missingIds.length === 0) return

      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', missingIds)

      if (data) {
        setProfileMap(prev => {
          const next = { ...prev }
          data.forEach(p => {
            next[p.id] = p
          })
          return next
        })
      }
    }
    resolveProfiles()
  }, [participants, profileMap])

  const toggleMic = () => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)
    }
  }

  const toggleCamera = () => {
    if (localParticipant) {
      localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)
    }
  }

  const toggleScreenshare = () => {
    if (localParticipant) {
      localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled, { audio: true })
    }
  }

  const handleFullscreen = () => {
    const el = document.getElementById('shared-screen-window')
    if (el) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        el.requestFullscreen().catch((err) => console.error(err))
      }
    }
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    send(chatInput)
    setChatInput('')
  }

  const isMicEnabled = localParticipant?.isMicrophoneEnabled ?? false
  const isCameraEnabled = localParticipant?.isCameraEnabled ?? false
  const isScreenShareEnabled = localParticipant?.isScreenShareEnabled ?? false

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
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6 min-h-[300px] mb-6">
          <div className="flex-[3] flex flex-col overflow-hidden min-h-0 relative">
            {hasScreenShare ? (
              <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                {/* Main Screenshare container (Large) */}
                <div id="shared-screen-window" className="flex-[3] relative rounded-xl border border-[#38BDF8]/20 bg-black/60 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] group">
                  <ParticipantTile trackRef={screenShareTracks[0]} className="w-full h-full object-contain" />
                  <div className="absolute top-4 left-4 bg-black/60 border border-white/10 px-3 py-1.5 rounded-lg text-[9px] uppercase font-extrabold tracking-widest text-[#38BDF8] backdrop-blur-md">
                    🖥️ Live Presentation
                  </div>
                  
                  {/* Fullscreen Overlay Trigger */}
                  <button 
                    onClick={handleFullscreen}
                    className="absolute bottom-4 right-4 p-2 bg-black/60 hover:bg-black/85 text-white border border-white/10 rounded-lg hover:scale-105 transition-transform flex items-center gap-1 text-[9px] uppercase font-black tracking-widest cursor-pointer"
                    title="Fullscreen Mode"
                  >
                    <Fullscreen className="w-3.5 h-3.5" /> Fullscreen
                  </button>
                </div>

                {/* Sidebar Camera Tiles list */}
                <div className="flex-1 min-w-[200px] flex flex-col gap-3 overflow-y-auto custom-scrollbar no-scrollbar">
                  {participants.map(p => {
                    const profile = profileMap[p.identity || '']
                    const hasCam = p.isCameraEnabled
                    const isSpeaking = p.isSpeaking
                    const track = cameraTracks.find(t => t.participant.sid === p.sid)

                    return (
                      <div 
                        key={p.sid} 
                        className={cn(
                          "h-28 shrink-0 relative rounded-lg overflow-hidden border bg-black/40 flex flex-col items-center justify-center p-3 transition-all duration-300",
                          isSpeaking ? "border-primary shadow-[0_0_12px_rgba(245,159,11,0.2)]" : "border-white/5"
                        )}
                      >
                        {hasCam && track ? (
                          <ParticipantTile trackRef={track} className="w-full h-full object-cover absolute inset-0" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center space-y-1.5">
                            <div className={cn(
                              "w-10 h-10 rounded-xl border flex items-center justify-center text-sm font-black transition-all",
                              isSpeaking ? "border-primary bg-primary/20 text-primary animate-pulse" : "border-white/10 bg-white/5 text-[#94A3B8]"
                            )}>
                              {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                profile?.display_name?.charAt(0).toUpperCase() || profile?.username?.charAt(0).toUpperCase() || '?'
                              )}
                            </div>
                            <div className="text-[9px] font-bold text-white max-w-[120px] truncate leading-none">
                              {profile?.display_name || profile?.username || 'Trader'}
                            </div>
                          </div>
                        )}

                        {/* Speaks status corner indicators */}
                        <div className="absolute bottom-2 right-2 p-1 rounded bg-black/60 border border-white/5">
                          {!p.isMicrophoneEnabled ? (
                            <MicOff className="w-3 h-3 text-[#EF4444]" />
                          ) : (
                            <Mic className="w-3 h-3 text-[#22C55E]" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* Grid Layout for all participants */
              <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-black/40 shadow-inner p-4 no-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {participants.map(p => {
                    const profile = profileMap[p.identity || '']
                    const hasCam = p.isCameraEnabled
                    const isSpeaking = p.isSpeaking
                    const track = cameraTracks.find(t => t.participant.sid === p.sid)

                    return (
                      <div 
                        key={p.sid} 
                        className={cn(
                          "relative rounded-xl overflow-hidden aspect-video border bg-black/40 flex flex-col items-center justify-center p-4 transition-all duration-300",
                          isSpeaking ? "border-primary shadow-[0_0_20px_rgba(245,159,11,0.25)] scale-[1.02]" : "border-white/5"
                        )}
                      >
                        {hasCam && track ? (
                          <ParticipantTile trackRef={track} className="w-full h-full object-cover absolute inset-0" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center space-y-3">
                            <div className={cn(
                              "w-14 h-14 rounded-2xl border flex items-center justify-center text-xl font-black transition-all",
                              isSpeaking ? "border-primary bg-primary/20 text-primary shadow-[0_0_15px_rgba(245,159,11,0.3)]" : "border-white/10 bg-white/5 text-[#94A3B8]"
                            )}>
                              {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                profile?.display_name?.charAt(0).toUpperCase() || profile?.username?.charAt(0).toUpperCase() || '?'
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-white max-w-[150px] truncate leading-none">
                                {profile?.display_name || profile?.username || 'Trader'}
                              </p>
                              <p className="text-[9px] text-[#64748B] font-mono leading-none">
                                @{profile?.username || 'connecting...'}
                              </p>
                            </div>
                          </div>
                        )}

                        {isSpeaking && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary/20 border border-primary/30 text-primary rounded text-[8px] uppercase font-black tracking-widest animate-pulse">
                            Speaking
                          </div>
                        )}

                        <div className="absolute top-2 right-2 p-1.5 rounded bg-black/60 border border-white/5">
                          {!p.isMicrophoneEnabled ? (
                            <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
                          ) : (
                            <Mic className="w-3.5 h-3.5 text-[#22C55E]" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right side live chat panel */}
          {showChatPanel && (
            <div className="w-80 border border-white/5 bg-[#080B11]/90 rounded-2xl flex flex-col overflow-hidden shadow-lg">
              <div className="px-4 py-3 border-b border-white/5 bg-[#0b0f17] flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-primary" /> Live Discussion
                </span>
                <button onClick={() => setShowChatPanel(false)} className="text-[#64748B] hover:text-white text-xs">✕</button>
              </div>
              
              {/* Chat Thread history */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 text-left no-scrollbar">
                {chatMessages.length === 0 ? (
                  <p className="text-center text-[9px] text-[#64748B] uppercase tracking-wider font-bold py-12">No messages sent yet.</p>
                ) : (
                  chatMessages.map((msg, i) => {
                    const senderProfile = profileMap[msg.from?.identity || '']
                    const displayName = senderProfile?.display_name || senderProfile?.username || msg.from?.name || 'Trader'
                    return (
                      <div key={i} className="space-y-0.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] font-black text-white">@{displayName}</span>
                          <span className="text-[8px] text-[#64748B] font-mono">{format(new Date(msg.timestamp), 'HH:mm')}</span>
                        </div>
                        <div className="bg-white/5 border border-white/[0.03] rounded-xl px-3 py-1.5 text-xs text-white/90 leading-relaxed">
                          {msg.message}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="p-2 border-t border-white/5 bg-black/20 flex gap-1.5">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50"
                />
                <button type="submit" className="p-2 bg-primary text-black rounded-xl hover:bg-primary/90 transition-all cursor-pointer">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Floating Capsule style Control Bar */}
        <div className="flex flex-col items-center gap-4 shrink-0 relative">
          <div className="flex items-center gap-3 bg-black/40 border border-white/10 p-2.5 rounded-2xl shadow-xl w-fit">
            
            {/* Mic Toggle */}
            <button
              onClick={toggleMic}
              className={cn(
                'p-3.5 rounded-xl transition-all cursor-pointer',
                isMicEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/25'
              )}
              title={isMicEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {isMicEnabled ? <Mic className="w-4.5 h-4.5" /> : <MicOff className="w-4.5 h-4.5" />}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={toggleCamera}
              className={cn(
                'p-3.5 rounded-xl transition-all cursor-pointer',
                isCameraEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/25'
              )}
              title={isCameraEnabled ? 'Disable Camera' : 'Enable Camera'}
            >
              {isCameraEnabled ? <Video className="w-4.5 h-4.5" /> : <VideoOff className="w-4.5 h-4.5" />}
            </button>

            {/* Screenshare Toggle */}
            <button
              onClick={toggleScreenshare}
              className={cn(
                'p-3.5 rounded-xl transition-all border cursor-pointer',
                isScreenShareEnabled ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white/5 text-[#94A3B8] border-white/5 hover:text-white'
              )}
              title={isScreenShareEnabled ? 'Stop Screenshare' : 'Start Screenshare'}
            >
              <ScreenShare className="w-4.5 h-4.5" />
            </button>

            {/* Chat Toggle */}
            <button
              onClick={() => setShowChatPanel(!showChatPanel)}
              className={cn(
                'p-3.5 rounded-xl transition-all border cursor-pointer',
                showChatPanel ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white/5 text-[#94A3B8] border-white/5 hover:text-white'
              )}
              title={showChatPanel ? 'Hide Chat Panel' : 'Show Chat Panel'}
            >
              <MessageSquare className="w-4.5 h-4.5" />
            </button>

            {/* Device Settings Panel Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'p-3.5 rounded-xl transition-all border cursor-pointer',
                showSettings ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-[#94A3B8] border-white/5 hover:text-white'
              )}
              title="Media Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>

            {/* Disconnect Floor */}
            <button
              onClick={onDisconnect}
              className="p-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-red-500/10 flex items-center justify-center gap-1.5"
              title="Leave Room"
            >
              <PhoneOff className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Collapsible Device Settings selectors dropdown */}
          {showSettings && (
            <div className="absolute bottom-full mb-3 bg-[#0D1421] border border-white/10 p-5 rounded-2xl shadow-2xl space-y-4 w-72 text-left z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <h4 className="text-[10px] font-black text-white uppercase tracking-wider border-b border-white/5 pb-2 mb-2">Media Configuration</h4>
              
              <div className="space-y-1 flex flex-col">
                <label className="text-[9px] text-[#64748B] uppercase tracking-wider font-extrabold">Microphone Input</label>
                <AudioInputSelect />
              </div>

              <div className="space-y-1 flex flex-col">
                <label className="text-[9px] text-[#64748B] uppercase tracking-wider font-extrabold">Speaker Output</label>
                <AudioOutputSelect />
              </div>

              <div className="space-y-1 flex flex-col">
                <label className="text-[9px] text-[#64748B] uppercase tracking-wider font-extrabold">Camera Input</label>
                <VideoInputSelect />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
