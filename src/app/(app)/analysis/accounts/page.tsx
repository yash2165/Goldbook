'use client'

import { useState } from 'react'
import { useAccounts, MT5Account } from '@/hooks/useAccounts'
import { useTrades } from '@/hooks/useTrades'
import { computeStats, computeEquityCurve, fmt, fmtPct } from '@/lib/calculations'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { 
  TrendingUp, 
  ShieldAlert, 
  Target, 
  Trash2, 
  Power, 
  RefreshCw, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Activity, 
  Info, 
  Server, 
  User, 
  X,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function AccountAnalysisPage() {
  const { accounts, loading: accountsLoading } = useAccounts()
  const [selectedAccId, setSelectedAccId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<'equity' | 'metrics' | 'diagnostics'>('equity')

  const supabase = createClient()

  // Default to the first account if none is explicitly selected
  const activeId = selectedAccId || accounts[0]?.id
  const activeAccount = accounts.find(a => a.id === activeId)
  
  const { trades, loading: tradesLoading } = useTrades(activeId)

  const handleToggleActive = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting the card when clicking toggle
    await supabase.from('mt5_accounts').update({ is_active: !currentStatus }).eq('id', id)
  }

  const handleDeleteAccount = async (id: string) => {
    setDeleting(true)
    try {
      // 1. Delete dependent equity snapshots
      await supabase.from('equity_snapshots').delete().eq('account_id', id)
      // 2. Delete dependent trades
      await supabase.from('trades').delete().eq('account_id', id)
      // 3. Delete the MT5 account
      await supabase.from('mt5_accounts').delete().eq('id', id)
      
      if (selectedAccId === id) {
        setSelectedAccId(null)
      }
    } catch (err) {
      console.error('Failed to delete account:', err)
      alert('Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  if (accountsLoading) {
    return (
      <div className="p-6 h-[calc(100vh-64px)] flex items-center justify-center bg-[#0a0a0f] text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-[#64748B] font-medium tracking-wide">Loading accounts center...</p>
        </div>
      </div>
    )
  }

  // Get status metadata for UI indicators
  const getAccountStatus = (acc: MT5Account) => {
    if (!acc.is_active) {
      return { 
        type: 'paused', 
        label: 'Paused', 
        color: 'bg-neutral-500', 
        badge: 'bg-neutral-500/10 border-neutral-500/20 text-neutral-400',
        glow: 'shadow-neutral-500/10'
      }
    }
    if (acc.last_error) {
      return { 
        type: 'error', 
        label: 'Sync Error', 
        color: 'bg-[#EF4444]', 
        badge: 'bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]',
        glow: 'shadow-[#EF4444]/30 animate-pulse'
      }
    }
    if (!acc.is_verified) {
      return { 
        type: 'connecting', 
        label: 'Connecting', 
        color: 'bg-[#F59E0B]', 
        badge: 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]',
        glow: 'shadow-[#F59E0B]/30 animate-pulse'
      }
    }
    
    // Check if synced recently
    if (acc.last_synced_at) {
      const diff = Date.now() - new Date(acc.last_synced_at).getTime()
      if (diff < 10 * 60 * 1000) {
        return { 
          type: 'synced', 
          label: 'Active & Synced', 
          color: 'bg-[#22C55E]', 
          badge: 'bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]',
          glow: 'shadow-[#22C55E]/40 animate-ping'
        }
      }
    }

    return { 
      type: 'active', 
      label: 'Active', 
      color: 'bg-[#10B981]', 
      badge: 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]',
      glow: 'shadow-[#10B981]/20'
    }
  }

  // Stats & Equity Curve Calculations
  const stats = computeStats(trades)
  const curve = computeEquityCurve(trades, activeAccount?.initial_balance ?? activeAccount?.current_balance ?? 0)

  let peak = activeAccount?.initial_balance ?? activeAccount?.current_balance ?? 0
  let maxDrawdownPct = 0
  curve.forEach(point => {
    if (point.equity > peak) peak = point.equity
    const drawdownAmount = peak - point.equity
    const drawdownPct = peak > 0 ? (drawdownAmount / peak) * 100 : 0
    if (drawdownPct > maxDrawdownPct) {
      maxDrawdownPct = drawdownPct
    }
  })

  const growthPct = activeAccount?.initial_balance 
    ? (((activeAccount.current_balance ?? 0) - activeAccount.initial_balance) / activeAccount.initial_balance) * 100
    : 0

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-foreground overflow-x-hidden p-6 md:p-8">
      {/* Premium Futuristic Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[130px] pointer-events-none" />
      <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-purple-500/3 blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#E2E8F0] to-[#94A3B8] bg-clip-text text-transparent flex items-center gap-3">
              Account Control Center
            </h1>
            <p className="text-sm text-[#64748B] mt-1.5 font-medium">
              Manage your MT5 parallel sync connections, track live execution diagnostic parameters, and view detailed equity curves.
            </p>
          </div>

          <Link href="/connect">
            <motion.button 
              whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(245, 158, 11, 0.25)' }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-[#D97706] hover:from-[#F59E0B] hover:to-[#B45309] text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/10 border border-primary/20"
            >
              <Plus className="w-4 h-4" /> Add MT5 Account
            </motion.button>
          </Link>
        </div>

        {accounts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center p-12 bg-[#12121a]/40 backdrop-blur-xl border border-white/5 rounded-3xl text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
              <Server className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-white mb-2">No MT5 Accounts Connected</h3>
              <p className="text-sm text-[#64748B]">
                Connect your first MetaTrader 5 account to initialize the parallel synchronization system and start tracking your metrics in near real-time.
              </p>
            </div>
            <Link href="/connect">
              <button className="px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-primary/10">
                Connect Account Now
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Account Grid Cards */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Your Connected Accounts ({accounts.length})</span>
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse" /> Live Realtime Sync
                </span>
              </div>
              
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {accounts.map((acc, index) => {
                  const status = getAccountStatus(acc)
                  const isSelected = activeId === acc.id

                  return (
                    <motion.div
                      key={acc.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedAccId(acc.id)}
                      className={cn(
                        "relative bg-[#12121a]/40 backdrop-blur-xl border rounded-2xl p-5 cursor-pointer shadow-xl transition-all duration-300 group overflow-hidden",
                        isSelected 
                          ? "border-primary/45 bg-[#12121a]/85 shadow-primary/5 ring-1 ring-primary/25" 
                          : "border-white/5 hover:border-white/10 hover:bg-[#12121a]/60"
                      )}
                    >
                      {/* Active glowing card effect */}
                      {isSelected && (
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full pointer-events-none" />
                      )}

                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="font-bold text-white text-base group-hover:text-primary transition-colors flex items-center gap-2">
                            {acc.nickname ?? `Account #${acc.mt5_login}`}
                          </h3>
                          <p className="text-xs text-[#64748B] font-semibold flex items-center gap-1.5">
                            <Server className="w-3.5 h-3.5 shrink-0" /> {acc.broker_server}
                          </p>
                        </div>

                        {/* Status Indicator */}
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-md border tracking-wider", status.badge)}>
                            <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", status.color, status.glow)} />
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Balances Block */}
                      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/[0.03]">
                        <div>
                          <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Balance</p>
                          <p className="text-base font-black text-white mt-1 tabular-nums">
                            {fmt(acc.current_balance ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Equity</p>
                          <p className="text-base font-black text-white mt-1 tabular-nums">
                            {fmt(acc.current_equity ?? 0)}
                          </p>
                        </div>
                      </div>

                      {/* Controls Footer */}
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.03]">
                        {/* Toggle active switch */}
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={(e) => handleToggleActive(acc.id, acc.is_active, e)}
                            className={cn(
                              "w-9 h-5 rounded-full relative transition-colors duration-300 outline-none border border-white/5",
                              acc.is_active ? "bg-[#22C55E]" : "bg-neutral-800"
                            )}
                          >
                            <span 
                              className={cn(
                                "absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform duration-300 shadow-md",
                                acc.is_active ? "left-[17px]" : "left-[3px]"
                              )} 
                            />
                          </button>
                          <span className="text-[10px] font-black uppercase text-[#64748B] tracking-wider">
                            {acc.is_active ? "Sync Active" : "Paused"}
                          </span>
                        </div>

                        {/* Trash icon */}
                        <motion.button
                          whileHover={{ scale: 1.1, color: '#EF4444' }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmId(acc.id)
                          }}
                          className="p-2 bg-white/5 hover:bg-[#EF4444]/10 border border-white/5 hover:border-[#EF4444]/20 text-[#64748B] rounded-xl transition-all"
                          title="Delete Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Right Column: Performance and Stats Details */}
            <div className="lg:col-span-7 space-y-6">
              {activeAccount ? (
                <>
                  {/* Account overview card */}
                  <div className="bg-[#12121a]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none" />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.04]">
                      <div>
                        <h2 className="text-xl font-black text-white">{activeAccount.nickname ?? `MT5 Account #${activeAccount.mt5_login}`}</h2>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1.5">
                          <p className="text-xs text-[#64748B] font-semibold flex items-center gap-1">
                            <Server className="w-3.5 h-3.5" /> Server: <span className="text-neutral-300 font-bold">{activeAccount.broker_server}</span>
                          </p>
                          {activeAccount.last_synced_at && (
                            <p className="text-xs text-[#64748B] font-semibold flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5" /> Synced: <span className="text-neutral-300 font-bold">{new Date(activeAccount.last_synced_at).toLocaleTimeString()}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start">
                        <span className={cn("text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-wider", getAccountStatus(activeAccount).badge)}>
                          <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", getAccountStatus(activeAccount).color, getAccountStatus(activeAccount).glow)} />
                          {getAccountStatus(activeAccount).label}
                        </span>
                      </div>
                    </div>

                    {/* Diagnostics Error Alert Banner */}
                    {activeAccount.last_error && activeAccount.is_active && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-2xl p-4 flex gap-3.5 text-sm text-[#EF4444]"
                      >
                        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="space-y-1.5">
                          <p className="font-bold">Sync Cycle Blocked / Connection Deadlock Resolved</p>
                          <p className="text-xs text-[#FCA5A5] leading-relaxed">
                            {activeAccount.last_error}
                          </p>
                          <div className="pt-1.5 flex gap-3">
                            <span className="text-[10px] font-bold text-white uppercase bg-[#EF4444]/20 border border-[#EF4444]/30 px-2 py-0.5 rounded-md">How to fix</span>
                            <span className="text-xs text-[#FCA5A5] leading-relaxed">Ensure broker credentials are correct. Native Hangover is executing properly; this indicates incorrect server connection strings or investor password mismatch.</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Top Stats Overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-[#0d1017]/60 border border-white/5 rounded-2xl p-4">
                        <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Growth</span>
                        <div className={cn("text-xl font-black mt-1.5 flex items-center gap-0.5 tabular-nums", growthPct >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                          {growthPct >= 0 ? <ArrowUpRight className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                          {growthPct.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-[#0d1017]/60 border border-white/5 rounded-2xl p-4">
                        <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Net P&L</span>
                        <div className={cn("text-xl font-black mt-1.5 tabular-nums", stats.totalPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                          {fmt(stats.totalPnl)}
                        </div>
                      </div>
                      <div className="bg-[#0d1017]/60 border border-white/5 rounded-2xl p-4">
                        <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Win Rate</span>
                        <div className="text-xl font-black text-white mt-1.5 tabular-nums">
                          {stats.winRate}%
                        </div>
                      </div>
                      <div className="bg-[#0d1017]/60 border border-white/5 rounded-2xl p-4">
                        <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Max DD</span>
                        <div className="text-xl font-black text-[#EF4444] mt-1.5 tabular-nums">
                          -{maxDrawdownPct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabs selector */}
                  <div className="flex gap-2 border-b border-white/5 pb-2">
                    {[
                      { id: 'equity', label: 'Equity Curve', icon: TrendingUp },
                      { id: 'metrics', label: 'Performance Metrics', icon: Target },
                      { id: 'diagnostics', label: 'Sync Diagnostics', icon: Activity }
                    ].map(t => {
                      const Icon = t.icon
                      const isActive = activeTab === t.id
                      return (
                        <button
                          key={t.id}
                          onClick={() => setActiveTab(t.id as any)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all border",
                            isActive 
                              ? "bg-primary/10 border-primary/20 text-primary" 
                              : "border-transparent text-[#64748B] hover:text-white hover:bg-white/5"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {t.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Tabs contents */}
                  <div className="min-h-[300px]">
                    <AnimatePresence mode="wait">
                      {activeTab === 'equity' && (
                        <motion.div
                          key="equity-tab"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-[#12121a]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl"
                        >
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white text-sm flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-primary" /> Equity Growth History
                            </h3>
                            <span className="text-[10px] text-[#64748B] font-bold">UPDATED INSTANTLY</span>
                          </div>

                          {tradesLoading ? (
                            <div className="h-64 flex items-center justify-center">
                              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                            </div>
                          ) : curve.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-[#64748B] text-sm gap-2">
                              <Info className="w-6 h-6" />
                              <span>No closed trades available to render growth history curve.</span>
                            </div>
                          ) : (
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <AreaChart data={curve} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="time" hide />
                                  <YAxis hide domain={['auto', 'auto']} />
                                  <Tooltip
                                    contentStyle={{ 
                                      backgroundColor: '#12121a', 
                                      border: '1px solid rgba(255,255,255,0.05)', 
                                      borderRadius: '12px', 
                                      fontSize: '12px',
                                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                                    }}
                                    formatter={(v: any) => [fmt(v), 'Equity']}
                                    labelStyle={{ display: 'none' }}
                                  />
                                  <Area type="monotone" dataKey="equity" stroke="#F59E0B" strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {activeTab === 'metrics' && (
                        <motion.div
                          key="metrics-tab"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-[#12121a]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl"
                        >
                          <h3 className="font-bold text-white text-sm mb-6 flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" /> Core Analytical Performance
                          </h3>
                          
                          {tradesLoading ? (
                            <div className="h-64 flex items-center justify-center">
                              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                              <MetricRow label="Total Completed Trades" value={stats.totalTrades} />
                              <MetricRow label="Winning trades count" value={stats.winningTrades} color="text-[#22C55E]" />
                              <MetricRow label="Losing trades count" value={stats.losingTrades} color="text-[#EF4444]" />
                              <MetricRow label="Profit Factor ratio" value={stats.profitFactor === Infinity ? '99.0+' : stats.profitFactor.toFixed(2)} />
                              <MetricRow label="Average Winning Trade" value={fmt(stats.avgWin)} color="text-[#22C55E]" />
                              <MetricRow label="Average Losing Trade" value={fmt(stats.avgLoss)} color="text-[#EF4444]" />
                              <MetricRow label="Largest Single Profit" value={fmt(stats.bestTrade)} color="text-[#22C55E]" />
                              <MetricRow label="Largest Single Loss" value={fmt(stats.worstTrade)} color="text-[#EF4444]" />
                            </div>
                          )}
                        </motion.div>
                      )}

                      {activeTab === 'diagnostics' && (
                        <motion.div
                          key="diagnostics-tab"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-[#12121a]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6"
                        >
                          <h3 className="font-bold text-white text-sm flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" /> Orchestrator Diagnostic Parameters
                          </h3>
                          
                          <div className="space-y-4">
                            <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                              <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Server className="w-3.5 h-3.5" /> Execution Engine
                              </span>
                              <span className="text-xs font-bold text-neutral-200 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-lg">Hangover 11.4 (ARM64 Native)</span>
                            </div>

                            <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                              <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5" /> MT5 Integration Mode
                              </span>
                              <span className="text-xs font-bold text-neutral-200 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-lg">Isolated Sandboxed Portable File Polling</span>
                            </div>

                            <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                              <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" /> MT5 Login Account
                              </span>
                              <span className="text-xs font-black text-white tabular-nums">{activeAccount.mt5_login}</span>
                            </div>

                            <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                              <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider">Sync Token ID</span>
                              <span className="text-xs font-bold text-neutral-400 font-mono select-all shrink truncate max-w-xs">{activeAccount.sync_token || 'None'}</span>
                            </div>

                            <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                              <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider">Last Synced Timestamp</span>
                              <span className="text-xs font-bold text-neutral-300">
                                {activeAccount.last_synced_at ? new Date(activeAccount.last_synced_at).toLocaleString() : 'Never'}
                              </span>
                            </div>

                            <div className="flex justify-between items-center py-2.5">
                              <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider">Verification Status</span>
                              <span className={cn(
                                "text-xs font-black px-2 py-0.5 rounded-md", 
                                activeAccount.is_verified ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"
                              )}>
                                {activeAccount.is_verified ? 'Verified' : 'Verification Needed'}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : null}
            </div>

          </div>
        )}

      </div>

      {/* Delete Confirmation Glassmorphism Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-md bg-[#12121a]/95 backdrop-blur-2xl border border-[#EF4444]/25 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#EF4444]/5 to-transparent rounded-bl-full pointer-events-none" />
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/25 flex items-center justify-center text-[#EF4444]">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Sync Account?</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">This action is permanent and cannot be undone.</p>
                </div>
              </div>

              <div className="p-4 bg-[#EF4444]/5 border border-[#EF4444]/10 rounded-2xl text-xs text-[#EF4444] leading-relaxed">
                <p className="font-bold">⚠️ Warning: Complete Data Loss</p>
                <p className="mt-1 text-[#FCA5A5]">
                  Deleting this account will permanently delete all related trade execution history, performance analysis logs, and equity snapshots from GoldBook database. The parallel synchronizer will stop tracking this login.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  disabled={deleting}
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={deleting}
                  onClick={() => handleDeleteAccount(deleteConfirmId)}
                  className="flex-1 py-3 bg-gradient-to-r from-[#EF4444] to-[#B91C1C] hover:from-[#DC2626] hover:to-[#991B1B] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center gap-1.5"
                >
                  {deleting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" /> Wipe & Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MetricRow({ label, value, color = "text-white" }: { label: string, value: string | number, color?: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/[0.03] last:border-0">
      <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider">{label}</span>
      <span className={cn("text-sm font-black tabular-nums", color)}>{value}</span>
    </div>
  )
}
