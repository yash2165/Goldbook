'use client'

import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import {
  computeStats, computeEquityCurve, computeSessionStats,
  computeDayStats, computeTopSymbols, computeDailyPnl,
  computeSetupSessionStats,
  fmt, fmtPct,
} from '@/lib/calculations'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Target, Zap } from 'lucide-react'

type Period = 'Today' | '7D' | '30D' | '3M' | '1Y' | 'All'
type Filter = 'All' | 'Winners' | 'Losers'

const PERIODS: Period[] = ['Today', '7D', '30D', '3M', '1Y', 'All']
const FILTERS: Filter[] = ['All', 'Winners', 'Losers']

function filterTrades(trades: any[], period: Period, filter: Filter) {
  let t = [...trades]
  const now = new Date()
  if (period !== 'All') {
    const days = period === 'Today' ? 1 : period === '7D' ? 7 : period === '30D' ? 30 : period === '3M' ? 90 : 365
    const cutoff = new Date(now.getTime() - days * 86400000)
    t = t.filter(tr => tr.close_time && new Date(tr.close_time) >= cutoff)
  }
  if (filter === 'Winners') t = t.filter(tr => (tr.net_profit ?? 0) > 0)
  if (filter === 'Losers') t = t.filter(tr => (tr.net_profit ?? 0) <= 0)
  return t
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-4', color)}>
        <div className="w-4 h-4 rounded-full bg-current opacity-60" />
      </div>
      <p className="text-xs text-[#64748B] uppercase tracking-wider font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-[#64748B] mt-1">{sub}</p>}
    </div>
  )
}

export default function PerformancePage() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const [period, setPeriod] = useState<Period>('30D')
  const [tradeFilter, setTradeFilter] = useState<Filter>('All')
  const [curveMode, setCurveMode] = useState<'equity' | 'drawdown'>('equity')

  const filtered = filterTrades(trades, period, tradeFilter)
  const stats = computeStats(filtered)
  const startingBalance = (() => {
    const initialBal = activeAccount?.initial_balance ?? activeAccount?.current_balance ?? 10000.0
    if (period === 'All') return initialBal
    const now = new Date()
    const days = period === 'Today' ? 1 : period === '7D' ? 7 : period === '30D' ? 30 : period === '3M' ? 90 : 365
    const cutoff = new Date(now.getTime() - days * 86400000)
    const profitBefore = trades
      .filter(t => t.status === 'closed' && t.net_profit !== null && t.close_time && new Date(t.close_time) < cutoff)
      .reduce((sum, t) => sum + (t.net_profit ?? 0), 0)
    return initialBal + profitBefore
  })()

  const curve = computeEquityCurve(filtered, startingBalance)
  const sessionStats = computeSessionStats(filtered)
  const dayStats = computeDayStats(filtered)
  const topSymbols = computeTopSymbols(filtered)
  const dailyPnl = computeDailyPnl(filtered)
  const setupSessionStats = computeSetupSessionStats(filtered)

  const pf = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Performance Analytics
          </h1>
          <p className="text-sm text-[#64748B] mt-1">Analyze your trading patterns and improve your strategy</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period */}
          <div className="flex bg-[#12121a] border border-white/5 rounded-lg p-1 gap-1">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  period === p ? 'bg-primary text-white' : 'text-[#64748B] hover:text-foreground')}>
                {p}
              </button>
            ))}
          </div>
          {/* Trade filter */}
          <div className="flex bg-[#12121a] border border-white/5 rounded-lg p-1 gap-1">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setTradeFilter(f)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  tradeFilter === f ? 'bg-primary text-white' : 'text-[#64748B] hover:text-foreground')}>
                {f === 'Winners' ? '↑ Winners' : f === 'Losers' ? '↓ Losers' : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <p className="text-xs text-[#64748B] uppercase tracking-wider">Total P&L</p>
          <p className={cn('text-2xl font-bold mt-1 tabular-nums', stats.totalPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
            {loading ? '—' : fmt(stats.totalPnl)}
          </p>
          <p className="text-xs text-[#64748B] mt-1">From {stats.closedTrades} closed trades</p>
        </div>

        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center mb-4">
            <Target className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <p className="text-xs text-[#64748B] uppercase tracking-wider">Win Rate</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{loading ? '—' : `${stats.winRate.toFixed(1)}%`}</p>
          <p className="text-xs text-[#64748B] mt-1">{stats.winningTrades} wins • {stats.losingTrades} losses</p>
        </div>

        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center mb-4">
            <Zap className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <p className="text-xs text-[#64748B] uppercase tracking-wider">Profit Factor</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{loading ? '—' : pf}</p>
          <p className="text-xs text-[#64748B] mt-1">Gross profit ÷ Gross loss (2.0 is good)</p>
        </div>

        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-[#22C55E]/10 flex items-center justify-center mb-4">
            <div className="w-5 h-5 text-[#22C55E] font-bold text-xs flex items-center justify-center">$</div>
          </div>
          <p className="text-xs text-[#64748B] uppercase tracking-wider">Expectancy</p>
          <p className={cn('text-2xl font-bold mt-1 tabular-nums', stats.expectancy >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
            {loading ? '—' : fmt(stats.expectancy)}
          </p>
          <p className="text-xs text-[#64748B] mt-1">Average profit per trade</p>
        </div>
      </div>

      {/* Quick Stats + Equity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick stats */}
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center text-[10px] text-primary">↗</span>
            Quick Stats
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Avg Winner', value: fmt(stats.avgWin), cls: 'text-[#22C55E]' },
              { label: 'Avg Loser', value: `-${fmt(stats.avgLoss, false)}`, cls: 'text-[#EF4444]' },
              { label: 'Best Trade', value: fmt(stats.bestTrade), cls: 'text-[#22C55E]' },
              { label: 'Worst Trade', value: fmt(stats.worstTrade), cls: 'text-[#EF4444]' },
              { label: 'Win Streak', value: `${stats.winStreak} trades`, cls: '' },
              { label: 'Loss Streak', value: `${stats.lossStreak} trades`, cls: '' },
              { label: 'Risk:Reward', value: `1:${stats.avgRR.toFixed(2)}`, cls: '' },
              { label: 'Open Trades', value: `${stats.openTrades}`, cls: '' },
            ].map(item => (
              <div key={item.label} className="space-y-0.5">
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider">{item.label}</p>
                <p className={cn('text-sm font-bold tabular-nums', item.cls || 'text-foreground')}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Equity curve */}
        <div className="lg:col-span-2 bg-[#12121a] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center text-[10px] text-primary">↗</span>
              Equity Curve
            </h2>
            <div className="flex bg-white/5 rounded-lg p-1 gap-1">
              <button onClick={() => setCurveMode('equity')} className={cn('px-3 py-1 rounded text-xs font-medium transition-all', curveMode === 'equity' ? 'bg-primary text-white' : 'text-[#64748B]')}>Equity</button>
              <button onClick={() => setCurveMode('drawdown')} className={cn('px-3 py-1 rounded text-xs font-medium transition-all', curveMode === 'drawdown' ? 'bg-[#EF4444] text-white' : 'text-[#64748B]')}>Drawdown</button>
            </div>
          </div>

          {curve.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-[#334155] gap-2">
              <p className="text-sm">Close more trades to see your equity curve</p>
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={curve} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={curveMode === 'equity' ? '#3B82F6' : '#EF4444'} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={curveMode === 'equity' ? '#3B82F6' : '#EF4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#12121a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: any) => [curveMode === 'equity' ? fmt(v) : `${v.toFixed(1)}%`, curveMode === 'equity' ? 'Equity' : 'Drawdown']}
                  />
                  <Area type="monotone" dataKey={curveMode} stroke={curveMode === 'equity' ? '#3B82F6' : '#EF4444'} strokeWidth={2} fill="url(#equityGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Long vs Short + Day Performance + Top Symbols */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Long vs Short */}
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Long vs Short
          </h2>
          <div className="space-y-4">
            {[
              { label: 'Long', trades: stats.longTrades, pnl: stats.longPnl, winRate: stats.longWinRate, color: '#22C55E', icon: TrendingUp },
              { label: 'Short', trades: stats.shortTrades, pnl: stats.shortPnl, winRate: stats.shortWinRate, color: '#EF4444', icon: TrendingDown },
            ].map(item => (
              <div key={item.label} className="p-4 bg-background/50 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  <span className="font-semibold text-sm">{item.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[#64748B]">Trades</p>
                    <p className="font-bold mt-0.5">{item.trades}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">P&L</p>
                    <p className="font-bold mt-0.5" style={{ color: item.pnl >= 0 ? '#22C55E' : '#EF4444' }}>{fmt(item.pnl)}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Win%</p>
                    <p className="font-bold mt-0.5">{item.winRate.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Day Performance */}
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-[#F59E0B]/20 flex items-center justify-center text-[10px] text-[#F59E0B]">7</span>
            Day Performance
          </h2>
          {dayStats.every(d => d.trades === 0) ? (
            <div className="h-40 flex items-center justify-center text-[#334155] text-sm">No data yet</div>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={dayStats} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="day" stroke="#334155" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#12121a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(v: any) => [fmt(v), 'P&L']}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.05)" />
                  <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                    {dayStats.map((d, i) => (
                      <Cell key={i} fill={d.pnl >= 0 ? '#22C55E' : '#EF4444'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Symbols */}
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-[#8B5CF6]/20 flex items-center justify-center text-[10px] text-[#8B5CF6]">★</span>
            Top Symbols
          </h2>
          {topSymbols.length === 0 ? (
            <div className="py-8 text-center text-[#334155] text-sm">No trades yet</div>
          ) : (
            <div className="space-y-3">
              {topSymbols.slice(0, 5).map(sym => (
                <div key={sym.symbol} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-[#F59E0B]">
                        {sym.symbol.slice(0, 3)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{sym.symbol}</p>
                      <p className="text-[10px] text-[#64748B]">{sym.trades} trades • {sym.winRate.toFixed(0)}% win</p>
                    </div>
                  </div>
                  <span className={cn('text-sm font-bold tabular-nums', sym.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                    {fmt(sym.pnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Session Performance */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center text-[10px] text-primary">◐</span>
          Session Performance
        </h2>
        <p className="text-xs text-[#64748B] mb-5">Breakdown by trading session — Asian, London & New York</p>

        {/* Session timeline bar */}
        <div className="flex rounded-lg overflow-hidden mb-5 text-[10px] font-bold">
          <div className="bg-[#1E40AF]/40 flex-[8] flex items-center justify-center py-2 text-[#93C5FD]">ASIAN</div>
          <div className="bg-[#166534]/40 flex-[8] flex items-center justify-center py-2 text-[#86EFAC]">LONDON</div>
          <div className="bg-[#92400E]/40 flex-[9] flex items-center justify-center py-2 text-[#FCD34D]">NEW YORK</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['Asian', 'London', 'New York'] as const).map((sess, i) => {
            const s = sessionStats[sess] ?? { trades: 0, winRate: 0, avgTrade: 0, volume: 0, pnl: 0 }
            const colors = [
              { bg: 'bg-[#1E40AF]/10', border: 'border-[#1E40AF]/20', icon: '🌙', accent: '#93C5FD' },
              { bg: 'bg-[#166534]/10', border: 'border-[#166534]/20', icon: '🏙️', accent: '#86EFAC' },
              { bg: 'bg-[#92400E]/10', border: 'border-[#92400E]/20', icon: '🗽', accent: '#FCD34D' },
            ][i]
            return (
              <div key={sess} className={cn('p-4 rounded-xl border', colors.bg, colors.border)}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{colors.icon}</span>
                  <div>
                    <p className="font-bold text-sm">{sess}</p>
                    <p className="text-[10px] text-[#64748B]">
                      {sess === 'Asian' ? '00:00 – 08:00 UTC' : sess === 'London' ? '08:00 – 13:00 UTC' : '13:00 – 22:00 UTC'}
                    </p>
                  </div>
                </div>
                <p className={cn('text-xl font-bold tabular-nums mb-3', s.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {fmt(s.pnl)}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[#64748B]">Trades</p>
                    <p className="font-bold mt-0.5">{s.trades}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Win Rate</p>
                    <p className="font-bold mt-0.5">{s.winRate.toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Avg Trade</p>
                    <p className="font-bold mt-0.5">{fmt(s.avgTrade)}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Volume</p>
                    <p className="font-bold mt-0.5">{s.volume.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Strategy-Session Edge Matrix */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-[#F59E0B]/20 flex items-center justify-center text-[10px] text-[#F59E0B]">⚡</span>
          AI Strategy-Session Edge Matrix
        </h2>
        <p className="text-xs text-[#64748B] mb-5">Analyze which setups yield the highest edge across global trading sessions</p>

        {setupSessionStats.length === 0 ? (
          <div className="py-8 text-center text-[#334155] text-sm bg-[#0d1017] border border-white/5 rounded-xl">
            No setup tags logged in filtered trades. Add setup tags in your Journal page!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#94A3B8]">
              <thead className="text-xs uppercase text-[#64748B] border-b border-white/5">
                <tr>
                  <th className="pb-3 font-semibold">Setup / Strategy</th>
                  <th className="pb-3 font-semibold text-center">Asian Session</th>
                  <th className="pb-3 font-semibold text-center">London Session</th>
                  <th className="pb-3 font-semibold text-center">New York Session</th>
                  <th className="pb-3 font-semibold text-right">AI Edge Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {setupSessionStats.map((stat) => {
                  const sessions = [
                    { name: 'Asian', ...stat.Asian },
                    { name: 'London', ...stat.London },
                    { name: 'New York', ...stat['New York'] }
                  ]
                  
                  const activeSessions = sessions.filter(s => s.trades > 0)
                  
                  let verdictText = 'Insufficient Data'
                  let verdictClass = 'bg-white/5 text-[#64748B]'
                  
                  if (activeSessions.length > 0) {
                    const sorted = [...activeSessions].sort((a, b) => b.pnl - a.pnl || b.winRate - a.winRate)
                    const best = sorted[0]
                    const worst = sorted[sorted.length - 1]
                    
                    if (best.pnl > 0 && best.winRate >= 50) {
                      verdictText = `🔥 High Edge in ${best.name}`
                      verdictClass = 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/20 shadow-[0_0_10px_rgba(34,197,94,0.05)]'
                    } else if (worst.pnl < 0 && worst.winRate < 45) {
                      verdictText = `⚠️ Poor Edge in ${worst.name}`
                      verdictClass = 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/20 shadow-[0_0_10px_rgba(239,68,68,0.05)]'
                    } else {
                      verdictText = '⚡ Moderate Compliance'
                      verdictClass = 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/20 shadow-[0_0_10px_rgba(245,159,11,0.05)]'
                    }
                  }

                  return (
                    <tr key={stat.setup} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 pr-4 font-bold text-white uppercase tracking-wider text-xs">
                        {stat.setup}
                      </td>
                      {(['Asian', 'London', 'New York'] as const).map((sessName) => {
                        const cell = stat[sessName]
                        if (cell.trades === 0) {
                          return (
                            <td key={sessName} className="py-4 px-2 text-center text-[11px] text-[#334155] italic">
                              No trades
                            </td>
                          )
                        }
                        return (
                          <td key={sessName} className="py-4 px-2 text-center">
                            <div className="inline-block">
                              <p className={cn("text-xs font-bold tabular-nums", cell.pnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                                {fmt(cell.pnl)}
                              </p>
                              <p className="text-[10px] text-[#64748B] mt-0.5 font-medium">
                                {cell.winRate.toFixed(0)}% Win • {cell.trades}t
                              </p>
                            </div>
                          </td>
                        )
                      })}
                      <td className="py-4 pl-4 text-right">
                        <span className={cn("px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest border", verdictClass)}>
                          {verdictText}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
