'use client'

import { useState, useEffect } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { useMarketMode } from '@/context/MarketModeContext'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, ShieldAlert, PieChart, Clock, Award,
  AlertTriangle, FileText, CheckCircle2, DollarSign, ArrowUpRight, ArrowDownRight,
  Sparkles, RefreshCw
} from 'lucide-react'
import { parseAngelOneTaxReportText, AngelOneTaxSummary } from '@/lib/angel-one-parser'

export default function IndianAnalyticsPage() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const { currencySymbol, formatCurrency } = useMarketMode()
  const supabase = createClient()

  // Saved Tax Reports from DB
  const [taxReports, setTaxReports] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(true)

  // Angel One Text / File Import modal
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [parsedPreview, setParsedPreview] = useState<AngelOneTaxSummary | null>(null)

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

  // Calculate Indian Market Telemetry from DB trades
  const indianTrades = trades.filter(t => t.status === 'closed')
  const totalPnL = indianTrades.reduce((sum, t) => sum + (t.net_profit ?? 0), 0)

  // Session breakdown (IST)
  const sessionStats = {
    openBell: { name: 'Open Bell (09:15–10:30)', trades: 0, pnl: 0, wins: 0 },
    midSession: { name: 'Mid-Session (10:30–14:00)', trades: 0, pnl: 0, wins: 0 },
    closeBell: { name: 'Close Bell (14:00–15:30)', trades: 0, pnl: 0, wins: 0 },
  }

  // Expiry Day breakdown (Tue, Wed, Thu)
  let expiryTrades = 0
  let expiryPnL = 0
  let nonExpiryTrades = 0
  let nonExpiryPnL = 0

  indianTrades.forEach(t => {
    if (!t.open_time) return
    const d = new Date(t.open_time)
    const day = d.getDay() // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat
    const pnl = t.net_profit ?? 0

    // Expiry days in Indian Markets: Tue (FINNIFTY), Wed (BANKNIFTY), Thu (NIFTY)
    if (day === 2 || day === 3 || day === 4) {
      expiryTrades++
      expiryPnL += pnl
    } else {
      nonExpiryTrades++
      nonExpiryPnL += pnl
    }

    // IST Hour calculation
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

  // Parse text live on change
  const handleTextChange = (txt: string) => {
    setImportText(txt)
    if (txt.length > 50) {
      const parsed = parseAngelOneTaxReportText(txt)
      setParsedPreview(parsed)
    } else {
      setParsedPreview(null)
    }
  }

  // Handle Tax Report Import submit
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
        setImportSuccess(`Successfully imported Angel One Tax P&L Report! ${data.insertedTradesCount} trades added.`)
        setShowImportModal(false)
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

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 text-white">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-[#0D1421] via-[#162238] to-[#0D1421] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-md">
              NSE / BSE Segment
            </span>
            <span className="px-2.5 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest rounded-md">
              Angel One / Zerodha Compatible
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <PieChart className="w-6 h-6 text-primary" /> Indian Market Self-Discovery & Tax Analytics
          </h1>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Analyze your segment performance, STT & brokerage leakage, IST trading session edges, and Angel One P&L Tax Reports.
          </p>
        </div>

        <button
          onClick={() => setShowImportModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-primary to-sky-600 hover:from-sky-500 hover:to-sky-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
        >
          <FileText className="w-4 h-4" /> Import Angel One Tax P&L
        </button>
      </div>

      {/* Tax P&L Summary (Angel One & Broker Consolidated) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: P&L & Taxable Summary */}
        <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" /> Taxable P&L Breakdown
            </h3>
            <span className="text-[10px] font-mono text-[#64748B]">FY 2026-27</span>
          </div>

          <div className="space-y-4">
            <div className="bg-[#060A12] p-4 rounded-xl border border-white/5">
              <p className="text-[10px] text-[#64748B] font-mono uppercase tracking-widest">Total Taxable P&L</p>
              <p className={cn(
                'text-2xl font-black mt-1 tabular-nums',
                (latestReport?.total_taxable_pnl ?? totalPnL) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
              )}>
                {formatCurrency(latestReport?.total_taxable_pnl ?? totalPnL)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#060A12]/60 p-3 rounded-xl border border-white/5 space-y-1">
                <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Intraday (Speculative)</p>
                <p className={cn('font-bold font-mono', (latestReport?.intraday_speculative_pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {formatCurrency(latestReport?.intraday_speculative_pnl ?? 0)}
                </p>
              </div>

              <div className="bg-[#060A12]/60 p-3 rounded-xl border border-white/5 space-y-1">
                <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Options (Non-Speculative)</p>
                <p className={cn('font-bold font-mono', (latestReport?.options_pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {formatCurrency(latestReport?.options_pnl ?? 0)}
                </p>
              </div>

              <div className="bg-[#060A12]/60 p-3 rounded-xl border border-white/5 space-y-1">
                <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Futures (Non-Speculative)</p>
                <p className={cn('font-bold font-mono', (latestReport?.futures_pnl ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {formatCurrency(latestReport?.futures_pnl ?? 0)}
                </p>
              </div>

              <div className="bg-[#060A12]/60 p-3 rounded-xl border border-white/5 space-y-1">
                <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Delivery STCG / LTCG</p>
                <p className="font-bold font-mono text-white">
                  {formatCurrency((latestReport?.delivery_stcg_pnl ?? 0) + (latestReport?.delivery_ltcg_pnl ?? 0))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: STT & Statutory Charges Leakage */}
        <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" /> STT & Charges Leakage
            </h3>
            <span className="text-[10px] font-mono text-amber-400">Statutory Audit</span>
          </div>

          <div className="space-y-4">
            <div className="bg-[#060A12] p-4 rounded-xl border border-white/5 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-[#64748B] font-mono uppercase tracking-widest">Total STT Paid</p>
                <p className="text-xl font-bold text-amber-400 tabular-nums mt-1 font-mono">
                  {formatCurrency(latestReport?.total_stt ?? 479)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#64748B] font-mono uppercase tracking-widest">Charges & Statutory Levies</p>
                <p className="text-xl font-bold text-white tabular-nums mt-1 font-mono">
                  {formatCurrency(latestReport?.total_charges ?? 1156.44)}
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                <AlertTriangle className="w-3.5 h-3.5" /> STT Impact Analysis
              </div>
              <p className="text-[#94A3B8] leading-relaxed text-[11px]">
                Securities Transaction Tax (STT) is levied directly on option sell turnover and equity trades regardless of profitability. In F&O trading, high transaction frequency drains your capital.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#64748B] border-t border-white/5 pt-3">
              <div>
                <span>Account Maintenance (AMC):</span>
                <span className="text-white font-mono ml-1 font-bold">{formatCurrency(latestReport?.non_trade_amc_charges ?? 70.8)}</span>
              </div>
              <div>
                <span>Options Turnover:</span>
                <span className="text-white font-mono ml-1 font-bold">{formatCurrency(latestReport?.options_turnover ?? 7068)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Expiry Day Edge (Tue / Wed / Thu) */}
        <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" /> Expiry Day Edge Analyzer
            </h3>
            <span className="text-[10px] font-mono text-sky-400">FINNIFTY / BANKNIFTY / NIFTY</span>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#060A12] p-4 rounded-xl border border-white/5 space-y-1">
                <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Expiry Days (Tue/Wed/Thu)</p>
                <p className={cn('text-lg font-bold tabular-nums font-mono', expiryPnL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {formatCurrency(expiryPnL)}
                </p>
                <p className="text-[10px] text-[#64748B] font-mono">{expiryTrades} trades taken</p>
              </div>

              <div className="bg-[#060A12] p-4 rounded-xl border border-white/5 space-y-1">
                <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Non-Expiry Days</p>
                <p className={cn('text-lg font-bold tabular-nums font-mono', nonExpiryPnL >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {formatCurrency(nonExpiryPnL)}
                </p>
                <p className="text-[10px] text-[#64748B] font-mono">{nonExpiryTrades} trades taken</p>
              </div>
            </div>

            <div className="p-3.5 bg-[#060A12] border border-white/5 rounded-xl space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-sky-400">Behavioral Expiry Insight</h4>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                {expiryTrades > nonExpiryTrades
                  ? '⚠️ You take over 50% of your trades on Index Expiry Days. Watch out for rapid option decay and hero-to-zero spikes near 2:00 PM IST!'
                  : '✅ Balanced distribution between Expiry and Non-Expiry sessions.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* IST Trading Session Performance (Open Bell / Mid-Session / Close Bell) */}
      <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Indian Market IST Session Edges
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">Analyze your performance across standard NSE/BSE intraday sessions</p>
          </div>

          <div className="flex rounded-lg overflow-hidden text-[10px] font-mono font-bold border border-white/5">
            <span className="bg-[#1E40AF]/30 text-[#93C5FD] px-3 py-1.5 border-r border-white/5">Open Bell (09:15 - 10:30)</span>
            <span className="bg-[#166534]/30 text-[#86EFAC] px-3 py-1.5 border-r border-white/5">Mid-Session (10:30 - 14:00)</span>
            <span className="bg-[#92400E]/30 text-[#FCD34D] px-3 py-1.5">Close Bell (14:00 - 15:30)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Object.entries(sessionStats).map(([key, s], idx) => {
            const winRate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0
            const colors = [
              { bg: 'bg-[#1E40AF]/10', border: 'border-[#1E40AF]/20', accent: '#93C5FD', icon: '🔔' },
              { bg: 'bg-[#166534]/10', border: 'border-[#166534]/20', accent: '#86EFAC', icon: '⚖️' },
              { bg: 'bg-[#92400E]/10', border: 'border-[#92400E]/20', accent: '#FCD34D', icon: '🚀' }
            ][idx]

            return (
              <div key={key} className={cn('p-5 rounded-xl border space-y-4', colors.bg, colors.border)}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{colors.icon}</span>
                    <h4 className="font-bold text-xs text-white uppercase tracking-wider">{s.name}</h4>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-[#64748B] font-mono uppercase tracking-widest">Session Net P&L</p>
                  <p className={cn('text-2xl font-black tabular-nums mt-1 font-mono', s.pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                    {formatCurrency(s.pnl)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/5 pt-3">
                  <div>
                    <span className="text-[10px] text-[#64748B]">Trades</span>
                    <p className="font-bold text-white font-mono mt-0.5">{s.trades}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B]">Win Rate</span>
                    <p className="font-bold text-white font-mono mt-0.5">{winRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Import Angel One Tax P&L Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A0D14] border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-5 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Import Angel One P&L Tax Report
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-[#64748B] hover:text-white text-sm font-bold">✕</button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Paste the text content from your **Angel One Tax P&L PDF** or upload the file content below. Our parser will extract client basic info, ledger summary, segment P&L, STT, statutory charges, and trades!
              </p>

              <textarea
                value={importText}
                onChange={e => handleTextChange(e.target.value)}
                placeholder="Paste Angel One Tax P&L report text here (e.g. Client Name, Financial Year, Taxable Intraday P&L, Total STT)..."
                rows={8}
                className="w-full bg-[#060A12] border border-white/10 rounded-xl p-4 text-xs font-mono text-white focus:outline-none focus:border-primary placeholder-[#334155]"
              />

              {parsedPreview && (
                <div className="p-4 bg-[#060A12] border border-emerald-500/20 rounded-xl space-y-2 text-xs font-mono text-emerald-400">
                  <p className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Angel One Report Detected!
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    Client: {parsedPreview.client_name} ({parsedPreview.client_id}) • FY: {parsedPreview.financial_year}
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    Taxable Intraday P&L: {formatCurrency(parsedPreview.intraday_speculative_pnl)} • Options P&L: {formatCurrency(parsedPreview.options_pnl)} • Total STT: {formatCurrency(parsedPreview.total_stt)}
                  </p>
                  <p className="text-[11px] text-primary">
                    Parsed {parsedPreview.trades.length} trade records ready to sync.
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
