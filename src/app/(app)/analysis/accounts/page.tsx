'use client'

import { useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTrades } from '@/hooks/useTrades'
import { computeStats, computeEquityCurve, fmt, fmtPct } from '@/lib/calculations'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronDown, TrendingUp, ShieldAlert, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AccountAnalysisPage() {
  const { accounts } = useAccounts()
  const [selectedAccId, setSelectedAccId] = useState<string | null>(null)
  
  // If no account selected, default to the first one
  const activeId = selectedAccId || accounts[0]?.id
  const activeAccount = accounts.find(a => a.id === activeId)
  
  const { trades, loading } = useTrades(activeId)

  if (accounts.length === 0) {
    return (
      <div className="p-6 h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#64748B] mb-4">No accounts connected yet.</p>
        </div>
      </div>
    )
  }

  const stats = computeStats(trades)
  const curve = computeEquityCurve(trades, activeAccount?.initial_balance ?? activeAccount?.current_balance ?? 0)

  // Drawdown calculation
  let peak = activeAccount?.initial_balance ?? activeAccount?.current_balance ?? 0
  let maxDrawdownAmount = 0
  let maxDrawdownPct = 0
  curve.forEach(point => {
    if (point.equity > peak) peak = point.equity
    const drawdownAmount = peak - point.equity
    const drawdownPct = (drawdownAmount / peak) * 100
    if (drawdownPct > maxDrawdownPct) {
      maxDrawdownPct = drawdownPct
      maxDrawdownAmount = drawdownAmount
    }
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Account Analysis
          </h1>
          <p className="text-sm text-[#64748B] mt-1">Detailed performance tracking per account</p>
        </div>

        {/* Account Selector */}
        <div className="relative group">
          <select 
            value={activeId} 
            onChange={e => setSelectedAccId(e.target.value)}
            className="appearance-none bg-[#12121a] border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:border-primary/50 transition-colors cursor-pointer [color-scheme:dark]"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.nickname ?? `MT5 #${acc.mt5_login}`} ({acc.broker_server})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {!activeAccount ? null : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-5">
              <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Net P&L</p>
              <p className={cn("text-3xl font-black mt-2 tabular-nums", stats.totalPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                {fmt(stats.totalPnl)}
              </p>
            </div>
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-5">
              <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Win Rate</p>
              <p className="text-3xl font-black mt-2 tabular-nums text-white">
                {stats.winRate}%
              </p>
            </div>
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-5">
              <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Profit Factor</p>
              <p className="text-3xl font-black mt-2 tabular-nums text-[#22C55E]">
                {stats.profitFactor === Infinity ? '99+' : stats.profitFactor}
              </p>
            </div>
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-5 border-l-4 border-l-[#EF4444]">
              <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Max Drawdown</p>
              <p className="text-3xl font-black mt-2 tabular-nums text-[#EF4444]">
                -{maxDrawdownPct.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Equity Curve
              </h3>
              {curve.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-[#64748B] text-sm">No closed trades to build curve</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={curve} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#12121a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(v: any) => [fmt(v), 'Equity']}
                        labelStyle={{ display: 'none' }}
                      />
                      <Area type="stepAfter" dataKey="equity" stroke="#3B82F6" strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col">
              <h3 className="font-semibold mb-6 flex items-center gap-2">
                <Target className="w-4 h-4 text-[#F59E0B]" /> Account Metrics
              </h3>
              
              <div className="space-y-4 flex-1">
                <MetricRow label="Total Trades" value={stats.totalTrades} />
                <MetricRow label="Winning Trades" value={stats.winningTrades} />
                <MetricRow label="Losing Trades" value={stats.losingTrades} />
                <MetricRow label="Average Win" value={fmt(stats.avgWin)} color="text-[#22C55E]" />
                <MetricRow label="Average Loss" value={fmt(stats.avgLoss)} color="text-[#EF4444]" />
                <MetricRow label="Largest Win" value={fmt(stats.bestTrade)} color="text-[#22C55E]" />
                <MetricRow label="Largest Loss" value={fmt(stats.worstTrade)} color="text-[#EF4444]" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MetricRow({ label, value, color = "text-white" }: { label: string, value: string | number, color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
      <span className="text-sm text-[#94A3B8]">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", color)}>{value}</span>
    </div>
  )
}
