'use client'

import { useState, useMemo, Suspense } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { getClosedTrades, fmt } from '@/lib/calculations'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Brain, 
  Target, 
  Layers, 
  Loader2, 
  Award, 
  Activity, 
  DollarSign, 
  Compass, 
  AlertCircle,
  ShieldAlert
} from 'lucide-react'
import Link from 'next/link'

interface StrategyStats {
  name: string
  totalTrades: number
  wins: number
  losses: number
  breakEvens: number
  winRate: number
  totalProfit: number
  avgProfit: number
  avgRR: number
  avgDuration: number
  beforeEmotions: Record<string, number>
  afterEmotions: Record<string, number>
  sessionHours: Record<string, number>
}

// Helper to resolve expressive color-themed emotion labels with emojis
function getEmotionCapsule(emo: string) {
  const clean = emo.toLowerCase().trim()
  let emoji = '😐'
  let colorClass = 'bg-slate-500/10 border-slate-500/20 text-slate-400'

  if (clean === 'confident') { emoji = '✨'; colorClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' }
  else if (clean === 'nervous') { emoji = '🌀'; colorClass = 'bg-purple-500/10 border-purple-500/20 text-purple-400' }
  else if (clean === 'neutral') { emoji = '😐'; colorClass = 'bg-slate-500/10 border-slate-500/20 text-slate-400' }
  else if (clean === 'excited') { emoji = '⚡'; colorClass = 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' }
  else if (clean === 'fearful') { emoji = '😨'; colorClass = 'bg-red-500/10 border-red-500/20 text-red-400' }
  else if (clean === 'greedy') { emoji = '🤑'; colorClass = 'bg-amber-500/10 border-amber-500/20 text-amber-400' }
  else if (clean === 'satisfied') { emoji = '😊'; colorClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' }
  else if (clean === 'regret') { emoji = '😔'; colorClass = 'bg-orange-500/10 border-orange-500/20 text-orange-400' }
  else if (clean === 'relieved') { emoji = '😌'; colorClass = 'bg-teal-500/10 border-teal-500/20 text-teal-400' }
  else if (clean === 'frustrated') { emoji = '😤'; colorClass = 'bg-red-500/10 border-red-500/20 text-red-400' }
  else if (clean === 'proud') { emoji = '🏆'; colorClass = 'bg-amber-500/10 border-amber-500/20 text-amber-400' }

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border capitalize", colorClass)}>
      <span>{emoji}</span>
      <span>{clean}</span>
    </span>
  )
}

function StrategyAnalysisContent() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const closed = getClosedTrades(trades)

  // Group and compute strategy metrics on trades list update
  const strategies = useMemo(() => {
    if (closed.length === 0) return []

    const map: Record<string, StrategyStats> = {}

    closed.forEach(t => {
      const tag = t.setup_tag?.trim() || 'Uncategorized Setup'
      
      if (!map[tag]) {
        map[tag] = {
          name: tag,
          totalTrades: 0,
          wins: 0,
          losses: 0,
          breakEvens: 0,
          winRate: 0,
          totalProfit: 0,
          avgProfit: 0,
          avgRR: 0,
          avgDuration: 0,
          beforeEmotions: {},
          afterEmotions: {},
          sessionHours: {}
        }
      }

      const stat = map[tag]
      stat.totalTrades += 1
      stat.totalProfit += (t.net_profit ?? 0)

      // Wins / Losses / Break Evens
      if ((t.net_profit ?? 0) > 0) stat.wins += 1
      else if ((t.net_profit ?? 0) < 0) stat.losses += 1
      else stat.breakEvens += 1

      // Risk-to-Reward sum
      if (t.rr_ratio != null) {
        stat.avgRR += Number(t.rr_ratio)
      }

      // Duration sum
      if (t.duration_seconds != null) {
        stat.avgDuration += t.duration_seconds
      }

      // Emotions Profiling
      if (t.emotion_before) {
        const emo = t.emotion_before.toLowerCase().trim()
        stat.beforeEmotions[emo] = (stat.beforeEmotions[emo] || 0) + 1
      }
      if (t.emotion_after) {
        const emo = t.emotion_after.toLowerCase().trim()
        stat.afterEmotions[emo] = (stat.afterEmotions[emo] || 0) + 1
      }

      // Session Hours profiling (Tokyo vs London vs NY sessions)
      if (t.open_time) {
        const hour = new Date(t.open_time).getUTCHours()
        let session = 'London Session' // default
        if (hour >= 0 && hour < 8) session = 'Asian Session'
        else if (hour >= 8 && hour < 16) session = 'London Session'
        else session = 'New York Session'

        stat.sessionHours[session] = (stat.sessionHours[session] || 0) + 1
      }
    })

    // Finalize mathematical averages
    return Object.values(map).map(stat => {
      stat.winRate = Math.round((stat.wins / stat.totalTrades) * 100)
      stat.avgProfit = stat.totalProfit / stat.totalTrades
      
      const rrValidCount = closed.filter(t => t.setup_tag === stat.name && t.rr_ratio != null).length
      stat.avgRR = rrValidCount > 0 ? stat.avgRR / rrValidCount : 0

      const durValidCount = closed.filter(t => t.setup_tag === stat.name && t.duration_seconds != null).length
      stat.avgDuration = durValidCount > 0 ? stat.avgDuration / durValidCount : 0

      return stat
    }).sort((a, b) => b.totalProfit - a.totalProfit) // Sort by highest profitability first
  }, [closed])

  // Get key statistics
  const bestStrategy = useMemo(() => {
    if (strategies.length === 0) return null
    return strategies[0] // Since it's already sorted by profitability
  }, [strategies])

  const totalCategorizedTrades = useMemo(() => {
    return strategies.reduce((sum, s) => sum + s.totalTrades, 0)
  }, [strategies])

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-300">
          <Layers className="w-5 h-5 text-primary animate-pulse" /> Strategy Performance Suite
        </h1>
        <p className="text-xs md:text-sm text-[#64748B] mt-0.5">Analyze win rates, psychological tags, sessions, and risk rewards aggregated per setup pattern.</p>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-[#64748B] font-medium font-mono">Compiling strategy performance matrix...</span>
        </div>
      ) : closed.length === 0 ? (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl py-24 text-center max-w-xl mx-auto space-y-4 shadow-xl">
          <Activity className="w-12 h-12 mx-auto text-[#1E293B] mb-2" />
          <div className="space-y-1">
            <p className="text-base font-bold text-white">No Strategy Data Available</p>
            <p className="text-xs text-[#64748B] max-w-xs mx-auto">This account has no closed trades on record. Log closed trades with custom strategy setup tags in the Journal to perform strategy analytics.</p>
          </div>
          <div className="pt-2">
            <Link href="/trades">
              <button className="px-4 py-2 bg-primary hover:bg-primary/95 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-primary/20">
                Log Manual Trade
              </button>
            </Link>
          </div>
        </div>
      ) : strategies.length === 0 ? (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl py-24 text-center max-w-xl mx-auto space-y-4 shadow-xl">
          <ShieldAlert className="w-12 h-12 mx-auto text-amber-500/20 mb-2" />
          <div className="space-y-1">
            <p className="text-base font-bold text-white">Strategy Setups Untagged</p>
            <p className="text-xs text-[#64748B] max-w-xs mx-auto">All logged closed trades currently lack setup tags or strategy classifications. Tag them in the Journal page to expose performance stats.</p>
          </div>
          <div className="pt-2">
            <Link href="/journal">
              <button className="px-4 py-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/20 text-primary font-bold text-xs uppercase tracking-wider rounded-xl transition-all">
                Go to Trade Journal
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Executive Overview Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
            {/* Stat 1: Strategy Count */}
            <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Active Setups</span>
                <span className="text-xl font-black text-white block">{strategies.length} strategies</span>
              </div>
            </div>

            {/* Stat 2: Best strategy */}
            {bestStrategy && (
              <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-xl col-span-1 sm:col-span-2">
                <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center text-[#22C55E] shrink-0">
                  <Award className="w-5 h-5 text-[#22C55E]" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Top Yielding Strategy</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-white capitalize">{bestStrategy.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-[#22C55E]/10 text-[#22C55E] rounded-md font-bold">
                      {bestStrategy.winRate}% WR
                    </span>
                    <span className="text-xs text-[#64748B] font-mono">
                      (Total P&L: +{fmt(bestStrategy.totalProfit)})
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Strategies Detail Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {strategies.map((s, idx) => {
              const isProfit = s.totalProfit >= 0
              
              // Win rate circular progress configuration
              const radius = 28
              const circumference = 2 * Math.PI * radius
              const strokeDashoffset = circumference - (s.winRate / 100) * circumference

              // Find top before emotion
              let topBeforeEmo = 'None'
              let maxBefore = 0
              Object.entries(s.beforeEmotions).forEach(([emo, count]) => {
                if (count > maxBefore) {
                  maxBefore = count
                  topBeforeEmo = emo
                }
              })

              // Find top after emotion
              let topAfterEmo = 'None'
              let maxAfter = 0
              Object.entries(s.afterEmotions).forEach(([emo, count]) => {
                if (count > maxAfter) {
                  maxAfter = count
                  topAfterEmo = emo
                }
              })

              // Find top trading session
              let topSession = 'None'
              let maxSession = 0
              Object.entries(s.sessionHours).forEach(([sess, count]) => {
                if (count > maxSession) {
                  maxSession = count
                  topSession = sess
                }
              })

              return (
                <div key={idx} className="bg-[#12121A] border border-white/5 rounded-2xl p-5 md:p-6 shadow-2xl space-y-5 flex flex-col justify-between relative group hover:border-[#F59E0B]/30 transition-all duration-300">
                  
                  {/* Subtle top decoration */}
                  {isProfit && (
                    <div className="absolute right-0 top-0 w-24 h-24 bg-[#22C55E]/[0.02] rounded-full blur-xl group-hover:bg-[#22C55E]/[0.04] transition-all" />
                  )}

                  {/* Strategy Header */}
                  <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-3">
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-white capitalize group-hover:text-primary transition-colors">{s.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded font-bold text-[#64748B] uppercase tracking-wide border border-white/5">
                        {s.totalTrades} {s.totalTrades === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block mb-0.5">Net Yield</span>
                      <span className={cn(
                        "text-lg font-black font-mono tracking-tight",
                        isProfit ? "text-[#22C55E]" : "text-[#EF4444]"
                      )}>
                        {isProfit ? '+' : ''}{fmt(s.totalProfit)}
                      </span>
                    </div>
                  </div>

                  {/* Core Metrics & Circular Winrate Row */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    
                    {/* Winrate Circle */}
                    <div className="col-span-1 flex flex-col items-center justify-center space-y-1.5 border-r border-white/5 pr-4">
                      <div className="relative flex items-center justify-center">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r={radius}
                            className="stroke-white/[0.02] fill-transparent"
                            strokeWidth="5"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r={radius}
                            className={cn(
                              "fill-transparent transition-all duration-700",
                              s.winRate >= 60 ? "stroke-[#22C55E]" : s.winRate >= 45 ? "stroke-[#3B82F6]" : "stroke-[#EF4444]"
                            )}
                            strokeWidth="5"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-sm font-black font-mono tracking-tighter text-white">{s.winRate}%</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black text-center block">Win Rate</span>
                    </div>

                    {/* Numeric stats */}
                    <div className="col-span-2 grid grid-cols-2 gap-3 pl-2">
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-[#64748B] uppercase tracking-widest font-bold block">Avg P&L</span>
                        <span className={cn("text-xs font-black font-mono block", s.avgProfit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                          {s.avgProfit >= 0 ? '+' : ''}{fmt(s.avgProfit)}
                        </span>
                      </div>
                      
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-[#64748B] uppercase tracking-widest font-bold block">Avg R:R Ratio</span>
                        <span className="text-xs font-black text-white font-mono block">
                          {s.avgRR > 0 ? `1:${s.avgRR.toFixed(1)}` : '—'}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[8px] text-[#64748B] uppercase tracking-widest font-bold block">Win/Loss Split</span>
                        <span className="text-[10px] font-bold text-slate-300 block">
                          {s.wins}W - {s.losses}L {s.breakEvens > 0 ? `- ${s.breakEvens}B` : ''}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[8px] text-[#64748B] uppercase tracking-widest font-bold block">Avg Duration</span>
                        <span className="text-xs font-semibold text-slate-400 block">
                          {s.avgDuration > 0 ? (
                            s.avgDuration < 60 ? `${s.avgDuration.toFixed(0)}s` :
                            s.avgDuration < 3600 ? `${Math.round(s.avgDuration / 60)}m` :
                            `${(s.avgDuration / 3600).toFixed(1)}h`
                          ) : '—'}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Comparative Profiling Blocks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                    
                    {/* Psychological profiling */}
                    <div className="space-y-2">
                      <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Psychological Synergy</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {topBeforeEmo !== 'None' ? (
                          <div className="flex flex-col space-y-0.5">
                            <span className="text-[8px] text-[#64748B] font-bold uppercase tracking-wider">Top Entry State</span>
                            {getEmotionCapsule(topBeforeEmo)}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#64748B] italic">No Entry states logged.</span>
                        )}
                        {topAfterEmo !== 'None' && (
                          <div className="flex flex-col space-y-0.5">
                            <span className="text-[8px] text-[#64748B] font-bold uppercase tracking-wider">Top Exit State</span>
                            {getEmotionCapsule(topAfterEmo)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sessions profiling */}
                    <div className="space-y-2">
                      <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Session / Hour Bias</span>
                      <div className="space-y-0.5">
                        {topSession !== 'None' ? (
                          <>
                            <span className="text-xs font-bold text-white block">{topSession}</span>
                            <span className="text-[8px] text-[#64748B] uppercase tracking-widest font-extrabold block">Optimal yield session</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-[#64748B] italic">No open times registered.</span>
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              )
            })}
          </div>

          {/* Comparative Strategy Leaderboard Table */}
          <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white/90 uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary" /> Setup Performance Leaderboard
              </h3>
              <span className="text-[9px] text-[#64748B] uppercase font-bold">Ranked by Profit</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wider text-[#64748B] border-b border-white/5">
                    <th className="py-2.5 font-bold">Rank</th>
                    <th className="py-2.5 font-bold">Strategy Setup</th>
                    <th className="py-2.5 font-bold text-center">Trades</th>
                    <th className="py-2.5 font-bold text-center">Win Rate</th>
                    <th className="py-2.5 font-bold text-center">Avg R:R</th>
                    <th className="py-2.5 font-bold text-right">Net yield</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {strategies.map((s, idx) => {
                    const isProfit = s.totalProfit >= 0
                    return (
                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-3 font-mono font-bold text-[#64748B]">{idx + 1}</td>
                        <td className="py-3 font-bold text-white capitalize">{s.name}</td>
                        <td className="py-3 text-center text-slate-300 font-mono">{s.totalTrades}</td>
                        <td className="py-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded font-extrabold text-[10px]",
                            s.winRate >= 60 ? "bg-[#22C55E]/10 text-[#22C55E]" : s.winRate >= 45 ? "bg-[#3B82F6]/10 text-[#3B82F6]" : "bg-[#EF4444]/10 text-[#EF4444]"
                          )}>
                            {s.winRate}%
                          </span>
                        </td>
                        <td className="py-3 text-center text-slate-400 font-mono">
                          {s.avgRR > 0 ? `1:${s.avgRR.toFixed(1)}` : '—'}
                        </td>
                        <td className={cn(
                          "py-3 text-right font-bold font-mono",
                          isProfit ? "text-[#22C55E]" : "text-[#EF4444]"
                        )}>
                          {isProfit ? '+' : ''}{fmt(s.totalProfit)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

export default function StrategyAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <StrategyAnalysisContent />
    </Suspense>
  )
}
