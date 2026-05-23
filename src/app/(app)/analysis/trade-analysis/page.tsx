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
  ChevronRight
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

// ── REPLAY SIMULATOR DRAWER COMPONENT ─────────────────────────────────────────
function ReplayDrawer({ trade, onClose }: { trade: any; onClose: () => void }) {
  const [candles, setCandles] = useState<MockCandle[]>([])
  const [currentStep, setCurrentStep] = useState(15) // Start showing before-trade candles
  const [isPlaying, setIsPlaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState(1000) // ms per tick
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Generate realistic candlestick simulation feed
  useEffect(() => {
    if (!trade) return

    const entry = Number(trade.entry_price)
    const exit = Number(trade.exit_price || trade.entry_price * (trade.direction === 'buy' ? 1.01 : 0.99))
    const isBuy = trade.direction === 'buy'
    
    // Duration boundaries
    const openTime = new Date(trade.open_time || Date.now()).getTime()
    const closeTime = new Date(trade.close_time || openTime + 60 * 60000).getTime()
    const totalDuration = closeTime - openTime
    
    const numTradeCandles = 25
    const numBeforeCandles = 15
    const numAfterCandles = 15
    const timeStep = Math.max(60000, Math.floor(totalDuration / numTradeCandles))
    
    const candlesList: MockCandle[] = []
    let currentPrice = entry * (isBuy ? 0.992 : 1.008)

    // A. Pricing sequence PRIOR to trade entry
    for (let i = numBeforeCandles; i > 0; i--) {
      const timeMs = openTime - i * timeStep
      const close = currentPrice + (Math.random() - 0.5) * (entry * 0.0015)
      const open = currentPrice
      const high = Math.max(open, close) + Math.random() * (entry * 0.0006)
      const low = Math.min(open, close) - Math.random() * (entry * 0.0006)
      candlesList.push({
        time: Math.floor(timeMs / 1000),
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 500)
      })
      currentPrice = close
    }

    // Force alignment on trade entry price
    currentPrice = entry

    // B. Pricing sequence DURING trade execution
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
        open,
        high,
        low,
        close: i === numTradeCandles ? exit : close,
        volume: Math.floor(Math.random() * 1000)
      })
    }

    currentPrice = exit

    // C. Pricing sequence AFTER trade exit
    for (let i = 1; i <= numAfterCandles; i++) {
      const timeMs = closeTime + i * timeStep
      const close = currentPrice + (Math.random() - 0.5) * (entry * 0.0015)
      const open = currentPrice
      const high = Math.max(open, close) + Math.random() * (entry * 0.0006)
      const low = Math.min(open, close) - Math.random() * (entry * 0.0006)
      candlesList.push({
        time: Math.floor(timeMs / 1000),
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 400)
      })
      currentPrice = close
    }

    setCandles(candlesList)
    setCurrentStep(15) // Reset simulation position
    setIsPlaying(false)
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

    // Highlight entry & exit coordinates
    const markers: any[] = []
    const entryIndex = 15
    const exitIndex = 40

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
  }, [candles, currentStep, trade])

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
                <Play className="w-4 h-4 text-primary fill-primary" /> Trade Replay Simulator
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">Centralized premium multi-session execution playback.</p>
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

        {/* Quick Telemetry Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#09090e]/60 border border-white/5 rounded-xl p-4">
            <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Trade Returns</p>
            <p className={cn("text-lg font-black mt-0.5 tabular-nums", isProfit ? "text-[#22C55E]" : "text-[#EF4444]")}>
              {trade.net_profit !== null ? fmt(trade.net_profit) : '—'}
            </p>
          </div>
          <div className="bg-[#09090e]/60 border border-white/5 rounded-xl p-4">
            <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Volume (Lots)</p>
            <p className="text-lg font-black text-white font-mono mt-0.5">{trade.lot_size ? trade.lot_size.toFixed(2) : '—'}</p>
          </div>
          <div className="bg-[#09090e]/60 border border-white/5 rounded-xl p-4">
            <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Pips Realized</p>
            <p className={cn("text-lg font-black font-mono mt-0.5", (trade.pips ?? 0) >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
              {trade.pips !== null ? `${trade.pips >= 0 ? '+' : ''}${trade.pips.toFixed(1)}` : 'N/A'}
            </p>
          </div>
          <div className="bg-[#09090e]/60 border border-white/5 rounded-xl p-4">
            <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Risk-to-Reward</p>
            <p className="text-lg font-black text-primary font-mono mt-0.5">
              {trade.rr_ratio ? `1:${trade.rr_ratio.toFixed(2)}` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="bg-[#09090e] border border-white/5 rounded-xl overflow-hidden relative" style={{ height: '320px' }}>
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-[9px] font-black bg-white/5 text-primary border border-white/10 px-2 py-0.5 rounded uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" /> Simulator Canvas
          </div>
          <div className="w-full h-full" ref={chartContainerRef} />
        </div>

        {/* Controller Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#09090e] rounded-xl border border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false)
                setCurrentStep(15)
              }}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-[#64748B] hover:text-white flex items-center justify-center border border-white/5 transition-all active:scale-95"
              title="Reset Simulator"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="text-xs text-[#64748B] font-mono ml-2">
              Playback Progress: {Math.min(100, Math.floor(((currentStep - 15) / 25) * 100))}%
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
              <option value={250}>4.0x Turbo</option>
            </select>
          </div>
        </div>

        {/* Notes & Journal Details Splits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Notes and Setups */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Setup Strategy & Checklist</h4>
              <p className="text-[10px] text-[#64748B] mt-0.5">Identified setups and criteria compliance.</p>
            </div>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center bg-[#09090e]/40 p-2.5 border border-white/5 rounded-lg">
                <span className="text-[#64748B]">Setup tag Strategy</span>
                <span className="font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-[10px]">
                  {trade.setup_tag || 'Manual Setup'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-[#09090e]/40 p-2.5 border border-white/5 rounded-lg">
                <span className="text-[#64748B]">Discipline Star Rating</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star 
                      key={star} 
                      className={cn(
                        "w-3.5 h-3.5", 
                        (trade.rating || 0) >= star ? "text-amber-400 fill-amber-400" : "text-[#334155]"
                      )} 
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#09090e]/30 border border-white/5 rounded-xl p-4">
              <h5 className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Discipline Notes</h5>
              <p className="text-xs text-white/90 leading-relaxed mt-2 whitespace-pre-line bg-[#09090e]/50 p-3 rounded-lg border border-white/5">
                {trade.notes || 'No notes compiled for this journal sequence.'}
              </p>
            </div>
          </div>

          {/* Psychology & Screenshots */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Psychology & Screenshots</h4>
              <p className="text-[10px] text-[#64748B] mt-0.5">Emotional logs and TradingView chart image link.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-center">
              <div className="bg-[#09090e]/40 p-3 border border-white/5 rounded-xl">
                <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Before Entry</span>
                <span className="font-bold text-white block mt-1.5 capitalize bg-white/5 py-1 rounded">
                  {trade.emotion_before || '😐 Neutral'}
                </span>
              </div>
              <div className="bg-[#09090e]/40 p-3 border border-white/5 rounded-xl">
                <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">After Exit</span>
                <span className="font-bold text-white block mt-1.5 capitalize bg-white/5 py-1 rounded">
                  {trade.emotion_after || '😐 Neutral'}
                </span>
              </div>
            </div>

            {trade.screenshot_url && (
              <div className="rounded-xl overflow-hidden border border-white/5 bg-[#09090e] shadow-inner group relative max-h-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={trade.screenshot_url} alt="Attached TradingView screen" className="w-full h-auto object-contain max-h-48" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <a 
                    href={trade.screenshot_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-3.5 py-1.5 bg-primary text-black rounded-lg text-xs font-bold transition-transform hover:scale-105"
                  >
                    View Full Image
                  </a>
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
                <th className="text-left px-6 py-3 font-semibold">#</th>
                <th className="text-left px-6 py-3 font-semibold">Date</th>
                <th className="text-left px-6 py-3 font-semibold">Symbol</th>
                <th className="text-left px-6 py-3 font-semibold">Direction</th>
                <th className="text-left px-6 py-3 font-semibold">Entry</th>
                <th className="text-left px-6 py-3 font-semibold">Exit</th>
                <th className="text-left px-6 py-3 font-semibold">Size</th>
                <th className="text-left px-6 py-3 font-semibold">Duration</th>
                <th className="text-left px-6 py-3 font-semibold">R:R</th>
                <th className="text-right px-6 py-3 font-semibold">P&L</th>
                <th className="text-left px-6 py-3 font-semibold">Setup</th>
                <th className="text-right px-6 py-3 font-semibold">Actions</th>
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
                        <Play className="w-3 h-3 fill-primary" /> Trade Replay
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
