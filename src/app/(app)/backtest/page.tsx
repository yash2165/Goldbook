'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Play, Pause, Plus, Trash2, Scissors, Sparkles, TrendingUp,
  TrendingDown, Target, Clock, ShieldAlert, Award, RefreshCw,
  X, Check, Edit2, Layers, HelpCircle, ChevronRight, Activity, FileSpreadsheet,
  Calculator
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { generateHistoricalCandles } from '@/lib/backtest-seeder'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'
import confetti from 'canvas-confetti'

// Dynamic import or client-only check for lightweight-charts
let createChart: any = null
if (typeof window !== 'undefined') {
  createChart = require('lightweight-charts').createChart
}

interface BacktestTrade {
  id: string
  symbol: string
  direction: 'buy' | 'sell'
  entryPrice: number
  exitPrice: number
  sl: number | null
  tp: number | null
  lots: number
  pnl: number
  pctReturn: number
  outcome: 'win' | 'loss'
  date: string
  notes?: string
}

export default function BacktestReplayPage() {
  const supabase = createClient()
  
  const [isMounted, setIsMounted] = useState(false)
  const [symbol, setSymbol] = useState<'XAUUSD' | 'BANKNIFTY'>('XAUUSD')
  const [layoutMode, setLayoutMode] = useState<'single' | 'split'>('split')
  
  // Data State
  const [allM5Candles, setAllM5Candles] = useState<any[]>([])
  const [visibleCount, setVisibleCount] = useState<number>(300) // Initial visible candles
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(500) // ms between ticks
  const [isScissorsActive, setIsScissorsActive] = useState(false)
  
  // Virtual Broker State
  const [accountBalance, setAccountBalance] = useState<number>(10000)
  const [lots, setLots] = useState<number>(1.0)
  const [slPips, setSlPips] = useState<number>(50)
  const [tpPips, setTpPips] = useState<number>(150)
  
  const [activePosition, setActivePosition] = useState<{
    direction: 'buy' | 'sell'
    entryPrice: number
    slPrice: number | null
    tpPrice: number | null
    lots: number
    entryIndex: number
  } | null>(null)
  
  const [tradesHistory, setTradesHistory] = useState<BacktestTrade[]>([])
  const [activeTab, setActiveTab] = useState<'journal' | 'performance'>('journal')
  const [savingTrade, setSavingTrade] = useState(false)
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null)
  const [editingTradeNotes, setEditingTradeNotes] = useState('')

  // Charts DOM references
  const ltfChartRef = useRef<HTMLDivElement>(null)
  const htfChartRef = useRef<HTMLDivElement>(null)
  const ltfChartInstance = useRef<any>(null)
  const htfChartInstance = useRef<any>(null)
  const ltfCandleSeries = useRef<any>(null)
  const htfCandleSeries = useRef<any>(null)
  const ltfEntryLine = useRef<any>(null)
  const ltfSlLine = useRef<any>(null)
  const ltfTpLine = useRef<any>(null)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Force Client-only Mounting to prevent Next.js SSR hydration crashes
  useEffect(() => {
    setIsMounted(true)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // 1. Generate & Load deterministic candlestick data sets
  useEffect(() => {
    const data = generateHistoricalCandles(symbol, 3000)
    setAllM5Candles(data)
    setVisibleCount(300) // Reset to start of dataset window
    setActivePosition(null)
    setTradesHistory([])
    setAccountBalance(10000)
    setIsPlaying(false)
  }, [symbol])

  // 2. Synthesize Higher Timeframe (H1) candles from Visible M5 candles in real-time
  const { htfCandles, ltfCandles } = useMemo(() => {
    if (allM5Candles.length === 0) return { htfCandles: [], ltfCandles: [] }
    
    // Slice only the replayed visible candles up to visibleCount
    const visibleM5 = allM5Candles.slice(0, visibleCount)
    
    // Synthesize H1 candles (Groups of 12 candles * 5 minutes = 60 mins)
    const h1Candles: any[] = []
    const candlesPerBar = 12
    
    for (let i = 0; i < visibleM5.length; i += candlesPerBar) {
      const chunk = visibleM5.slice(i, i + candlesPerBar)
      if (chunk.length === 0) continue
      
      const openCandle = chunk[0]
      const closeCandle = chunk[chunk.length - 1]
      
      const open = openCandle.open
      const close = closeCandle.close
      const high = Math.max(...chunk.map(c => c.high))
      const low = Math.min(...chunk.map(c => c.low))
      const volume = chunk.reduce((sum, c) => sum + c.volume, 0)
      
      // Use the open candle's timestamp rounded to the hour boundary for consistency
      const hourTimestamp = Math.floor(openCandle.time / 3600) * 3600
      
      h1Candles.push({
        time: hourTimestamp,
        open,
        high,
        low,
        close,
        volume
      })
    }
    
    return {
      ltfCandles: visibleM5,
      htfCandles: h1Candles
    }
  }, [allM5Candles, visibleCount])

  // 3. Lightweight Charts Initializations & Dynamic Series Rendering
  useEffect(() => {
    if (!isMounted || !createChart || ltfCandles.length === 0) return

    // ── Build Lower Timeframe Chart (M5) ──
    if (ltfChartRef.current && !ltfChartInstance.current) {
      ltfChartInstance.current = createChart(ltfChartRef.current, {
        layout: {
          background: { color: '#060A12' },
          textColor: '#64748B',
        },
        grid: {
          vertLines: { color: 'rgba(30, 58, 95, 0.12)' },
          horzLines: { color: 'rgba(30, 58, 95, 0.12)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.05)',
        },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.05)',
          timeVisible: true,
        },
      })
      ltfCandleSeries.current = ltfChartInstance.current.addCandlestickSeries({
        upColor: '#34D399',
        downColor: '#F87171',
        borderUpColor: '#34D399',
        borderDownColor: '#F87171',
        wickUpColor: '#34D399',
        wickDownColor: '#F87171',
      })
    }

    // ── Build Higher Timeframe Chart (H1) ──
    if (htfChartRef.current && !htfChartInstance.current && layoutMode === 'split') {
      htfChartInstance.current = createChart(htfChartRef.current, {
        layout: {
          background: { color: '#060A12' },
          textColor: '#64748B',
        },
        grid: {
          vertLines: { color: 'rgba(30, 58, 95, 0.12)' },
          horzLines: { color: 'rgba(30, 58, 95, 0.12)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.05)',
        },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.05)',
          timeVisible: true,
        },
      })
      htfCandleSeries.current = htfChartInstance.current.addCandlestickSeries({
        upColor: 'rgba(52, 211, 153, 0.65)',
        downColor: 'rgba(248, 113, 113, 0.65)',
        borderUpColor: 'rgba(52, 211, 153, 0.65)',
        borderDownColor: 'rgba(248, 113, 113, 0.65)',
        wickUpColor: 'rgba(52, 211, 153, 0.65)',
        wickDownColor: 'rgba(248, 113, 113, 0.65)',
      })
    }

    // Feed visible replayed candles into chart datasets
    if (ltfCandleSeries.current) {
      ltfCandleSeries.current.setData(ltfCandles)
    }
    
    if (htfCandleSeries.current && layoutMode === 'split' && htfCandles.length > 0) {
      htfCandleSeries.current.setData(htfCandles)
    }

    // Dynamic cleanups when mode switches
    return () => {
      // Keep instances unless destroyed manually or layout resets
    }
  }, [isMounted, ltfCandles, htfCandles, layoutMode])

  // Handle resizing / viewport splits updates
  useEffect(() => {
    if (ltfChartInstance.current) {
      ltfChartInstance.current.resize(
        ltfChartRef.current?.clientWidth || 600,
        layoutMode === 'split' ? 320 : 450
      )
    }
    if (htfChartInstance.current && layoutMode === 'split') {
      htfChartInstance.current.resize(
        htfChartRef.current?.clientWidth || 600,
        320
      )
    }
  }, [layoutMode, allM5Candles])

  // Synchronize Crosshairs linkages across Split layouts
  useEffect(() => {
    if (layoutMode !== 'split' || !ltfChartInstance.current || !htfChartInstance.current) return

    const syncCrosshair = (sourceChart: any, targetChart: any) => {
      sourceChart.subscribeCrosshairMove((param: any) => {
        if (!param.time) {
          targetChart.clearCrosshairPosition()
          return
        }
        targetChart.setCrosshairPosition({
          price: param.price || undefined,
          time: param.time
        })
      })
    }

    syncCrosshair(ltfChartInstance.current, htfChartInstance.current)
    syncCrosshair(htfChartInstance.current, ltfChartInstance.current)
  }, [layoutMode])

  // 4. Render Active SL & TP dashed target lines on Lower Timeframe
  useEffect(() => {
    if (!ltfCandleSeries.current) return

    // Remove existing lines first
    if (ltfEntryLine.current) ltfCandleSeries.current.removePriceLine(ltfEntryLine.current)
    if (ltfSlLine.current) ltfCandleSeries.current.removePriceLine(ltfSlLine.current)
    if (ltfTpLine.current) ltfCandleSeries.current.removePriceLine(ltfTpLine.current)

    if (activePosition) {
      // Render entry target
      ltfEntryLine.current = ltfCandleSeries.current.createPriceLine({
        price: activePosition.entryPrice,
        color: '#38BDF8',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: 'ENTRY LEVEL',
      })

      // Render Stop Loss target
      if (activePosition.slPrice) {
        ltfSlLine.current = ltfCandleSeries.current.createPriceLine({
          price: activePosition.slPrice,
          color: '#F87171',
          lineWidth: 1.5,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `SL (${slPips} pips)`,
        })
      }

      // Render Take Profit target
      if (activePosition.tpPrice) {
        ltfTpLine.current = ltfCandleSeries.current.createPriceLine({
          price: activePosition.tpPrice,
          color: '#34D399',
          lineWidth: 1.5,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `TP (${tpPips} pips)`,
        })
      }
    }
  }, [activePosition, slPips, tpPips])

  // 5. Automatic playback tick generator loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        stepForward()
      }, playSpeed)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, playSpeed, visibleCount, activePosition])

  // Single step forward handler
  const stepForward = () => {
    if (visibleCount >= allM5Candles.length - 1) {
      setIsPlaying(false)
      return
    }

    const nextIndex = visibleCount + 1
    const nextCandle = allM5Candles[nextIndex]
    
    // Evaluate active trade targets (checking high/low bounds of the next candle)
    if (activePosition) {
      const { direction, entryPrice, slPrice, tpPrice, lots } = activePosition
      let isClosed = false
      let exitPrice = 0
      let exitReason: 'TP' | 'SL' = 'TP'

      if (direction === 'buy') {
        if (slPrice && nextCandle.low <= slPrice) {
          isClosed = true
          exitPrice = slPrice
          exitReason = 'SL'
        } else if (tpPrice && nextCandle.high >= tpPrice) {
          isClosed = true
          exitPrice = tpPrice
          exitReason = 'TP'
        }
      } else { // Sell position checks
        if (slPrice && nextCandle.high >= slPrice) {
          isClosed = true
          exitPrice = slPrice
          exitReason = 'SL'
        } else if (tpPrice && nextCandle.low <= tpPrice) {
          isClosed = true
          exitPrice = tpPrice
          exitReason = 'TP'
        }
      }

      if (isClosed) {
        executeCloseTrade(exitPrice, exitReason, nextIndex)
      }
    }

    setVisibleCount(nextIndex)
  }

  // Single step backward handler
  const stepBackward = () => {
    if (visibleCount <= 10) return
    setVisibleCount(prev => prev - 1)
  }

  // Scissors Jump (Scissors tool to crop future candles at clicked point)
  const handleScissorsClick = () => {
    setIsScissorsActive(true)
    alert("Click a point on the M5 chart timeline to cut future candles and initiate backtesting replay!")
    
    // In TV Lightweight charts, we can subscribe to click events
    if (ltfChartInstance.current) {
      const onClickHandler = (param: any) => {
        if (param.time) {
          // Find matching index of candle
          const clickedTime = param.time
          const matchIdx = allM5Candles.findIndex(c => c.time === clickedTime)
          if (matchIdx !== -1) {
            setVisibleCount(Math.max(30, matchIdx))
            setIsScissorsActive(false)
            ltfChartInstance.current.unsubscribeClick(onClickHandler)
          }
        }
      }
      ltfChartInstance.current.subscribeClick(onClickHandler)
    }
  }

  // 6. Virtual Order Placement Broker
  const executePlaceOrder = (direction: 'buy' | 'sell') => {
    if (allM5Candles.length === 0) return
    if (activePosition) {
      alert("A position is already active! Clear or close the current trade first.")
      return
    }

    const currentCandle = ltfCandles[ltfCandles.length - 1]
    const entryPrice = currentCandle.close
    
    const pipSize = symbol === 'XAUUSD' ? 0.1 : 1.0 // Pips distance bounds
    const slDistance = slPips * pipSize
    const tpDistance = tpPips * pipSize

    const slPrice = direction === 'buy' ? entryPrice - slDistance : entryPrice + slDistance
    const tpPrice = direction === 'buy' ? entryPrice + tpDistance : entryPrice - tpDistance

    setActivePosition({
      direction,
      entryPrice,
      slPrice: Number(slPrice.toFixed(2)),
      tpPrice: Number(tpPrice.toFixed(2)),
      lots,
      entryIndex: visibleCount
    })
  }

  // Virtual Order Auto-Execution Close
  const executeCloseTrade = (exitPrice: number, reason: 'TP' | 'SL' | 'Manual', exitIdx: number = visibleCount) => {
    if (!activePosition) return

    const { direction, entryPrice, lots, entryIndex } = activePosition
    
    // P&L calculation: Gold 1 lot = 100 contracts (1 pip size = 0.10 -> $10 pnl per lot)
    // BankNifty: index multipliers = 15 index points contracts
    const pipMultiplier = symbol === 'XAUUSD' ? 100 : 15
    const priceDiff = direction === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice
    
    const pnl = priceDiff * lots * pipMultiplier
    const pctReturn = (pnl / accountBalance) * 100
    const newBalance = accountBalance + pnl

    const outcome = pnl >= 0 ? 'win' as const : 'loss' as const

    // If Take profit is hit, trigger high-delight confetti pop!
    if (reason === 'TP' && pnl > 0) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#38BDF8', '#34D399', '#F8FAFC']
      })
    }

    const dateStr = new Date(allM5Candles[exitIdx].time * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

    const backtestTradeLog: BacktestTrade = {
      id: `trade_${Date.now()}`,
      symbol,
      direction,
      entryPrice: Number(entryPrice.toFixed(2)),
      exitPrice: Number(exitPrice.toFixed(2)),
      sl: activePosition.slPrice,
      tp: activePosition.tpPrice,
      lots,
      pnl: Number(pnl.toFixed(2)),
      pctReturn: Number(pctReturn.toFixed(2)),
      outcome,
      date: dateStr,
      notes: reason === 'Manual' ? 'Manual Market Close' : `Target ${reason} hit`
    }

    setTradesHistory(prev => [backtestTradeLog, ...prev])
    setAccountBalance(newBalance)
    setActivePosition(null)
  }

  // 7. Supabase automated backtests tracker synchronization fallback
  const syncTradeToCloud = async (trade: BacktestTrade) => {
    setSavingTrade(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingTrade(false)
      return
    }

    const dbPayload = {
      user_id: user.id,
      symbol: trade.symbol,
      direction: trade.direction,
      entry_price: trade.entryPrice,
      exit_price: trade.exitPrice,
      sl_price: trade.sl,
      tp_price: trade.tp,
      lots: trade.lots,
      pnl: trade.pnl,
      pct_return: trade.pctReturn,
      duration_candles: 1,
      notes: trade.notes || ''
    }

    await supabase.from('backtest_trades').insert(dbPayload)
    setSavingTrade(false)
  }

  // Sync historical trades automatically on additions
  useEffect(() => {
    if (tradesHistory.length > 0) {
      const latest = tradesHistory[0]
      syncTradeToCloud(latest)
    }
  }, [tradesHistory])

  // Save edited inline notes
  const saveNotesEdit = (tId: string) => {
    setTradesHistory(prev => prev.map(t => t.id === tId ? { ...t, notes: editingTradeNotes } : t))
    setEditingTradeId(null)
    setEditingTradeNotes('')
  }

  // Calculate realtime running floating pnl for active trades
  const runningPnl = useMemo(() => {
    if (!activePosition || ltfCandles.length === 0) return 0
    const currentPrice = ltfCandles[ltfCandles.length - 1].close
    const { direction, entryPrice, lots } = activePosition
    
    const pipMultiplier = symbol === 'XAUUSD' ? 100 : 15
    const priceDiff = direction === 'buy' ? currentPrice - entryPrice : entryPrice - currentPrice
    return priceDiff * lots * pipMultiplier
  }, [activePosition, ltfCandles, symbol])

  // 8. Stats Dashboard calculations
  const performanceStats = useMemo(() => {
    const total = tradesHistory.length
    if (total === 0) return { total, wins: 0, winRate: 0, pnl: 0, avgWin: 0, avgLoss: 0, maxDrawdown: 0, profitFactor: 0 }

    const wins = tradesHistory.filter(t => t.outcome === 'win').length
    const winRate = (wins / total) * 100
    const pnlSum = tradesHistory.reduce((sum, t) => sum + t.pnl, 0)
    
    const winTrades = tradesHistory.filter(t => t.pnl > 0)
    const lossTrades = tradesHistory.filter(t => t.pnl < 0)
    
    const avgWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + t.pnl, 0) / winTrades.length : 0
    const avgLoss = lossTrades.length > 0 ? Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0) / lossTrades.length) : 0
    
    const totalProfit = winTrades.reduce((sum, t) => sum + t.pnl, 0)
    const totalLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0))
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99.9 : 0

    // Compiling compound equity curve dataset for recharts
    let compoundBal = 10000
    const equityCurveData = [...tradesHistory].reverse().map((t, idx) => {
      compoundBal += t.pnl
      return {
        tradeIndex: `T-${idx + 1}`,
        balance: Number(compoundBal.toFixed(2)),
      }
    })

    return {
      total,
      wins,
      winRate,
      pnl: pnlSum,
      avgWin,
      avgLoss,
      profitFactor,
      equityCurveData: [{ tradeIndex: 'Start', balance: 10000 }, ...equityCurveData]
    }
  }, [tradesHistory])

  // 9. Floating draws and tools variables
  const currentAssetPrice = ltfCandles.length > 0 ? ltfCandles[ltfCandles.length - 1].close : 0

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      
      {/* Dynamic Header Navbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/5 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(245,159,11,0.15)]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Visual Replay Backtester <span className="text-[10px] bg-primary text-black font-black uppercase px-2 py-0.5 rounded">Replay</span>
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">Step candle by candle and analyze strategy performance on actual Gold & BankNifty data.</p>
          </div>
        </div>

        {/* Configurations Toggle row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Symbol Select */}
          <div className="flex bg-[#060A12] border border-white/5 p-1 rounded-xl">
            <button
              onClick={() => setSymbol('XAUUSD')}
              className={cn(
                "px-3.5 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider",
                symbol === 'XAUUSD' ? "bg-primary/10 border border-primary/20 text-primary" : "text-[#64748B]"
              )}
            >
              Gold (XAUUSD)
            </button>
            <button
              onClick={() => setSymbol('BANKNIFTY')}
              className={cn(
                "px-3.5 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider",
                symbol === 'BANKNIFTY' ? "bg-primary/10 border border-primary/20 text-primary" : "text-[#64748B]"
              )}
            >
              BankNifty
            </button>
          </div>

          {/* Layout Mode */}
          <div className="flex bg-[#060A12] border border-white/5 p-1 rounded-xl">
            <button
              onClick={() => setLayoutMode('single')}
              className={cn(
                "px-3 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider",
                layoutMode === 'single' ? "bg-white/5 text-white" : "text-[#64748B]"
              )}
            >
              Single Chart
            </button>
            <button
              onClick={() => setLayoutMode('split')}
              className={cn(
                "px-3 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider",
                layoutMode === 'split' ? "bg-white/5 text-white" : "text-[#64748B]"
              )}
            >
              Split HTF/LTF
            </button>
          </div>
        </div>
      </div>

      {/* Main Backtesting Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Interactive Replay Charts (3 Cols) */}
        <div className="xl:col-span-3 space-y-4">
          <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />

            {/* Sync multi chart splits */}
            <div className={cn("grid gap-4", layoutMode === 'split' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
              
              {/* Higher Timeframe aggregate chart */}
              {layoutMode === 'split' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#64748B]">
                    <span className="flex items-center gap-1.5 text-[#94A3B8]">
                      <Layers className="w-3.5 h-3.5" /> 1-Hour Trend Structure (HTF)
                    </span>
                    <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white">
                      Cron Synced
                    </span>
                  </div>
                  <div ref={htfChartRef} className="border border-white/5 rounded-2xl overflow-hidden bg-[#060A12] shadow-inner" />
                </div>
              )}

              {/* Lower Timeframe execution chart */}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#64748B]">
                  <span className="flex items-center gap-1.5 text-primary">
                    <Target className="w-3.5 h-3.5 animate-pulse" /> 5-Minute Entry Execution (LTF)
                  </span>
                  <span className="text-white font-mono uppercase font-bold text-[9px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                    {symbol} Live Replay
                  </span>
                </div>
                <div ref={ltfChartRef} className="border border-white/5 rounded-2xl overflow-hidden bg-[#060A12] shadow-inner" />
              </div>
            </div>

            {/* Synchronized Replay Controller Panel Bar */}
            <div className="bg-[#060A12] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleScissorsClick}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all cursor-pointer",
                    isScissorsActive 
                      ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" 
                      : "bg-[#0D1421] border-white/5 hover:border-white/10 text-white"
                  )}
                  title="Cut timeline at clicked candle point"
                >
                  <Scissors className="w-4 h-4" />
                </button>

                <div className="w-[1px] h-6 bg-white/10 mx-1" />

                <button
                  onClick={stepBackward}
                  className="p-2.5 bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-xl text-white transition-all active:scale-95 cursor-pointer"
                  title="Step candle backward"
                >
                  ◀◀
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2.5 bg-primary text-black rounded-xl hover:bg-primary/95 transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center"
                  title={isPlaying ? "Pause Replay" : "Play Replay Auto ticks"}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-black" />}
                </button>
                <button
                  onClick={stepForward}
                  className="p-2.5 bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-xl text-white transition-all active:scale-95 cursor-pointer"
                  title="Step candle forward"
                >
                  ▶▶
                </button>
              </div>

              {/* speed slider */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#64748B] uppercase font-black tracking-widest">Replay Speed</span>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={playSpeed}
                  onChange={e => setPlaySpeed(Number(e.target.value))}
                  className="w-32 bg-[#0D1421] accent-primary rounded-lg cursor-pointer h-1.5 border border-white/5"
                />
                <span className="text-[9px] font-mono text-white bg-white/5 px-2 py-0.5 rounded">
                  {(playSpeed / 1000).toFixed(1)}s
                </span>
              </div>

              {/* Session details */}
              <div className="text-right text-[10px] font-medium leading-normal text-[#64748B]">
                <div className="font-bold text-white uppercase flex items-center gap-1.5 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                  Price: {currentAssetPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div>Candles replayed: {visibleCount} / {allM5Candles.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Floating Broker & Execution Panel (1 Col) */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-5 relative">
            <h2 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2.5 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" /> Backtest Broker
            </h2>

            {/* Account card */}
            <div className="bg-[#060A12] border border-white/5 rounded-2xl p-4 text-center shadow-inner">
              <p className="text-[9px] text-[#64748B] uppercase font-black tracking-widest">Backtest Balance</p>
              <h3 className="text-2xl font-black text-white mt-1 font-mono">
                ${accountBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center justify-between text-[10px] mt-3 pt-3 border-t border-white/5 text-[#64748B]">
                <span>Active Trades:</span>
                <span className={cn("font-bold font-mono", runningPnl >= 0 ? "text-[#34D399]" : "text-[#F87171]")}>
                  {activePosition ? (runningPnl >= 0 ? `+$${runningPnl.toFixed(2)}` : `-$${Math.abs(runningPnl).toFixed(2)}`) : "$0.00"}
                </span>
              </div>
            </div>

            {/* Position execution toggles */}
            <div className="space-y-4 pt-1.5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => executePlaceOrder('buy')}
                  disabled={!!activePosition}
                  className="py-3 bg-emerald-500/10 hover:bg-emerald-500 disabled:bg-[#060A12] border border-emerald-500/20 disabled:border-white/5 text-emerald-400 hover:text-black disabled:text-[#334155] font-black text-xs rounded-xl tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" /> BUY / LONG
                </button>
                <button
                  onClick={() => executePlaceOrder('sell')}
                  disabled={!!activePosition}
                  className="py-3 bg-red-500/10 hover:bg-red-500 disabled:bg-[#060A12] border border-red-500/20 disabled:border-white/5 text-red-400 hover:text-black disabled:text-[#334155] font-black text-xs rounded-xl tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <TrendingDown className="w-3.5 h-3.5 shrink-0" /> SELL / SHORT
                </button>
              </div>

              {activePosition && (
                <button
                  onClick={() => executeCloseTrade(currentAssetPrice, 'Manual')}
                  className="w-full py-3 bg-white/5 hover:bg-red-500/25 border border-white/10 hover:border-red-500/30 text-white hover:text-red-400 text-xs font-black rounded-xl tracking-wider transition-all active:scale-95 cursor-pointer"
                >
                  CLOSE ACTIVE POSITION
                </button>
              )}
            </div>

            {/* Inputs grid */}
            <div className="space-y-3.5 border-t border-white/5 pt-4">
              <div className="space-y-1">
                <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">Position Size (Lots)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={lots}
                  onChange={e => setLots(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                  className="w-full bg-[#060A12] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white font-bold focus:outline-none focus:border-primary/50 text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">Stop Loss (pips)</label>
                  <input
                    type="number"
                    min="5"
                    value={slPips}
                    onChange={e => setSlPips(Math.max(5, parseInt(e.target.value) || 5))}
                    className="w-full bg-[#060A12] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white font-bold focus:outline-none focus:border-primary/50 text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">Take Profit (pips)</label>
                  <input
                    type="number"
                    min="5"
                    value={tpPips}
                    onChange={e => setTpPips(Math.max(5, parseInt(e.target.value) || 5))}
                    className="w-full bg-[#060A12] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white font-bold focus:outline-none focus:border-primary/50 text-right"
                  />
                </div>
              </div>
            </div>

            {/* Warning indicator */}
            {!activePosition && (
              <div className="p-3 bg-white/2 border border-white/5 rounded-xl flex gap-2.5 items-start text-[10px] text-[#64748B] leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Pre-flight:</strong> virtual targets SL & TP project instantly as dashed bounds on your LTF chart upon Buy/Sell entry.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs list Grid underneath (Journal & Performance) */}
      <div className="space-y-4 border-t border-white/5 pt-6">
        <div className="flex bg-[#060A12] border border-white/5 p-1 rounded-xl max-w-sm">
          <button
            onClick={() => setActiveTab('journal')}
            className={cn(
              "flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === 'journal' ? "bg-primary/10 border border-primary/20 text-primary" : "text-[#64748B]"
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Replay Trades Journal
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={cn(
              "flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === 'performance' ? "bg-primary/10 border border-primary/20 text-primary" : "text-[#64748B]"
            )}
          >
            <Award className="w-3.5 h-3.5" /> Strategy Edge Analytics
          </button>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === 'journal' ? (
            <motion.div
              key="journal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
                <h3 className="text-xs font-black uppercase text-white tracking-widest">Replay Logs database</h3>
                {savingTrade && (
                  <span className="text-[9px] font-bold text-primary animate-pulse">Syncing backtest trade to Cloud...</span>
                )}
              </div>

              <div className="overflow-x-auto border border-white/5 rounded-2xl bg-[#060A12]/30">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2 text-[9px] text-[#64748B] uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Trade ID</th>
                      <th className="py-3 px-3">Direction</th>
                      <th className="py-3 px-3">Lots</th>
                      <th className="py-3 px-3">Entry Price</th>
                      <th className="py-3 px-3">Exit Price</th>
                      <th className="py-3 px-3">Realized P&L</th>
                      <th className="py-3 px-3">Return (%)</th>
                      <th className="py-3 px-4">Journal Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {tradesHistory.map((t, index) => {
                      const isEditing = editingTradeId === t.id
                      return (
                        <tr key={t.id} className="group hover:bg-white/[0.01] transition-all">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#64748B]">#{tradesHistory.length - index}</td>
                          <td className="py-3.5 px-3">
                            <span className={cn(
                              "text-[9px] px-2 py-0.5 rounded font-black uppercase border tracking-wider",
                              t.direction === 'buy' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                            )}>
                              {t.direction}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-white">{t.lots}</td>
                          <td className="py-3.5 px-3 font-mono font-bold text-[#94A3B8]">{t.entryPrice}</td>
                          <td className="py-3.5 px-3 font-mono font-bold text-[#94A3B8]">{t.exitPrice}</td>
                          <td className={cn("py-3.5 px-3 font-mono font-black", t.pnl >= 0 ? "text-[#34D399]" : "text-[#F87171]")}>
                            {t.pnl >= 0 ? `+$${t.pnl.toLocaleString()}` : `-$${Math.abs(t.pnl).toLocaleString()}`}
                          </td>
                          <td className={cn("py-3.5 px-3 font-mono font-bold", t.pctReturn >= 0 ? "text-[#34D399]" : "text-[#F87171]")}>
                            {t.pctReturn >= 0 ? `+${t.pctReturn}%` : `${t.pctReturn}%`}
                          </td>
                          <td className="py-3.5 px-4">
                            {isEditing ? (
                              <div className="flex items-center gap-2 max-w-full">
                                <input
                                  type="text"
                                  value={editingTradeNotes}
                                  onChange={e => setEditingTradeNotes(e.target.value)}
                                  className="flex-1 min-w-0 bg-[#060A12] border border-primary/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveNotesEdit(t.id)
                                    if (e.key === 'Escape') setEditingTradeId(null)
                                  }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => saveNotesEdit(t.id)}
                                  className="p-1 rounded bg-primary/10 border border-primary/20 text-primary cursor-pointer shrink-0"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTradeId(null)}
                                  className="p-1 rounded bg-white/5 border border-white/10 text-[#64748B] cursor-pointer shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3 text-white font-medium">
                                <span className="truncate">{t.notes || '—'}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTradeId(t.id)
                                    setEditingTradeNotes(t.notes || '')
                                  }}
                                  className="p-1 rounded bg-white/0 hover:bg-white/5 text-[#334155] hover:text-primary transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                  title="Edit notes inline"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {tradesHistory.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-[#64748B] italic">
                          No trades backtested in this session yet. Take long or short positions above to build a database!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="performance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Stats block cards */}
              <div className="lg:col-span-1 bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase text-[#64748B] tracking-wider border-b border-white/5 pb-2 mb-4">Edge analytics parameter</h3>
                  
                  <div className="space-y-4 text-xs font-semibold">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Total Executions:</span>
                      <span className="text-white font-bold">{performanceStats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Win Rate %:</span>
                      <span className="text-emerald-400 font-bold font-mono">{performanceStats.winRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Profit Factor:</span>
                      <span className="text-primary font-black font-mono">{performanceStats.profitFactor.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Average Profit:</span>
                      <span className="text-emerald-400 font-bold font-mono">+${performanceStats.avgWin.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Average Loss:</span>
                      <span className="text-red-400 font-bold font-mono">-${performanceStats.avgLoss.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-3.5 bg-[#060A12] border border-white/5 rounded-2xl text-center">
                  <p className="text-[9px] text-[#64748B] uppercase font-black tracking-widest">Net Realized P&L</p>
                  <h4 className={cn("text-xl font-black mt-1 font-mono", performanceStats.pnl >= 0 ? "text-[#34D399]" : "text-[#F87171]")}>
                    {performanceStats.pnl >= 0 ? `+$${performanceStats.pnl.toFixed(2)}` : `-$${Math.abs(performanceStats.pnl).toFixed(2)}`}
                  </h4>
                </div>
              </div>

              {/* Compounding Equity Curve chart */}
              <div className="lg:col-span-2 bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4">
                <h3 className="text-xs font-black uppercase text-[#64748B] tracking-wider border-b border-white/5 pb-2">Compounding Equity growth curve</h3>
                
                {tradesHistory.length === 0 ? (
                  <div className="h-48 border border-dashed border-white/5 rounded-2xl flex items-center justify-center text-xs text-[#334155] italic">
                    Backtest trades first to plot compounding account balance curves.
                  </div>
                ) : (
                  <div className="h-56 w-full text-[9px] font-mono">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceStats.equityCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="equityGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="tradeIndex" stroke="#334155" />
                        <YAxis stroke="#334155" domain={['dataMin - 100', 'dataMax + 100']} />
                        <Tooltip contentStyle={{ backgroundColor: '#0D1421', borderColor: 'rgba(255,255,255,0.05)', color: '#fff' }} />
                        <Area type="monotone" dataKey="balance" stroke="#38BDF8" strokeWidth={2.5} fillOpacity={1} fill="url(#equityGlow)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}
