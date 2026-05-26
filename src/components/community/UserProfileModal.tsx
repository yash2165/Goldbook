'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, MessageSquare, UserPlus, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/Portal'

interface ProfileModalProps {
  userId: string
  currentUserId?: string
  onClose: () => void
  onMessage: (channelId: string) => void
}

export function UserProfileModal({ userId, currentUserId, onClose, onMessage }: ProfileModalProps) {
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState({ trades: 0, winRate: 0, profitFactor: 0 })
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followingLoading, setFollowingLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: pData } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(pData)

      // Fetch public stats (only closed trades)
      const { data: tData } = await supabase.from('trades').select('net_profit').eq('user_id', userId).eq('status', 'closed')
      if (tData && tData.length > 0) {
        const wins = tData.filter(t => (t.net_profit || 0) > 0)
        const losses = tData.filter(t => (t.net_profit || 0) < 0)
        
        const grossProfit = wins.reduce((acc, t) => acc + (t.net_profit || 0), 0)
        const grossLoss = Math.abs(losses.reduce((acc, t) => acc + (t.net_profit || 0), 0))
        
        setStats({
          trades: tData.length,
          winRate: Math.round((wins.length / tData.length) * 100),
          profitFactor: grossLoss === 0 ? 99 : Number((grossProfit / grossLoss).toFixed(2))
        })
      }
      if (currentUserId) {
        const { data: fData } = await supabase.from('friendships')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('friend_id', userId)
          .single()
        if (fData && fData.status === 'accepted') setIsFollowing(true)
      }

      setLoading(false)
    }
    load()
  }, [userId, currentUserId])

  const handleFollow = async () => {
    if (!currentUserId || followingLoading) return
    setFollowingLoading(true)
    if (isFollowing) {
      await supabase.from('friendships').delete().eq('user_id', currentUserId).eq('friend_id', userId)
      setIsFollowing(false)
    } else {
      await supabase.from('friendships').upsert({ user_id: currentUserId, friend_id: userId, status: 'accepted' })
      setIsFollowing(true)
    }
    setFollowingLoading(false)
  }

  const handleMessageClick = () => {
    if (!currentUserId) return
    // Create a unique channel ID for these two users
    const sorted = [currentUserId, userId].sort()
    onMessage(`dm_${sorted[0]}_${sorted[1]}`)
  }

  if (!profile && !loading) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        
        {/* Cover Photo / Header area */}
        <div className="h-32 bg-gradient-to-br from-primary/20 via-[#1a1a2e] to-[#0a0a0f] relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[#64748B]">Loading profile...</div>
        ) : (
          <div className="px-6 pb-6 relative">
            {/* Avatar */}
            <div className="absolute -top-12 left-6 w-24 h-24 rounded-2xl bg-[#12121a] p-1.5">
              <div className="w-full h-full rounded-xl overflow-hidden border border-primary/30 flex items-center justify-center text-3xl font-black text-primary bg-primary/20">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                ) : (
                  profile?.display_name?.charAt(0).toUpperCase() || profile?.username?.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            {/* Actions (right aligned, next to avatar) */}
            <div className="flex justify-end pt-3 h-14 gap-2">
              {userId !== currentUserId && (
                <>
                  <button onClick={handleMessageClick} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors" title="Message">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleFollow}
                    disabled={followingLoading}
                    className={cn("px-4 h-10 rounded-xl flex items-center gap-2 font-semibold transition-colors text-sm shadow-lg", 
                      isFollowing ? "bg-white/10 text-white hover:bg-white/20" : "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
                    )}
                  >
                    <UserPlus className="w-4 h-4" /> {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </>
              )}
            </div>

            {/* User Info */}
            <div className="mt-4 space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {profile?.display_name || 'Trader'}
              </h2>
              <p className="text-sm text-[#94A3B8]">@{profile?.username || 'user'}</p>
              
              {profile?.experience_level && (
                <span className="inline-block mt-2 px-2.5 py-1 bg-white/5 border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-[#64748B]">
                  {profile.experience_level}
                </span>
              )}
            </div>

            {/* Bio */}
            {profile?.bio && (
              <p className="mt-4 text-sm text-[#cbd5e1] leading-relaxed">
                {profile.bio}
              </p>
            )}

            {/* Tags (Pairs + Style) */}
            <div className="flex flex-wrap gap-2 mt-4">
              {profile?.trading_style && (
                <span className="px-2 py-1 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 rounded text-xs font-semibold">
                  {profile.trading_style}
                </span>
              )}
              {profile?.forex_pairs?.map((pair: string) => (
                <span key={pair} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-semibold text-[#94A3B8]">
                  {pair}
                </span>
              ))}
            </div>

            {/* Public Stats */}
            <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-1">Trades</p>
                <p className="text-lg font-black tabular-nums">{stats.trades}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-1">Win Rate</p>
                <p className="text-lg font-black tabular-nums">{stats.winRate}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-1">Pr. Factor</p>
                <p className="text-lg font-black tabular-nums text-[#22C55E]">{stats.profitFactor}</p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
    </Portal>
  )
}
