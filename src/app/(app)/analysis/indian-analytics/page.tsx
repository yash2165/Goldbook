'use client'

import { useState, useEffect, useRef } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { useMarketMode } from '@/context/MarketModeContext'
import { createClient } from '@/lib/supabase/client'
import { computeStats, computeEquityCurve, fmt } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, ShieldAlert, PieChart, Clock, Award,
  AlertTriangle, FileText, CheckCircle2, DollarSign, ArrowUpRight, ArrowDownRight,
  Sparkles, RefreshCw, Upload, File, Layers, Zap, Target, BarChart2
} from 'lucide-react'
import { parseAngelOneTaxReportText, AngelOneTaxSummary } from '@/lib/angel-one-parser'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts'

type Period = '7D' | '30D' | '3M' | '1Y' | 'All'

export default function IndianAnalyticsPage() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const { currencySymbol, formatCurrency } = useMarketMode()
  const supabase = createClient()

  // State
  const [period, setPeriod] = useState<Period>('30D')
  const [curveMode, setCurveMode] = useState<'equity' | 'drawdown'>('equity')
  const [taxReports, setTaxReports] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(true)

  // File Import Modal State
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [parsedPreview, setParsedPreview] = useState<AngelOneTaxSummary | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch saved Tax Reports
  const fetchReports = async () => {
    setLoadingReports(true)
    try {
      const { data } = await supabase
        .from('tax_pnl_reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setTaxReports(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingReports(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  // Filter Trades by Period
  const filterByPeriod = (tradesList: any[]) => {
    const closed = tradesList.filter(t => t.status === 'closed')
    if (period === 'All') return closed

    const now = new Date()
    const days = period === '7D' ? 7 : period === '30D' ? 30 : period === '3M' ? 90 : 365
    const cutoff = new Date(now.getTime() - days * 86400000)

    return closed.filter(t => t.close_time && new Date(t.close_time) >= cutoff)
  }

  const indianTrades = filterByPeriod(trades)
  const stats = computeStats(indianTrades)
  const startingBalance = activeAccount?.initial_balance ?? activeAccount?.current_balance ?? 250000
  const equityCurve = computeEquityCurve(indianTrades, startingBalance)

  // Session breakdown (IST: UTC + 5:30)
  const sessionStats = {
    openBell: { name: 'Open Bell (09:15–10:30)', trades: 0, pnl: 0, wins: 0 },
    midSession: { name: 'Mid-Session (10:30–14:00)', trades: 0, pnl: 0, wins: 0 },
    closeBell: { name: 'Close Bell (14:00–15:30)', trades: 0, pnl: 0, wins: 0 },
  }

  // Expiry Day Breakdown (Tue: FINNIFTY, Wed: BANKNIFTY, Thu: NIFTY)
  let expiryTrades = 0
  let expiryPnL = 0
  let nonExpiryTrades = 0
  let nonExpiryPnL = 0

  // Instrument Breakdown (NIFTY, BANKNIFTY, FINNIFTY, SENSEX, EQUITIES)
  const instrumentMap: Record<string, { trades: number; pnl: number; wins: number }> = {}

  // Segment Breakdown (Options vs Intraday vs Futures vs Delivery)
  const segmentMap = {
    options: { name: 'Options (F&O)', trades: 0, pnl: 0, wins: 0 },
    futures: { name: 'Futures (F&O)', trades: 0, pnl: 0, wins: 0 },
    intraday: { name: 'Equity Intraday', trades: 0, pnl: 0, wins: 0 },
    delivery: { name: 'Delivery / STCG', trades: 0, pnl: 0, wins: 0 },
  }

  indianTrades.forEach(t => {
    if (!t.open_time) return
    const d = new Date(t.open_time)
    const day = d.getDay()
    const pnl = t.net_profit ?? 0

    // Expiry days
    if (day === 2 || day === 3 || day === 4) {
      expiryTrades++
      expiryPnL += pnl
    } else {
      nonExpiryTrades++
      nonExpiryPnL += pnl
    }

    // Instrument grouping
    const symBase = (t.symbol || 'NIFTY').split(' ')[0].toUpperCase()
    if (!instrumentMap[symBase]) {
      instrumentMap[symBase] = { trades: 0, pnl: 0, wins: 0 }
    }
    instrumentMap[symBase].trades++
    instrumentMap[symBase].pnl += pnl
    if (pnl > 0) instrumentMap[symBase].wins++

    // Segment grouping
    const instType = t.instrument_type || (t.symbol?.includes('CE') || t.symbol?.includes('PE') ? 'options' : 'intraday')
    if (instType === 'options') {
      segmentMap.options.trades++
      segmentMap.options.pnl += pnl
      if (pnl > 0) segmentMap.options.wins++
    } else if (instType === 'futures') {
      segmentMap.futures.trades++
      segmentMap.futures.pnl += pnl
      if (pnl > 0) segmentMap.futures.wins++
    } else {
      segmentMap.intraday.trades++
      segmentMap.intraday.pnl += pnl
      if (pnl > 0) segmentMap.intraday.wins++
    }

    // IST Session calculation
    const istMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440
    const istHour = Math.floor(istMinutes / 60)

    if (istHour === 9 || (istHour === 10 && (istMinutes % 60) < 30)) {
      sessionStats.openBell.trades++
      sessionStats.openBell.pnl += pnl
      if (pnl > 0) sessionStats.openBell.wins++
    } else if (istHour >= 11 && istHour < 14) {
      sessionStats.midSession.trades++
      sessionStats.midSession.pnl += pnl
      if (pnl > 0) sessionStats.midSession.wins++
    } else if (istHour >= 14 && istHour < 16) {
      sessionStats.closeBell.trades++
      sessionStats.closeBell.pnl += pnl
      if (pnl > 0) sessionStats.closeBell.wins++
    }
  })

  // Top Instruments sorted by trade count
  const topInstruments = Object.entries(instrumentMap)
    .map(([symbol, data]) => ({ symbol, ...data, winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0 }))
    .sort((a, b) => b.trades - a.trades)

  // Handle Angel One File Select / Drop
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setImporting(true)
    setParsedPreview(null)
    setImportText('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/trades/parse-file', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (res.ok && data.parsedReport) {
        setParsedPreview(data.parsedReport)
        setImportText(data.extractedTextSnippet || '')
      } else {
        alert(data.error || 'Failed to parse file. Please upload a valid Angel One TradeBook or Tax P&L file.')
      }
    } catch (err) {
      console.error('Error parsing file:', err)
      alert('Error parsing uploaded file. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  // Handle Import Submit
  const handleImportReport = async () => {
    if (!parsedPreview) return
    setImporting(true)
    setImportSuccess(null)

    try {
      const res = await fetch('/api/trades/import-tax-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: parsedPreview,
          broker: 'angel_one'
        })
      })

      const data = await res.json()
      if (res.ok) {
        setImportSuccess(`Successfully imported Angel One TradeBook / Tax Report! ${data.insertedTradesCount} trades synced.`)
        setShowImportModal(false)
        setSelectedFile(null)
        setImportText('')
        setParsedPreview(null)
        fetchReports()
      } else {
        alert(data.error || 'Failed to import report')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setImporting(false)
    }
  }

  const latestReport = taxReports[0]
  const totalSTT = latestReport?.total_stt ?? 479
  const totalLevies = latestReport?.total_charges ?? 1156.44
  const pf = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 text-white">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-[#0D1421] via-[#162238] to-[#0D1421] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-md">
              NSE / BSE Segment
            </span>
            <span className="px-2.5 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest rounded-md">
              Angel One Official Importer
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <PieChart className="w-6 h-6 text-primary" /> Indian Market Self-Discovery & Performance Analytics
          </h1>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Deep-dive performance telemetry for NIFTY, BANKNIFTY, F&O Options, STT Leakage, IST Session Edges & Angel One TradeBook Reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex bg-[#060A12] border border-white/5 rounded-xl p-1 gap-1">
            {(['7D', '30D', '3M', '1Y', 'All'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  period === p ? 'bg-primary text-white shadow-md' : 'text-[#64748B] hover:text-white'
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-sky-600 hover:from-sky-500 hover:to-sky-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Upload Angel One File
          </button>
        </div>
      </div>

      {/* 4 Core Indian Performance KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0D1421] border border-white/5 p-5 rounded-2xl space-y-1">
          <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Total Net Realized P&L</p>
          <p className={cn('text-2xl font-black tabular-nums font-mono mt-1', stats.totalPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
            {formatCurrency(stats.totalPnl)}
          </p>
          <p className="text-[10px] text-[#64748B]">{stats.closedTrades} closed trades in period</p>
        </div>

        <div className="bg-[#0D1421] border border-white/5 p-5 rounded-2xl space-y-1">
          <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Win Rate %</p>
          <p className="text-2xl font-black tabular-nums text-white mt-1 font-mono">
            {stats.winRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-[#64748B]">{stats.winningTrades} wins • {stats.losingTrades} losses</p>
        </div>

        <div className="bg-[#0D1421] border border-white/5 p-5 rounded-2xl space-y-1">
          <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Profit Factor & RR</p>
          <p className="text-2xl font-black tabular-nums text-primary mt-1 font-mono">
            {pf}
          </p>
          <p className="text-[10px] text-[#64748B]">Avg R:R 1:{stats.avgRR.toFixed(2)}</p>
        </div>

        <div className="bg-[#0D1421] border border-white/5 p-5 rounded-2xl space-y-1">
          <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">STT & Statutory Levies</p>
          <p className="text-2xl font-black tabular-nums text-amber-400 mt-1 font-mono">
            {formatCurrency(totalLevies)}
          </p>
          <p className="text-[10px] text-amber-400/80">STT Paid: {formatCurrency(totalSTT)}</p>
        </div>
      </div>

      {/* Indian Equity Curve Chart + Performance Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve Chart */}
        <div className="lg:col-span-2 bg-[#0D1421] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Indian F&O & Equity P&L Curve
              </h3>
              <p className="text-xs text-[#64748B]">Account growth & drawdown progression over time</p>
            </div>

            <div className="flex bg-[#060A12] border border-white/5 rounded-lg p-1 gap-1">
              <button
                onClick={() => setCurveMode('equity')}
                className={cn('px-3 py-1 rounded-md text-xs font-bold transition-all', curveMode === 'equity' ? 'bg-primary text-white' : 'text-[#64748B]')}
              >
                Cumulated P&L
              </button>
              <button
                onClick={() => setCurveMode('drawdown')}
                className={cn('px-3 py-1 rounded-md text-xs font-bold transition-all', curveMode === 'drawdown' ? 'bg-[#EF4444] text-white' : 'text-[#64748B]')}
              >
                Drawdown %
              </button>
            </div>
          </div>

          {equityCurve.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-[#64748B] text-xs font-bold uppercase tracking-wider bg-[#060A12]/50 border border-dashed border-white/5 rounded-xl">
              No closed trades in selected period to plot curve
            </div>
          ) : (
            <div className="h-64 font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={equityCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="indianEquityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={curveMode === 'equity' ? '#38BDF8' : '#EF4444'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={curveMode === 'equity' ? '#38BDF8' : '#EF4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#64748B" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} axisLine={false} tickLine={false} width={65} tickFormatter={val => formatCurrency(val)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0A0D14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(v: any) => [curveMode === 'equity' ? formatCurrency(v) : `${v.toFixed(1)}%`, curveMode === 'equity' ? 'Equity P&L' : 'Drawdown']}
                  />
                  <Area
                    type="monotone"
                    dataKey={curveMode}
                    stroke={curveMode === 'equity' ? '#38BDF8' : '#EF4444'}
                    strokeWidth={2.5}
                    fill="url(#indianEquityGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Angel One Tax Report Summary Card */}
        <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" /> Angel One Tax P&L Audit
            </h3>
            <span className="text-[10px] font-mono text-[#64748B]">Official Report</span>
          </div>

          <div className="space-y-4">
            <div className="bg-[#060A12] p-4 rounded-xl border border-white/5 space-y-1">
              <p className="text-[10px] text-[#64748B] font-mono uppercase tracking-widest">Taxable Intraday + Options P&L</p>
              <p className={cn(
                'text-2xl font-black mt-1 tabular-nums font-mono',
                (latestReport?.total_taxable_pnl ?? stats.totalPnl) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
              )}>
                {formatCurrency(latestReport?.total_taxable_pnl ?? stats.totalPnl)}
              </p>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2.5 bg-[#060A12]/60 rounded-lg border border-white/5">
                <span className="text-[#64748B]">Options (Non-Speculative):</span>
                <span className={cn('font-bold', (latestReport?.options_pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {formatCurrency(latestReport?.options_pnl ?? 0)}
                </span>
              </div>
              <div className="flex justify-between p-2.5 bg-[#060A12]/60 rounded-lg border border-white/5">
                <span className="text-[#64748B]">Intraday (Speculative):</span>
                <span className={cn('font-bold', (latestReport?.intraday_speculative_pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {formatCurrency(latestReport?.intraday_speculative_pnl ?? 0)}
                </span>
              </div>
              <div className="flex justify-between p-2.5 bg-[#060A12]/60 rounded-lg border border-white/5">
                <span className="text-[#64748B]">Total STT Paid:</span>
                <span className="font-bold text-amber-400">{formatCurrency(totalSTT)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* IST Session & Expiry Performance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* IST Session Performance */}
        <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> IST Intraday Sessions Edge
              </h3>
              <p className="text-[10px] text-[#64748B] mt-0.5">Open Bell (09:15-10:30) • Mid-Session (10:30-14:00) • Close Bell (14:00-15:30)</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {Object.entries(sessionStats).map(([key, s], idx) => {
              const wr = s.trades > 0 ? (s.wins / s.trades) * 100 : 0
              const colors = [
                { bg: 'bg-[#1E40AF]/10', border: 'border-[#1E40AF]/20', accent: '#93C5FD', icon: '🔔' },
                { bg: 'bg-[#166534]/10', border: 'border-[#166534]/20', accent: '#86EFAC', icon: '⚖️' },
                { bg: 'bg-[#92400E]/10', border: 'border-[#92400E]/20', accent: '#FCD34D', icon: '🚀' }
              ][idx]

              return (
                <div key={key} className={cn('p-4 rounded-xl border space-y-3', colors.bg, colors.border)}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{colors.icon}</span>
                    <p className="text-[10px] font-bold text-white uppercase tracking-wider truncate">{s.name.split(' ')[0]}</p>
                  </div>
                  <div>
                    <p className={cn('text-lg font-black tabular-nums font-mono', s.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                      {formatCurrency(s.pnl)}
                    </p>
                    <p className="text-[10px] text-[#64748B] font-mono">{s.trades} tr • {wr.toFixed(0)}% win</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Expiry Days Edge (Tue / Wed / Thu) */}
        <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" /> Index Expiry Day Edge
              </h3>
              <p className="text-[10px] text-[#64748B] mt-0.5">Tuesday (FINNIFTY), Wednesday (BANKNIFTY), Thursday (NIFTY)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#060A12] p-4 rounded-xl border border-white/5 space-y-1">
              <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Expiry Days Performance</p>
              <p className={cn('text-xl font-black tabular-nums font-mono', expiryPnL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                {formatCurrency(expiryPnL)}
              </p>
              <p className="text-[10px] text-[#64748B] font-mono">{expiryTrades} trades executed</p>
            </div>

            <div className="bg-[#060A12] p-4 rounded-xl border border-white/5 space-y-1">
              <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Non-Expiry Days Performance</p>
              <p className={cn('text-xl font-black tabular-nums font-mono', nonExpiryPnL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                {formatCurrency(nonExpiryPnL)}
              </p>
              <p className="text-[10px] text-[#64748B] font-mono">{nonExpiryTrades} trades executed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Traded Instruments Table */}
      <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> Top Traded Indian Instruments
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-mono text-[#64748B] uppercase">
                <th className="pb-3">Instrument / Symbol</th>
                <th className="pb-3 text-right">Total Trades</th>
                <th className="pb-3 text-right">Win Rate %</th>
                <th className="pb-3 text-right">Net Realized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {topInstruments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#64748B] text-xs">
                    No closed trades to display
                  </td>
                </tr>
              ) : (
                topInstruments.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="py-3 font-bold text-white font-mono flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-white/5 text-[10px] font-bold flex items-center justify-center text-[#64748B]">{idx + 1}</span>
                      {item.symbol}
                    </td>
                    <td className="py-3 text-right font-mono text-[#94A3B8]">{item.trades}</td>
                    <td className="py-3 text-right font-mono text-white font-bold">{item.winRate.toFixed(1)}%</td>
                    <td className={cn('py-3 text-right font-mono font-black', item.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                      {formatCurrency(item.pnl)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Angel One Direct File Upload Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0A0D14] border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" /> Upload Angel One Trade History / Tax P&L File
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-[#64748B] hover:text-white text-sm font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Select or drop your official **Angel One TradeBook Excel / CSV / PDF export** or paste the content below to extract your trades and charges automatically!
              </p>

              {/* File Drag & Drop Zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf,.txt"
                onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider">
                    {selectedFile ? selectedFile.name : 'Click to Upload or Drag & Drop Angel One File'}
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-1 font-mono">
                    Supports TradeBook (.xlsx, .csv) and Tax P&L Reports (.pdf, .txt)
                  </p>
                </div>
              </div>

              {/* Manual Text Paste Option */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Or Paste Angel One Report Text</label>
                <textarea
                  value={importText}
                  onChange={e => {
                    setImportText(e.target.value)
                    if (e.target.value.length > 50) setParsedPreview(parseAngelOneTaxReportText(e.target.value))
                  }}
                  placeholder="Paste Angel One tradebook text here..."
                  rows={4}
                  className="w-full bg-[#060A12] border border-white/10 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-primary placeholder-[#334155]"
                />
              </div>

              {parsedPreview && (
                <div className="p-4 bg-[#060A12] border border-emerald-500/20 rounded-xl space-y-2 text-xs font-mono text-emerald-400">
                  <p className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Angel One Report Parsed!
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    Client ID: {parsedPreview.client_id || 'DIGIA1115'} • Total Taxable P&L: {formatCurrency(parsedPreview.total_taxable_pnl)}
                  </p>
                  <p className="text-[11px] text-primary">
                    Detected {parsedPreview.trades.length} trade contracts ready to sync.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleImportReport}
                disabled={!parsedPreview || importing}
                className="px-5 py-2 bg-primary hover:bg-sky-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
              >
                {importing && <RefreshCw className="w-4 h-4 animate-spin" />} Confirm & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
