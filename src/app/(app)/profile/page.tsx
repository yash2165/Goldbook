'use client'

import { useState, useEffect } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTrades } from '@/hooks/useTrades'
import { computeStats, fmt } from '@/lib/calculations'
import { createClient } from '@/lib/supabase/client'
import { 
  User, Globe, Clock, Target, Edit3, CheckCircle2, 
  TrendingUp, TrendingDown, Shield, Award, Zap, ArrowUpRight, 
  MapPin, Sparkles, BookOpen 
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function ProfilePage() {
  const { activeAccount } = useAccounts()
  const { trades, loading: loadingTrades } = useTrades(activeAccount?.id)
  const [profile, setProfile] = useState<any>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
          setProfile(data || { email: user.email })
        }
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        setLoadingProfile(false)
      }
    }
    loadProfile()
  }, [])

  const loading = loadingProfile || loadingTrades

  // Compute live statistics using calculations.ts
  const stats = trades.length > 0 ? computeStats(trades) : null
  const hasTrades = trades.length > 0

  const pf = stats ? (stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)) : '—'

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white/90 to-[#64748B] bg-clip-text text-transparent flex items-center gap-2.5">
            <User className="w-8 h-8 text-primary shrink-0" /> Trader Profile
          </h1>
          <p className="text-sm text-[#64748B] mt-1">Your trading identity, strategy setups, and live performance statistics.</p>
        </div>
        <Link href="/settings">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] duration-200">
            <Edit3 className="w-4 h-4" /> Edit Profile & Settings
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Trader Card */}
        <div className="space-y-6 lg:col-span-1">
          {/* Card Wrapper */}
          <div className="bg-gradient-to-b from-[#0D1421] to-[#0d0d13] border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
            {/* Visual glow effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-10 -mt-10" />

            <div className="flex flex-col items-center text-center space-y-4">
              {/* Avatar Initial Badge / Image */}
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/30 flex items-center justify-center text-3xl font-black text-primary shadow-[0_0_20px_rgba(245,159,11,0.15)] bg-gradient-to-br from-primary/20 to-orange-600/20">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile avatar" className="w-full h-full object-cover" />
                ) : (
                  profile?.username?.charAt(0).toUpperCase() || profile?.display_name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase() || '?'
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold text-white truncate max-w-[250px]">
                  {profile?.display_name || profile?.username || 'GoldBook Trader'}
                </h2>
                <p className="text-xs text-primary font-semibold tracking-wide uppercase mt-1">
                  {profile?.trading_style || 'Professional Trader'}
                </p>
              </div>

              {profile?.bio && (
                <div className="w-full pt-2 border-t border-white/5">
                  <p className="text-sm text-[#94A3B8] italic leading-relaxed">
                    "{profile.bio}"
                  </p>
                </div>
              )}

              <div className="w-full pt-4 border-t border-white/5 space-y-2.5 text-xs text-[#94A3B8]">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-primary/70 shrink-0" />
                  <span>Country: <strong className="text-white">{profile?.country || 'Not specified'}</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-primary/70 shrink-0" />
                  <span>Timezone: <strong className="text-white">{profile?.timezone || 'UTC'}</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 text-primary/70 shrink-0" />
                  <span>Status: <strong className="text-[#22C55E]">Active Account</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist custom card */}
          <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Pre-Trade Checklist
            </h3>
            
            {profile?.pre_trade_checklist && profile.pre_trade_checklist.length > 0 ? (
              <div className="space-y-2.5">
                {profile.pre_trade_checklist.map((item: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-white/[0.02] border border-white/5 p-2.5 rounded-lg">
                    <span className="text-primary font-bold text-xs shrink-0 mt-0.5">✓</span>
                    <span className="leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#64748B] text-center py-4 bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
                No custom checklist items configured.
                <Link href="/settings" className="block text-primary hover:underline mt-1 font-semibold">
                  Configure checklist
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Statistics & Strategy Setups */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Performance Stats Section */}
          <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 shadow-xl relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Live Performance Statistics
              </h3>
              {activeAccount && (
                <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  MT5: {activeAccount.nickname || activeAccount.mt5_login}
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#64748B] mt-2">Loading performance statistics...</p>
              </div>
            ) : !hasTrades ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#64748B]">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">No closed trades found</p>
                  <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                    Once you sync your MT5 account or journal manual trades, your premium performance analytics will update here instantly!
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href="/connect">
                    <button className="px-4 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg text-xs font-semibold text-white transition-colors">
                      Connect MT5 Account
                    </button>
                  </Link>
                  <Link href="/trades">
                    <button className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-xs font-semibold text-white transition-colors">
                      Add Manual Trade
                    </button>
                  </Link>
                </div>
              </div>
            ) : stats && (
              <div className="space-y-6">
                {/* 4 Core metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-[#060A12] border border-white/5 p-4 rounded-xl">
                    <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Total P&L</p>
                    <p className={cn(
                      'text-xl font-bold mt-1.5 tabular-nums',
                      stats.totalPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                    )}>
                      {fmt(stats.totalPnl)}
                    </p>
                  </div>

                  <div className="bg-[#060A12] border border-white/5 p-4 rounded-xl">
                    <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Win Rate</p>
                    <p className="text-xl font-bold mt-1.5 tabular-nums">
                      {stats.winRate.toFixed(1)}%
                    </p>
                  </div>

                  <div className="bg-[#060A12] border border-white/5 p-4 rounded-xl">
                    <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Profit Factor</p>
                    <p className="text-xl font-bold mt-1.5 tabular-nums">
                      {pf}
                    </p>
                  </div>

                  <div className="bg-[#060A12] border border-white/5 p-4 rounded-xl">
                    <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Expectancy</p>
                    <p className={cn(
                      'text-xl font-bold mt-1.5 tabular-nums',
                      stats.expectancy >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                    )}>
                      {fmt(stats.expectancy)}
                    </p>
                  </div>
                </div>

                {/* Performance Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/5">
                  {[
                    { label: 'Avg Winner', value: fmt(stats.avgWin), color: 'text-[#22C55E]' },
                    { label: 'Avg Loser', value: `-${fmt(stats.avgLoss, false)}`, color: 'text-[#EF4444]' },
                    { label: 'Avg Risk:Reward', value: `1:${stats.avgRR.toFixed(2)}` },
                    { label: 'Best Trade', value: fmt(stats.bestTrade), color: 'text-[#22C55E]' },
                    { label: 'Worst Trade', value: fmt(stats.worstTrade), color: 'text-[#EF4444]' },
                    { label: 'Total Trades', value: `${stats.closedTrades} closed` },
                    { label: 'Long Win Rate', value: `${stats.longWinRate.toFixed(0)}% (${stats.longTrades} tr)` },
                    { label: 'Short Win Rate', value: `${stats.shortWinRate.toFixed(0)}% (${stats.shortTrades} tr)` },
                    { label: 'Best Winning Streak', value: `${stats.winStreak} trades`, color: 'text-[#22C55E]' },
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-bold">{item.label}</p>
                      <p className={cn('text-sm font-semibold tabular-nums text-white', item.color)}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* View Full History link */}
                <div className="flex justify-end pt-2">
                  <Link href="/analysis/performance" className="flex items-center gap-1 text-xs text-primary hover:underline font-bold">
                    View Interactive Performance Dashboard <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Strategy Setups Section */}
          <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Active Trading Setups
            </h3>

            {profile?.trading_setups && profile.trading_setups.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.trading_setups.map((setup: any, idx: number) => (
                  <div key={idx} className="p-4 bg-[#060A12]/40 border border-white/5 rounded-xl hover:border-white/10 transition-colors space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <h4 className="text-sm font-bold text-white">{setup.name}</h4>
                    </div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      {setup.description || 'No description provided.'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#64748B] text-center py-8 bg-white/[0.01] border border-dashed border-white/5 rounded-xl space-y-2">
                <p>No customized setups have been added to your profile yet.</p>
                <p>Setups let you categorize your trades by entry types (e.g. Liquidity Grab, FVG Fill) and track their individual win rates.</p>
                <Link href="/settings" className="inline-block text-primary hover:underline font-semibold mt-1">
                  Add custom trading setups
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
