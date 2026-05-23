'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
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
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  X, 
  Star, 
  Calendar, 
  Loader2,
  BookOpen
} from 'lucide-react'
import { createChart, ColorType } from 'lightweight-charts'
import { useSearchParams } from 'next/navigation'

interface MockCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
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
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border capitalize", colorClass)}>
      <span>{emoji}</span>
      <span>{clean}</span>
    </span>
  )
}

// ── REPLAY DRAWER WITH BINANCE REAL CHARTS & NOTION DOSSIER ───────────────────
function ReplayDrawer({ trade, onClose }: { trade: any; onClose: () => void }) {
  const [candles, setCandles] = useState<MockCandle[]>([])
  const [currentStep, setCurrentStep] = useState(15) 
  const [isPlaying, setIsPlaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState(1000) 
  const [loadingChart, setLoadingChart] = useState(true)
  const [errorChart, setErrorChart] = useState<string | null>(null)
  
  const [entryIndex, setEntryIndex] = useState(15)
  const [exitIndex, setExitIndex] = useState(40)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // A. Realistic Mock Candle Generator (Fallback)
  const generateMockCandles = (t: any): MockCandle[] => {
    const entry = Number(t.entry_price)
    const exit = Number(t.exit_price || t.entry_price * (t.direction === 'buy' ? 1.01 : 0.99))
    const isBuy = t.direction === 'buy'
    const openTime = new Date(t.open_time || Date.now()).getTime()
    const closeTime = new Date(t.close_time || openTime + 30 * 60000).getTime()
    const totalDuration = closeTime - openTime
    
    const numTradeCandles = 25
    const numBeforeCandles = 15
    const numAfterCandles = 15
    const timeStep = Math.max(60000, Math.floor(totalDuration / numTradeCandles))
    const candlesList: MockCandle[] = []
    let currentPrice = entry * (isBuy ? 0.992 : 1.008)

    for (let i = numBeforeCandles; i > 0; i--) {
      const timeMs = openTime - i * timeStep
      const close = currentPrice + (Math.random() - 0.5) * (entry * 0.0015)
      const open = currentPrice
      const high = Math.max(open, close) + Math.random() * (entry * 0.0006)
      const low = Math.min(open, close) - Math.random() * (entry * 0.0006)
      candlesList.push({
        time: Math.floor(timeMs / 1000),
        open, high, low, close,
        volume: Math.floor(Math.random() * 500)
      })
      currentPrice = close
    }

    currentPrice = entry

    for (let i = 0; i <= numTradeCandles; i++) {
      const timeMs = openTime + i * timeStep
      const progress = i / numTradeCandles
      const target = entry + (exit - entry) * progress
      const close = target + (Math.random() - 0.5) * (entry * 0.002) * (1 - progress)
      const open = i === 0 ? entry : candlesList[candlesList.length - 1].close
      const high = Math.max(open, close) + Math.random() * (entry * 0.0009)
      const low = Math.min(open, close) - Math.random() * (entry * 0.0009)
      candlesList.push({
        time: Math.floor(timeMs / 1000),
        open, high, low,
        close: i === numTradeCandles ? exit : close,
        volume: Math.floor(Math.random() * 1000)
      })
    }

    currentPrice = exit

    for (let i = 1; i <= numAfterCandles; i++) {
      const timeMs = closeTime + i * timeStep
      const close = currentPrice + (Math.random() - 0.5) * (entry * 0.0015)
      const open = currentPrice
      const high = Math.max(open, close) + Math.random() * (entry * 0.0006)
      const low = Math.min(open, close) - Math.random() * (entry * 0.0006)
      candlesList.push({
        time: Math.floor(timeMs / 1000),
        open, high, low, close,
        volume: Math.floor(Math.random() * 400)
      })
      currentPrice = close
    }

    return candlesList
  }

  // 1. Fetch free real gold and forex chart data from Binance API
  useEffect(() => {
    async function loadRealData() {
      setLoadingChart(true)
      setErrorChart(null)

      try {
        const openTime = new Date(trade.open_time || Date.now()).getTime()
        const closeTime = new Date(trade.close_time || openTime + 30 * 60000).getTime()
        const durationMs = closeTime - openTime
        const durationMin = Math.floor(durationMs / 60000)

        // Dynamically compute interval step sizing depending on duration to maximize context
        let interval = '1m'
        let intervalMs = 60000
        if (durationMin <= 120) {
          interval = '1m'
          intervalMs = 60000
        } else if (durationMin <= 600) {
          interval = '5m'
          intervalMs = 300000
        } else if (durationMin <= 2400) {
          interval = '15m'
          intervalMs = 900000
        } else if (durationMin <= 9600) {
          interval = '1h'
          intervalMs = 3600000
        } else {
          interval = '1d'
          intervalMs = 86400000
        }

        // Map logged instrument to public Binance pairs
        let binanceSymbol = 'PAXGUSDT' // Default to gold (tracks XAUUSD spot 1:1)
        const cleanSymbol = String(trade.symbol).toUpperCase().replace(/[^A-Z]/g, '')
        if (cleanSymbol.includes('EUR')) binanceSymbol = 'EURUSDT'
        else if (cleanSymbol.includes('GBP')) binanceSymbol = 'GBPUSDT'
        else if (cleanSymbol.includes('BTC')) binanceSymbol = 'BTCUSDT'
        else if (cleanSymbol.includes('ETH')) binanceSymbol = 'ETHUSDT'

        // Shift startTime backward by 20 intervals to capture "before entry" price context
        const startTime = openTime - 20 * intervalMs
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${startTime}&limit=80`

        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`Binance API returned status: ${res.status}`)
        }

        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('No candlestick data returned from Binance')
        }

        const formatted = data.map((c: any) => ({
          time: Math.floor(c[0] / 1000),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseFloat(c[5])
        }))

        // Mathematical timestamp alignment for Entry & Exit markers
        let closestEntryIdx = 15
        let closestExitIdx = 40
        let minEntryDiff = Infinity
        let minExitDiff = Infinity

        const openSec = Math.floor(openTime / 1000)
        const closeSec = Math.floor(closeTime / 1000)

        formatted.forEach((c: any, idx: number) => {
          const entryDiff = Math.abs(c.time - openSec)
          if (entryDiff < minEntryDiff) {
            minEntryDiff = entryDiff
            closestEntryIdx = idx
          }
          const exitDiff = Math.abs(c.time - closeSec)
          if (exitDiff < minExitDiff) {
            minExitDiff = exitDiff
            closestExitIdx = idx
          }
        })

        setCandles(formatted)
        setEntryIndex(closestEntryIdx)
        setExitIndex(closestExitIdx)
        setCurrentStep(closestEntryIdx) // Initialize simulator playback exactly at the Entry Candle
      } catch (err: any) {
        console.warn('Direct live feed failed; falling back to realistic engine:', err)
        setErrorChart(err.message || 'API connection failed')
        const fallback = generateMockCandles(trade)
        setCandles(fallback)
        setEntryIndex(15)
        setExitIndex(40)
        setCurrentStep(15)
      } finally {
        setLoadingChart(false)
      }
    }

    loadRealData()
  }, [trade])

  // 2. Play/Pause ticks loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= candles.length) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, replaySpeed)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, candles, replaySpeed])

  // 3. Lightweight Charts rendering integration
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0 || !trade) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090e' },
        textColor: '#64748B',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
      },
    })

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderUpColor: '#22C55E',
      borderDownColor: '#EF4444',
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    })

    const visibleData = candles.slice(0, currentStep)
    candlestickSeries.setData(visibleData as any)

    // Highlight entry & exit coordinates on real chart
    const markers: any[] = []
    if (currentStep > entryIndex && candles[entryIndex]) {
      markers.push({
        time: candles[entryIndex].time,
        position: 'belowBar',
        color: '#F59E0B',
        shape: 'arrowUp',
        text: `BUY ENTRY @ $${Number(trade.entry_price).toFixed(2)}`,
      })
    }

    if (currentStep > exitIndex && candles[exitIndex] && trade.exit_price) {
      markers.push({
        time: candles[exitIndex].time,
        position: 'aboveBar',
        color: '#EF4444',
        shape: 'arrowDown',
        text: `EXIT @ $${Number(trade.exit_price).toFixed(2)}`,
      })
    }

    candlestickSeries.setMarkers(markers as any)
    chart.timeScale().fitContent()

    return () => {
      chart.remove()
    }
  }, [candles, currentStep, entryIndex, exitIndex, trade])

  const isBuy = trade.direction === 'buy'
  const isProfit = (trade.net_profit ?? 0) >= 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-full bg-[#12121a] border-l border-white/10 p-6 md:p-8 flex flex-col space-y-6 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl text-[#64748B] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Trade dossier Review
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">High-fidelity live chart replays & Notion-style structured logs.</p>
            </div>
          </div>
          <span className={cn(
            "text-[9px] px-2.5 py-1 rounded font-black tracking-widest uppercase border",
            isBuy 
              ? "bg-[#22C55E]/15 border-[#22C55E]/30 text-[#22C55E]" 
              : "bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]"
          )}>
            {trade.symbol} • {trade.direction === 'buy' ? 'Long' : 'Short'}
          </span>
        </div>

        {/* Dynamic Volatility Replay Chart Container */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider">Live Volatility Chart Replay</h3>
            <span className="text-[9px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
              Source: {loadingChart ? 'Connecting...' : errorChart ? 'Fallback Simulation' : 'Binance Spot Live'}
            </span>
          </div>

          <div className="bg-[#09090e] border border-white/5 rounded-2xl overflow-hidden relative" style={{ height: '320px' }}>
            {loadingChart && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 space-y-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-xs text-slate-400 font-medium">Syncing live klines...</span>
              </div>
            )}
            <div className="w-full h-full" ref={chartContainerRef} />
          </div>

          {/* Controller Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#09090e] rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white animate-[pulse_2s_infinite]" />}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false)
                  setCurrentStep(entryIndex)
                }}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-[#64748B] hover:text-white flex items-center justify-center border border-white/5 transition-all active:scale-95"
                title="Reset to Entry"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="text-xs text-[#64748B] font-mono ml-2">
                Playback: {Math.max(0, Math.min(100, Math.floor(((currentStep - entryIndex) / (exitIndex - entryIndex || 1)) * 100)))}%
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Sliders className="w-4 h-4 text-[#64748B]" />
              <label className="text-[10px] uppercase tracking-wider font-black text-[#64748B]">Sim Speed</label>
              <select
                value={replaySpeed}
                onChange={e => setReplaySpeed(Number(e.target.value))}
                className="bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary/50 [color-scheme:dark]"
              >
                <option value={1500}>0.5x Slow</option>
                <option value={1000}>1.0x Normal</option>
                <option value={500}>2.0x Fast</option>
                <option value={200}>5.0x Turbo</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── NOTION-STYLE TRADE JOURNAL DOSSIER ───────────────────────────────── */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Structured Trade Journal Dossier</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* COLUMN 1: Compliance, Rating, and Setup */}
            <div className="space-y-5">
              
              {/* Executive Rating Card */}
              <div className="bg-[#09090e]/40 p-4 border border-white/5 rounded-2xl space-y-2.5">
                <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Execute Discipline Score</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star} 
                      className={cn(
                        "w-5 h-5 transition-transform duration-300", 
                        (trade.rating || 0) >= star 
                          ? "text-amber-400 fill-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.4)] scale-110" 
                          : "text-[#1E293B]"
                      )} 
                    />
                  ))}
                  <span className="text-xs font-black text-white ml-2">({trade.rating || 0} / 5 Stars)</span>
                </div>
              </div>

              {/* Strategy Setup Card */}
              <div className="bg-[#09090e]/40 p-4 border border-white/5 rounded-2xl space-y-2.5">
                <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Setup Tag / Strategy Pattern</span>
                <span className="inline-flex px-3.5 py-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-black rounded-xl uppercase tracking-widest">
                  {trade.setup_tag || 'Manual Strategy Setup'}
                </span>
              </div>

              {/* Pre-Trade Checklist Compliance Card */}
              <div className="bg-[#09090e]/40 p-4 border border-white/5 rounded-2xl space-y-3">
                <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Pre-Flight Checklist Compliance</span>
                <div className="space-y-2">
                  {!trade.pre_trade_checklist || Object.keys(trade.pre_trade_checklist).length === 0 ? (
                    <p className="text-xs text-[#64748B] italic">No checklist items registered for this trade session.</p>
                  ) : (
                    Object.entries(trade.pre_trade_checklist).map(([rule, checked]) => (
                      <div 
                        key={rule} 
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-xs transition-colors",
                          checked 
                            ? "bg-[#22C55E]/5 border-[#22C55E]/10 text-white font-medium" 
                            : "bg-white/2 border-white/5 text-[#64748B]"
                        )}
                      >
                        <span className="truncate">{rule}</span>
                        <span className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black border",
                          checked 
                            ? "bg-[#22C55E]/20 border-[#22C55E]/40 text-[#22C55E]" 
                            : "bg-white/5 border-white/5 text-slate-500"
                        )}>
                          {checked ? '✓' : '✗'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN 2: Emotional profiling and Notes lessons */}
            <div className="space-y-5">
              
              {/* Psychological Comparative Profiling Capsule */}
              <div className="bg-[#09090e]/40 p-4 border border-white/5 rounded-2xl space-y-3">
                <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Psychological Profiling</span>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-[#12121a]/60 p-3.5 rounded-xl border border-white/5">
                    <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-bold block mb-2">Before Entry</span>
                    {trade.emotion_before ? getEmotionCapsule(trade.emotion_before) : <span className="text-xs text-[#64748B] font-medium">😐 None</span>}
                  </div>
                  <div className="bg-[#12121a]/60 p-3.5 rounded-xl border border-white/5">
                    <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-bold block mb-2">After Exit</span>
                    {trade.emotion_after ? getEmotionCapsule(trade.emotion_after) : <span className="text-xs text-[#64748B] font-medium">😐 None</span>}
                  </div>
                </div>
              </div>

              {/* Lessons quote block */}
              <div className="bg-[#09090e]/40 p-4 border border-white/5 rounded-2xl space-y-3">
                <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Lessons & Insights</span>
                <div className="border-l-3 border-[#F59E0B] bg-[#09090e]/80 p-4 rounded-r-2xl text-xs leading-relaxed text-slate-200 italic whitespace-pre-wrap font-sans shadow-inner">
                  {trade.notes || '"No lessons logged. Be sure to document your mental state and rules adherence next session."'}
                </div>
              </div>
            </div>

            {/* FULL WIDTH: TradingView screenshot attachment */}
            {trade.screenshot_url && (
              <div className="bg-[#09090e]/40 p-4 border border-white/5 rounded-2xl space-y-3 col-span-1 md:col-span-2">
                <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Attached Chart Screenshot</span>
                <div className="rounded-xl overflow-hidden border border-white/10 bg-[#09090e] shadow-lg relative group">
                  <img src={trade.screenshot_url} alt="Attached TradingView screen" className="w-full h-auto object-contain max-h-96 mx-auto" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                    <a 
                      href={trade.screenshot_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="px-4 py-2 bg-primary hover:bg-primary/95 text-black rounded-lg text-xs font-black uppercase tracking-wider transition-transform hover:scale-105"
                    >
                      Open Original Image
                    </a>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}

// ── MAIN TRADE ANALYSIS PAGE COMPONENT ────────────────────────────────────────
function TradeAnalysisContent() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const closed = getClosedTrades(trades)
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null)
  
  const searchParams = useSearchParams()
  const replayId = searchParams.get('replay')

  // Auto-trigger replay modal drawer if URL contains trade ID query parameter
  useEffect(() => {
    if (replayId && closed.length > 0) {
      const match = closed.find(t => t.id === replayId)
      if (match) {
        setSelectedTrade(match)
      }
    }
  }, [replayId, closed])

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trade Analysis</h1>
        <p className="text-sm text-[#64748B] mt-1">Deep dive into each trade's performance and run visual execution replays.</p>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : closed.length === 0 ? (
        <div className="bg-[#12121a] border border-white/5 rounded-xl py-20 text-center">
          <Hash className="w-10 h-10 mx-auto text-[#334155] mb-3" />
          <p className="text-[#64748B]">No closed trades to analyze yet</p>
        </div>
      ) : (
        <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#334155] border-b border-white/5 bg-white/2">
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">#</th>
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">Date</th>
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">Symbol</th>
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">Direction</th>
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">Entry</th>
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">Exit</th>
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">Size</th>
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">Duration</th>
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">R:R</th>
                <th className="text-right px-6 py-3 font-semibold text-[#64748B]">P&L</th>
                <th className="text-left px-6 py-3 font-semibold text-[#64748B]">Setup</th>
                <th className="text-right px-6 py-3 font-semibold text-[#64748B]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {closed.map((t, i) => {
                const durationMin = t.duration_seconds ? Math.round(t.duration_seconds / 60) : null
                const durationStr = durationMin
                  ? durationMin < 60 ? `${durationMin}m`
                    : durationMin < 1440 ? `${Math.round(durationMin / 60)}h`
                    : `${Math.round(durationMin / 1440)}d`
                  : '—'

                return (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-3.5 text-[#334155] font-mono text-xs">{i + 1}</td>
                    <td className="px-6 py-3.5 text-xs text-[#64748B]">
                      {t.close_time ? format(new Date(t.close_time), 'MMM dd, HH:mm') : '—'}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-white">{t.symbol}</td>
                    <td className="px-6 py-3.5">
                      <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold',
                        t.direction === 'buy' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]')}>
                        {t.direction === 'buy' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t.direction === 'buy' ? 'Long' : 'Short'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[#94A3B8] text-xs">${t.entry_price?.toFixed(2) ?? '—'}</td>
                    <td className="px-6 py-3.5 font-mono text-[#94A3B8] text-xs">${t.exit_price?.toFixed(2) ?? '—'}</td>
                    <td className="px-6 py-3.5 text-[#94A3B8] text-xs">{t.lot_size ?? '—'}</td>
                    <td className="px-6 py-3.5 text-xs text-[#64748B]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#64748B]" /> {durationStr}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs">
                      {t.rr_ratio != null ? (
                        <span className={cn('font-bold', t.rr_ratio >= 1.5 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                          1:{t.rr_ratio.toFixed(2)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono">
                      <span className={cn('font-bold tabular-nums', (t.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                        {t.net_profit !== null ? fmt(t.net_profit) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {t.setup_tag ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold uppercase tracking-wider">{t.setup_tag}</span>
                      ) : <span className="text-[#334155]">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedTrade(t)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 rounded-lg text-xs font-bold text-primary transition-all active:scale-95 shadow-[0_0_10px_rgba(245,159,11,0.05)]"
                      >
                        <Play className="w-3.5 h-3.5 fill-primary" /> Trade Replay
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedTrade && (
        <ReplayDrawer 
          trade={selectedTrade} 
          onClose={() => setSelectedTrade(null)} 
        />
      )}
    </div>
  )
}

export default function TradeAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TradeAnalysisContent />
    </Suspense>
  )
}
