'use client'

import { useState, useEffect, Suspense } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { getClosedTrades, fmt } from '@/lib/calculations'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Hash, 
  Search, 
  Star, 
  BookOpen, 
  Loader2,
  ChevronLeft,
  Brain,
  BarChart3,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Percent,
  Camera
} from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border capitalize", colorClass)}>
      <span>{emoji}</span>
      <span>{clean}</span>
    </span>
  )
}

// 100% Real dynamic database-backed score logic
function calculateTradeQualityScore(trade: any) {
  const profitability = (trade.net_profit ?? 0) > 0 ? 30 : (trade.net_profit ?? 0) === 0 ? 15 : 0

  // Execution Score: Max 40 points
  // A. Checklist Compliance: Max 20 points
  let checklistScore = 10 // baseline default
  const checklist = trade.pre_trade_checklist
  if (checklist && typeof checklist === 'object' && Object.keys(checklist).length > 0) {
    const total = Object.keys(checklist).length
    const checked = Object.values(checklist).filter(Boolean).length
    checklistScore = Math.round((checked / total) * 20)
  }

  // B. Risk-to-reward ratio: Max 10 points
  const rrScore = trade.rr_ratio != null ? (trade.rr_ratio >= 1.5 ? 10 : 5) : 5

  // C. Mental discipline rating: Max 10 points
  const mentalScore = trade.rating != null ? (trade.rating >= 4 ? 10 : trade.rating === 3 ? 5 : 0) : 0

  const execution = checklistScore + rrScore + mentalScore

  // Journal Richness: Max 20 points
  const hasSetup = trade.setup_tag ? 5 : 0
  const hasEmoBefore = trade.emotion_before ? 5 : 0
  const hasEmoAfter = trade.emotion_after ? 5 : 0
  const hasNotes = trade.notes && trade.notes.trim().length > 10 ? 5 : 0
  const journal = hasSetup + hasEmoBefore + hasEmoAfter + hasNotes

  // Rating mapping: Max 10 points
  const ratingScore = (trade.rating ?? 0) * 2

  const total = profitability + execution + journal + ratingScore

  return {
    total,
    breakdown: {
      profitability,
      execution,
      journal,
      rating: ratingScore
    }
  }
}

// Dynamic average stats generator for vs average comparison
function calculateAverages(closedTrades: any[]) {
  const winners = closedTrades.filter(t => (t.net_profit ?? 0) > 0)
  const avgWinnerPnl = winners.length > 0
    ? winners.reduce((sum, t) => sum + (t.net_profit ?? 0), 0) / winners.length
    : 0

  const withDuration = closedTrades.filter(t => t.duration_seconds != null)
  const avgDurationSeconds = withDuration.length > 0
    ? withDuration.reduce((sum, t) => sum + t.duration_seconds, 0) / withDuration.length
    : 0

  return {
    avgWinnerPnl,
    avgDurationSeconds
  }
}

function TradeAnalysisContent() {
  const { activeAccount } = useAccounts()
  const { trades, loading, refetch } = useTrades(activeAccount?.id)
  const closed = getClosedTrades(trades)
  
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'winners' | 'losers'>('all')
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)

  const searchParams = useSearchParams()
  const replayId = searchParams.get('replay')
  const router = useRouter()

  // Sync parameters & auto-selection on mount
  useEffect(() => {
    if (closed.length > 0) {
      if (replayId) {
        const match = closed.find(t => t.id === replayId)
        if (match) {
          setSelectedTrade(match)
          return
        }
      }
      // If no replay parameter or match, select the first closed trade automatically
      if (!selectedTrade) {
        setSelectedTrade(closed[0])
      }
    }
  }, [replayId, closed])

  // Reset selected trade if list becomes empty or account shifts
  useEffect(() => {
    if (closed.length === 0) {
      setSelectedTrade(null)
    } else if (selectedTrade && !closed.some(t => t.id === selectedTrade.id)) {
      setSelectedTrade(closed[0])
    }
  }, [closed])

  const [screenshots, setScreenshots] = useState<any[]>([])

  // Fetch screenshots when selectedTrade changes
  useEffect(() => {
    if (!selectedTrade) {
      setScreenshots([])
      return
    }
    async function loadScreenshots() {
      try {
        const res = await fetch(`/api/trades/upload-screenshot?tradeId=${selectedTrade.id}`)
        const data = await res.json()
        if (res.ok && data.screenshots) {
          setScreenshots(data.screenshots)
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadScreenshots()
  }, [selectedTrade])

  // Clipboard paste CTRL+V handler for screenshots on Trade Analysis page
  useEffect(() => {
    if (!selectedTrade) return

    const handlePaste = async (e: ClipboardEvent) => {
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file.type.startsWith('image/')) {
          e.preventDefault()
          await uploadScreenshot(file)
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [selectedTrade])

  const uploadScreenshot = async (file: File) => {
    if (!selectedTrade) return
    setUploadingScreenshot(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tradeId', selectedTrade.id)

    try {
      const res = await fetch('/api/trades/upload-screenshot', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok && data.screenshot) {
        setScreenshots(prev => [...prev, data.screenshot])
      } else {
        alert(data.error || 'Failed to upload screenshot.')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred during file upload.')
    } finally {
      setUploadingScreenshot(false)
    }
  }

  const updateScreenshotCaption = async (id: string, caption: string) => {
    try {
      await fetch('/api/trades/upload-screenshot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ id, caption }]
        })
      })
    } catch (err) {
      console.error('Failed to update caption:', err)
    }
  }

  const deleteScreenshot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this screenshot?')) return
    setUploadingScreenshot(true)
    try {
      const res = await fetch(`/api/trades/upload-screenshot?id=${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete screenshot')
      }
      setScreenshots(prev => prev.filter(s => s.id !== id))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUploadingScreenshot(false)
    }
  }


  // Filter calculations
  const filtered = closed.filter(t => {
    const matchesSearch = String(t.symbol).toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (activeTab === 'winners') return (t.net_profit ?? 0) > 0
    if (activeTab === 'losers') return (t.net_profit ?? 0) < 0
    return true
  })

  // Global averages calculations
  const { avgWinnerPnl, avgDurationSeconds } = calculateAverages(closed)

  const handleSelectTrade = (trade: any) => {
    setSelectedTrade(trade)
    // Update the URL query params without breaking page states
    router.replace(`/analysis/trade-analysis?replay=${trade.id}`, { scroll: false })
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" /> Trade Analysis
          </h1>
          <p className="text-xs md:text-sm text-[#64748B] mt-0.5">Evaluate execution discipline, review journal dossiers, and compare trade qualities.</p>
        </div>
        <div className="bg-[#0D1421] border border-[#1A1A2E] px-3.5 py-1.5 rounded-xl text-xs font-bold hidden sm:block">
          <span className="text-[#64748B]">Total Closed: </span>
          <span className="font-extrabold text-white text-sm">{closed.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-[#64748B] font-medium font-mono">Syncing database analysis console...</span>
        </div>
      ) : closed.length === 0 ? (
        <div className="bg-[#0D1421] border border-white/5 rounded-2xl py-24 text-center max-w-xl mx-auto space-y-4 shadow-xl">
          <BarChart3 className="w-12 h-12 mx-auto text-[#1E293B] mb-2" />
          <div className="space-y-1">
            <p className="text-base font-bold text-white">No Closed Trades Available</p>
            <p className="text-xs text-[#64748B] max-w-xs mx-auto">This account has no closed trades on record. Connect an active MT5 account or log trades manually to unlock performance dossiers.</p>
          </div>
          <div className="pt-2">
            <Link href="/trades">
              <button className="px-4 py-2 bg-primary hover:bg-primary/95 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-primary/20">
                Log Manual Trade
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start h-[calc(100vh-170px)] md:h-[calc(100vh-200px)] overflow-hidden">
          
          {/* LEFT SIDEBAR: Trades list panel */}
          <div className={cn(
            "col-span-1 bg-[#0D1421] border border-white/5 rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl transition-all duration-300",
            selectedTrade && "hidden lg:flex"
          )}>
            {/* Sidebar Top Filter Box */}
            <div className="p-4 border-b border-white/5 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white/95 uppercase tracking-wider">Trading Sessions</span>
                <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded font-black text-[#64748B] uppercase border border-white/5">{filtered.length} trades</span>
              </div>
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search symbol..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#09090E] border border-white/5 focus:border-[#F59E0B]/50 rounded-xl py-2 pl-9 pr-4 text-xs font-bold text-white placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>

              {/* Filtering tabs */}
              <div className="flex bg-[#09090E] rounded-xl p-1 gap-1 text-[10px] uppercase font-black border border-white/5">
                {(['all', 'winners', 'losers'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-center transition-all duration-200 active:scale-95',
                      activeTab === tab 
                        ? 'bg-primary text-black shadow-md shadow-primary/10' 
                        : 'text-[#64748B] hover:text-white'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical Scroll List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#64748B] italic">
                  No matching sessions logged.
                </div>
              ) : (
                filtered.map(t => {
                  const isSelected = selectedTrade?.id === t.id
                  const isProfit = (t.net_profit ?? 0) >= 0
                  const isBuy = t.direction === 'buy'

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTrade(t)}
                      className={cn(
                        "p-4 rounded-xl cursor-pointer transition-all duration-300 border relative group",
                        isSelected 
                          ? "bg-[#09090E] border-[#F59E0B]/50 shadow-[0_0_15px_rgba(245,159,11,0.05)]" 
                          : "bg-[#0F0F18]/40 border-white/[0.02] hover:bg-[#0F0F18] hover:border-white/10"
                      )}
                    >
                      {/* Selected edge glow accent */}
                      {isSelected && (
                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r" />
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {t.symbol}
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                          </span>
                          <span className="text-[10px] text-[#64748B] font-semibold mt-1">
                            {t.close_time ? format(new Date(t.close_time), 'MMM dd, HH:mm') : '—'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className={cn(
                            "text-xs font-black font-mono tracking-tight",
                            isProfit ? "text-[#22C55E]" : "text-[#EF4444]"
                          )}>
                            {isProfit ? '+' : ''}{t.net_profit != null ? fmt(t.net_profit) : '—'}
                          </span>
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <span className={cn(
                              "text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded border shrink-0",
                              isBuy
                                ? "bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]"
                                : "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]"
                            )}>
                              {isBuy ? 'Long' : 'Short'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Notion dossier and analytics detail panel */}
          <div className={cn(
            "col-span-1 lg:col-span-2 flex flex-col h-full overflow-y-auto pr-1 bg-[#0D1421]/30 lg:bg-transparent rounded-2xl lg:p-0 p-4 border border-white/5 lg:border-none",
            !selectedTrade && "hidden lg:flex"
          )}>
            {selectedTrade ? (
              <div className="space-y-6">
                
                {/* Mobile Back Button */}
                <button
                  onClick={() => setSelectedTrade(null)}
                  className="lg:hidden flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-white pb-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Trades list
                </button>

                {/* Trade Executive Summary Banner */}
                <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 md:p-6 shadow-2xl relative overflow-hidden">
                  
                  {/* Subtle background glow */}
                  <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xl md:text-2xl font-black text-white tracking-tight">{selectedTrade.symbol}</span>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border",
                          (selectedTrade.net_profit ?? 0) >= 0
                            ? "bg-[#22C55E]/15 border-[#22C55E]/30 text-[#22C55E]"
                            : "bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]"
                        )}>
                          {(selectedTrade.net_profit ?? 0) >= 0 ? '🏆 Winner' : '💀 Loser'}
                        </span>
                        
                        {/* Score Indicator Badge */}
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border",
                          calculateTradeQualityScore(selectedTrade).total >= 80 
                            ? "bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]" 
                            : calculateTradeQualityScore(selectedTrade).total >= 60 
                            ? "bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#3B82F6]"
                            : calculateTradeQualityScore(selectedTrade).total >= 40 
                            ? "bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]"
                            : "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]"
                        )}>
                          Score: {calculateTradeQualityScore(selectedTrade).total}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#64748B] font-semibold">
                        <span className="capitalize">{selectedTrade.direction === 'buy' ? '↗ Buy Order' : '↘ Sell Order'}</span>
                        <span className="text-white/20">•</span>
                        <span>Opened: {selectedTrade.open_time ? format(new Date(selectedTrade.open_time), 'MMM dd, HH:mm') : '—'}</span>
                        <span className="text-white/20">•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {selectedTrade.duration_seconds ? (
                            selectedTrade.duration_seconds < 60 ? `${selectedTrade.duration_seconds}s` :
                            selectedTrade.duration_seconds < 3600 ? `${Math.round(selectedTrade.duration_seconds / 60)}m` :
                            `${(selectedTrade.duration_seconds / 3600).toFixed(1)}h`
                          ) : '—'}
                        </span>
                        {(() => {
                          if (!selectedTrade.open_time) return null
                          const hour = new Date(selectedTrade.open_time).getUTCHours()
                          const session = hour >= 0 && hour < 8 ? { label: 'Asian Session', emoji: '🌅', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' } :
                                          hour >= 8 && hour < 16 ? { label: 'London Session', emoji: '🏰', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' } :
                                          { label: 'New York Session', emoji: '🗽', color: 'bg-amber-500/10 border-amber-500/20 text-primary' }
                          return (
                            <>
                              <span className="text-white/20">•</span>
                              <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider", session.color)}>
                                <span>{session.emoji}</span> <span>{session.label}</span>
                              </span>
                            </>
                          )
                        })()}
                      </div>
                    </div>

                    <div className="md:text-right border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block mb-1">Session Profit & Loss</span>
                      <span className={cn(
                        "text-2xl md:text-3xl font-black font-mono tracking-tight block",
                        (selectedTrade.net_profit ?? 0) >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                      )}>
                        {(selectedTrade.net_profit ?? 0) >= 0 ? '+' : ''}{selectedTrade.net_profit != null ? fmt(selectedTrade.net_profit) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4-Grid Metrics Ribbon */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Entry Price', value: selectedTrade.entry_price ? `$${Number(selectedTrade.entry_price).toFixed(2)}` : '—' },
                    { label: 'Exit Price', value: selectedTrade.exit_price ? `$${Number(selectedTrade.exit_price).toFixed(2)}` : '—' },
                    { label: 'Quantity / Lot', value: selectedTrade.lot_size ?? '—' },
                    { 
                      label: 'Price Move %', 
                      value: (() => {
                        if (!selectedTrade.entry_price || !selectedTrade.exit_price) return '—'
                        const diff = Number(selectedTrade.exit_price) - Number(selectedTrade.entry_price)
                        const pct = (diff / Number(selectedTrade.entry_price)) * 100
                        const adjusted = selectedTrade.direction === 'buy' ? pct : -pct
                        return (adjusted >= 0 ? '+' : '') + adjusted.toFixed(2) + '%'
                      })(),
                      colorClass: (() => {
                        if (!selectedTrade.entry_price || !selectedTrade.exit_price) return 'text-[#94A3B8]'
                        const diff = Number(selectedTrade.exit_price) - Number(selectedTrade.entry_price)
                        const pct = (diff / Number(selectedTrade.entry_price)) * 100
                        const adjusted = selectedTrade.direction === 'buy' ? pct : -pct
                        return adjusted >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                      })()
                    }
                  ].map((metric, idx) => (
                    <div key={idx} className="bg-[#0D1421] border border-white/5 rounded-2xl p-4 space-y-1.5 shadow-md">
                      <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">{metric.label}</span>
                      <span className={cn("text-base font-extrabold text-white font-mono tracking-tight", metric.colorClass)}>
                        {metric.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── HIGH FIDELITY VISUAL SCREENSHOT DOSSIER CANVAS ───────────────── */}
                <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-xs font-black text-white/90 uppercase tracking-widest flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-primary" /> Visual Trade Analysis ({screenshots.length})
                    </h3>
                    {screenshots.length > 0 ? (
                      <span className="text-[8px] px-2.5 py-0.5 bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] rounded-md font-black uppercase tracking-wider">Screenshots Loaded</span>
                    ) : (
                      <span className="text-[8px] px-2.5 py-0.5 bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] rounded-md font-black uppercase tracking-wider">No Visuals</span>
                    )}
                  </div>

                  {screenshots.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {screenshots.map((s, sIdx) => (
                        <div key={s.id} className="relative group rounded-xl overflow-hidden border border-white/5 bg-[#09090e] shadow-lg flex flex-col p-2 space-y-2 animate-in fade-in duration-200">
                          <div className="relative rounded-lg overflow-hidden h-48 bg-black flex items-center justify-center">
                            <img 
                              src={s.url} 
                              alt={s.caption || `Screenshot ${sIdx + 1}`} 
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <a 
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all"
                                title="View Original"
                              >
                                🔍
                              </a>
                              <button
                                type="button"
                                onClick={() => deleteScreenshot(s.id)}
                                className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          <input 
                            type="text"
                            placeholder="Add a caption..."
                            value={s.caption || ''}
                            onChange={(e) => {
                              const newCaps = [...screenshots]
                              newCaps[sIdx].caption = e.target.value
                              setScreenshots(newCaps)
                            }}
                            onBlur={() => {
                              updateScreenshotCaption(s.id, s.caption)
                            }}
                            className="bg-[#0D1421] border border-[#1A1A2E] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-[#F59E0B]/50 transition-colors w-full"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-2 border-dashed border-white/10 hover:border-[#F59E0B]/30 transition-colors rounded-xl p-6 text-center bg-[#09090E]/30 flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                    <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-primary shadow-inner">
                      <Camera className="w-5 h-5 text-primary" />
                    </div>
                    {uploadingScreenshot ? (
                      <div className="flex flex-col items-center space-y-1">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        <span className="text-[10px] text-[#64748B] font-mono">Uploading...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-white/90">Upload screenshot / paste (CTRL + V)</p>
                        <p className="text-[10px] text-[#64748B]">Add chart layouts, setups, or exit confirmations</p>
                        <input 
                          type="file" 
                          id={`screenshot-analysis-input-${selectedTrade?.id || 'new'}`}
                          accept="image/*" 
                          className="hidden" 
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) uploadScreenshot(file)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById(`screenshot-analysis-input-${selectedTrade?.id || 'new'}`)?.click()}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white border border-white/10 transition-all cursor-pointer"
                        >
                          Select File
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── NOTION DOSSIER DETAILED WORKSPACE GRID ──────────────────────── */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  
                  {/* CARD 1: Journal Entries Dossier */}
                  <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl space-y-5 flex flex-col justify-between h-full min-h-[380px]">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <h3 className="text-xs font-black text-white/90 uppercase tracking-widest flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-primary" /> Session Journal Entry
                      </h3>
                      {selectedTrade.setup_tag || selectedTrade.notes ? (
                        <span className="text-[8px] px-2 py-0.5 bg-[#22C55E]/10 text-[#22C55E] rounded border border-[#22C55E]/20 font-black uppercase tracking-wider">Journaled</span>
                      ) : (
                        <span className="text-[8px] px-2 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] rounded border border-[#F59E0B]/20 font-black uppercase tracking-wider">Not Journaled</span>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 flex flex-col justify-center space-y-4 pt-1">
                      {selectedTrade.setup_tag || selectedTrade.notes || selectedTrade.emotion_before || selectedTrade.emotion_after ? (
                        <div className="space-y-4 text-left">
                          {/* Strategy tag */}
                          {selectedTrade.setup_tag && (
                            <div className="space-y-1.5">
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Strategy Setup Pattern</span>
                              <span className="inline-flex px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-xs font-black rounded-lg uppercase tracking-wider">
                                {selectedTrade.setup_tag}
                              </span>
                            </div>
                          )}

                          {/* Emotions Profiling */}
                          {(selectedTrade.emotion_before || selectedTrade.emotion_after) && (
                            <div className="space-y-1.5">
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Mindset Capsules</span>
                              <div className="flex items-center gap-3">
                                {selectedTrade.emotion_before && (
                                  <div className="flex flex-col space-y-0.5">
                                    <span className="text-[8px] text-[#64748B] font-bold uppercase tracking-wider">Before Entry</span>
                                    {getEmotionCapsule(selectedTrade.emotion_before)}
                                  </div>
                                )}
                                {selectedTrade.emotion_after && (
                                  <div className="flex flex-col space-y-0.5">
                                    <span className="text-[8px] text-[#64748B] font-bold uppercase tracking-wider">After Exit</span>
                                    {getEmotionCapsule(selectedTrade.emotion_after)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Notes Quotes */}
                          {selectedTrade.notes && (
                            <div className="space-y-1.5">
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Lessons Logged</span>
                              <div className="border-l-2 border-[#F59E0B] bg-[#09090E]/60 p-3.5 rounded-r-xl text-xs text-slate-300 italic whitespace-pre-wrap font-medium shadow-inner">
                                "{selectedTrade.notes}"
                              </div>
                            </div>
                          )}

                          {/* Mistakes & Compliance Auditing */}
                          {selectedTrade.mistakes && selectedTrade.mistakes.length > 0 ? (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Logged Plan Breaches</span>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedTrade.mistakes.map((m: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[9px] font-black uppercase tracking-wider">
                                    ⚠️ {m}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Discipline Status</span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-[9px] font-black uppercase tracking-wider">
                                ✓ Plan Adhered: No Violations
                              </span>
                            </div>
                          )}

                          {/* Pre-Trade Checklist Compliance */}
                          {selectedTrade.pre_trade_checklist && typeof selectedTrade.pre_trade_checklist === 'object' && Object.keys(selectedTrade.pre_trade_checklist).length > 0 && (
                            <div className="space-y-1.5 pt-2.5 border-t border-white/5 mt-2.5">
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Pre-Trade Checklist Compliance</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                {Object.entries(selectedTrade.pre_trade_checklist).map(([item, checked]) => (
                                  <div 
                                    key={item} 
                                    className={cn(
                                      "flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-bold border select-none transition-colors",
                                      checked
                                        ? "bg-[#22C55E]/5 border-[#22C55E]/15 text-[#22C55E]"
                                        : "bg-white/[0.01] border-white/5 text-[#64748B] line-through"
                                    )}
                                  >
                                    <span>{checked ? '✓' : '✗'}</span>
                                    <span className="truncate">{item}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6 space-y-3">
                          <AlertCircle className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-white">Empty Journal Log</p>
                            <p className="text-[10px] text-[#64748B] max-w-xs mx-auto leading-relaxed">
                              You haven't logged your mental states, trading setups, checklists, or notes for this trade session yet. 
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer buttons redirecting loop */}
                    <div className="pt-4 border-t border-white/5">
                      <Link href={`/journal?tradeId=${selectedTrade.id}`}>
                        <button className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 rounded-xl text-xs font-black text-primary transition-all active:scale-98">
                          <FileText className="w-3.5 h-3.5" /> 
                          {selectedTrade.setup_tag || selectedTrade.notes ? 'Edit Journal Entry' : 'Add Journal Entry'}
                        </button>
                      </Link>
                    </div>
                  </div>

                  {/* CARD 2: Dynamic Trade Quality Score */}
                  {(() => {
                    const { total: score, breakdown } = calculateTradeQualityScore(selectedTrade)
                    
                    // Circular Progress variables
                    const radius = 38
                    const circumference = 2 * Math.PI * radius
                    const strokeDashoffset = circumference - (score / 100) * circumference

                    // Color themed selections
                    let strokeColor = 'stroke-[#EF4444]'
                    let textColor = 'text-[#EF4444]'
                    let label = 'Needs Work'
                    let glowColor = 'shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    
                    if (score >= 80) {
                      strokeColor = 'stroke-[#22C55E]'
                      textColor = 'text-[#22C55E]'
                      label = 'Excellent Plan'
                      glowColor = 'shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                    } else if (score >= 60) {
                      strokeColor = 'stroke-[#3B82F6]'
                      textColor = 'text-[#3B82F6]'
                      label = 'Good Plan'
                      glowColor = 'shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                    } else if (score >= 40) {
                      strokeColor = 'stroke-[#F59E0B]'
                      textColor = 'text-[#F59E0B]'
                      label = 'Average'
                      glowColor = 'shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    }

                    return (
                      <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl space-y-5 flex flex-col justify-between h-full min-h-[380px]">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
                          <h3 className="text-xs font-black text-white/90 uppercase tracking-widest flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-primary" /> Session Discipline Score
                          </h3>
                          <span className={cn("text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider border bg-white/[0.02]", textColor, strokeColor.replace('stroke', 'border'))}>
                            {label}
                          </span>
                        </div>

                        {/* Circular Visualization Panel */}
                        <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-2">
                          <div className="relative flex items-center justify-center">
                            <svg className="w-24 h-24 transform -rotate-90">
                              <circle
                                cx="48"
                                cy="48"
                                r={radius}
                                className="stroke-white/[0.02] fill-transparent"
                                strokeWidth="6.5"
                              />
                              <circle
                                cx="48"
                                cy="48"
                                r={radius}
                                className={cn("fill-transparent transition-all duration-700", strokeColor)}
                                strokeWidth="6.5"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-0.5">
                              <span className={cn("text-2xl font-black font-mono tracking-tighter block", textColor)}>{score}</span>
                              <span className="text-[8px] uppercase tracking-widest text-[#64748B] font-extrabold block">Points</span>
                            </div>
                          </div>
                        </div>

                        {/* Component Progress Bars Breakdown */}
                        <div className="space-y-3 shrink-0">
                          {[
                            { label: 'Profitability', current: breakdown.profitability, max: 30 },
                            { label: 'Execution', current: breakdown.execution, max: 40 },
                            { label: 'Journal Quality', current: breakdown.journal, max: 20 },
                            { label: 'Rating Contribution', current: breakdown.rating, max: 10 }
                          ].map((item, idx) => {
                            const pct = (item.current / item.max) * 100
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span className="text-[#64748B]">{item.label}</span>
                                  <span className="text-white font-mono">{item.current} / {item.max} pts</span>
                                </div>
                                <div className="h-1.5 w-full bg-[#09090E] rounded-full overflow-hidden border border-white/[0.02]">
                                  <div 
                                    className="h-full bg-primary rounded-full transition-all duration-700" 
                                    style={{ width: `${pct}%` }} 
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* AI Insights & Performance comparison (vs average) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* AI Insights */}
                  <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <h3 className="text-xs font-black text-white/90 uppercase tracking-widest flex items-center gap-1.5">
                          <Percent className="w-4 h-4 text-primary" /> AI Pattern Analysis
                        </h3>
                        <span className="text-[8px] px-2 py-0.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded border border-[#3B82F6]/20 font-black uppercase tracking-wider">Coming Soon</span>
                      </div>
                      <p className="text-xs text-[#64748B] leading-relaxed">
                        Personalized AI analysis evaluates strategy patterns, identifies behavioral biases, and alerts you about structural emotional weaknesses based on your historical journals.
                      </p>
                    </div>
                    <div className="pt-4 mt-4 border-t border-white/5">
                      <Link href="/ai-report">
                        <button className="w-full flex items-center justify-center gap-1 px-4 py-2 bg-[#09090E] border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold text-[#64748B] hover:text-white transition-all">
                          Open AI Hub <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                    </div>
                  </div>

                  {/* VS Average comparison */}
                  <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <h3 className="text-xs font-black text-white/90 uppercase tracking-widest flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-primary" /> Session Comparative Metrics
                      </h3>
                      <span className="text-[8px] px-2 py-0.5 bg-white/5 text-[#64748B] rounded border border-white/5 font-black uppercase tracking-wider font-mono">VS Benchmark</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      
                      {/* Metric win */}
                      <div className="bg-[#09090E]/60 border border-white/5 rounded-xl p-3.5 text-center space-y-1">
                        <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Vs Average Winner</span>
                        <span className={cn(
                          "text-sm font-extrabold font-mono",
                          (selectedTrade.net_profit ?? 0) >= avgWinnerPnl ? "text-[#22C55E]" : "text-[#EF4444]"
                        )}>
                          {selectedTrade.net_profit != null && avgWinnerPnl > 0
                            ? `${(((selectedTrade.net_profit) / avgWinnerPnl) * 100).toFixed(0)}%`
                            : '—'}
                        </span>
                        <span className="text-[8px] text-[#64748B] block">avg: ${avgWinnerPnl.toFixed(0)}</span>
                      </div>

                      {/* Metric hold */}
                      <div className="bg-[#09090E]/60 border border-white/5 rounded-xl p-3.5 text-center space-y-1">
                        <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Hold Duration Ratio</span>
                        <span className="text-sm font-extrabold font-mono text-white">
                          {selectedTrade.duration_seconds && avgDurationSeconds > 0
                            ? `${(selectedTrade.duration_seconds / avgDurationSeconds).toFixed(1)}x`
                            : '—'}
                        </span>
                        <span className="text-[8px] text-[#64748B] block">
                          avg: {avgDurationSeconds ? (
                            avgDurationSeconds < 60 ? `${avgDurationSeconds.toFixed(0)}s` :
                            avgDurationSeconds < 3600 ? `${Math.round(avgDurationSeconds / 60)}m` :
                            `${(avgDurationSeconds / 3600).toFixed(1)}h`
                          ) : '—'}
                        </span>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 h-full">
                <BookOpen className="w-12 h-12 text-[#1E293B]" />
                <h4 className="text-sm font-extrabold text-white">No Session Highlighted</h4>
                <p className="text-xs text-[#64748B] max-w-xs mx-auto">Click any closed trade in the left column list to review structured Notion logs, performance stars, and checklists.</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

export default function TradeAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TradeAnalysisContent />
    </Suspense>
  )
}
