'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Play, Pause, Plus, Trash2, Scissors, Sparkles, TrendingUp,
  TrendingDown, Target, Clock, ShieldAlert, Award, RefreshCw,
  X, Check, Edit2, Layers, HelpCircle, ChevronRight, Activity, FileSpreadsheet,
  Calculator, Settings, Globe, PlayCircle, BarChart3, Database
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'
import confetti from 'canvas-confetti'

// Client-only check for lightweight-charts
let createChart: any = null
if (typeof window !== 'undefined') {
  createChart = require('lightweight-charts').createChart
}

interface BacktestTrade {
  id: string
  symbol: string
  direction: 'buy' | 'sell'
  entryPrice: number
  exitPrice: number | null
  sl: number | null
  tp: number | null
  lots: number
  pnl: number
  pctReturn: number
  status: string
  date: string
  notes?: string
}

export default function BacktestReplayPage() {
  const supabase = createClient()
  
  const [isMounted, setIsMounted] = useState(false)
  const [symbol, setSymbol] = useState<'XAUUSD' | 'BANKNIFTY'>('XAUUSD')
  const [timeframe, setTimeframe] = useState<string>('5m')
  const [layoutMode, setLayoutMode] = useState<'single' | 'split'>('split')
  
  // VPS API Server state
  const apiUrl = 'goldbook-backtest.ddnsfree.com'
  
  // Replay Session State
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStartDate, setSessionStartDate] = useState('2023-01-02')
  const [availableDates, setAvailableDates] = useState<{ from: string; to: string } | null>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [initialBalance, setInitialBalance] = useState<number>(10000)
  const [accountBalance, setAccountBalance] = useState<number>(10000)
  
  // Playback & Candlestick states
  const [ltfCandles, setLtfCandles] = useState<any[]>([])
  const [htfCandles, setHtfCandles] = useState<any[]>([])
  const [currentCandle, setCurrentCandle] = useState<any>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState<number>(5) // Candles per second
  const [isScissorsActive, setIsScissorsActive] = useState(false)
  
  // Broker State
  const [lots, setLots] = useState<number>(1.0)
  const [slPips, setSlPips] = useState<number>(50)
  const [tpPips, setTpPips] = useState<number>(150)
  const [activePosition, setActivePosition] = useState<{
    id: string
    direction: 'buy' | 'sell'
    entryPrice: number
    slPrice: number | null
    tpPrice: number | null
    lots: number
  } | null>(null)
  
  const [tradesHistory, setTradesHistory] = useState<BacktestTrade[]>([])
  const [stats, setStats] = useState({
    total_trades: 0,
    wins: 0,
    losses: 0,
    win_rate: 0,
    total_pnl: 0,
    avg_rr: 0
  })
  
  const [activeTab, setActiveTab] = useState<'journal' | 'performance'>('journal')
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null)
  const [editingTradeNotes, setEditingTradeNotes] = useState('')

  // DOM Refs
  const ltfChartRef = useRef<HTMLDivElement>(null)
  const htfChartRef = useRef<HTMLDivElement>(null)
  const ltfChartInstance = useRef<any>(null)
  const htfChartInstance = useRef<any>(null)
  const ltfCandleSeries = useRef<any>(null)
  const htfCandleSeries = useRef<any>(null)
  const ltfEntryLine = useRef<any>(null)
  const ltfSlLine = useRef<any>(null)
  const ltfTpLine = useRef<any>(null)
  
  const wsRef = useRef<WebSocket | null>(null)

  // 1. Force Client-only Mounting
  useEffect(() => {
    setIsMounted(true)
    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  // 2. Fetch available dataset dates when symbol is changed
  useEffect(() => {
    if (!isMounted) return
    
    const fetchDates = async () => {
      try {
        const cleanHost = apiUrl.replace(/^(https?:\/\/)?/, '').replace(/\/$/, '')
        const res = await fetch(`https://${cleanHost}/api/candles/available-dates?symbol=${symbol}`)
        const data = await res.json()
        if (data.from && data.to) {
          setAvailableDates({ from: data.from, to: data.to })
          setSessionStartDate(data.from)
        }
      } catch (err) {
        console.warn("Could not fetch database available dates: ", err)
      }
    }
    
    fetchDates()
  }, [symbol, apiUrl, isMounted])

  // 3. Synthesize Higher Timeframe (H1) candles dynamically from accumulated LTF (M5/M15) candles
  useEffect(() => {
    if (ltfCandles.length === 0) return
    
    // Synthesize H1 candles from the lower timeframe candles
    const synthesizedH1: any[] = []
    const tfInMinutes = timeframe.includes('m') ? parseInt(timeframe) : 60
    const candlesPerBar = Math.max(1, 60 / tfInMinutes)
    
    for (let i = 0; i < ltfCandles.length; i += candlesPerBar) {
      const chunk = ltfCandles.slice(i, i + candlesPerBar)
      if (chunk.length === 0) continue
      
      const openCandle = chunk[0]
      const closeCandle = chunk[chunk.length - 1]
      
      const open = openCandle.open
      const close = closeCandle.close
      const high = Math.max(...chunk.map(c => c.high))
      const low = Math.min(...chunk.map(c => c.low))
      const volume = chunk.reduce((sum, c) => sum + (c.volume || 0), 0)
      
      // Hourly timestamp
      const hourTimestamp = Math.floor(openCandle.time / 3600) * 3600
      
      synthesizedH1.push({
        time: hourTimestamp,
        open,
        high,
        low,
        close,
        volume
      })
    }
    
    setHtfCandles(synthesizedH1)
  }, [ltfCandles, timeframe])

  // 4. Initialize Lightweight Charts (LTF & HTF)
  useEffect(() => {
    if (!isMounted || !createChart || !sessionId) return

    // Build LTF Chart
    if (ltfChartRef.current && !ltfChartInstance.current) {
      ltfChartInstance.current = createChart(ltfChartRef.current, {
        layout: {
          background: { color: '#060A12' },
          textColor: '#64748B',
        },
        grid: {
          vertLines: { color: 'rgba(30, 58, 95, 0.08)' },
          horzLines: { color: 'rgba(30, 58, 95, 0.08)' },
        },
        rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.03)' },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.03)',
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

    // Build HTF Chart (1H)
    if (htfChartRef.current && !htfChartInstance.current && layoutMode === 'split') {
      htfChartInstance.current = createChart(htfChartRef.current, {
        layout: {
          background: { color: '#060A12' },
          textColor: '#64748B',
        },
        grid: {
          vertLines: { color: 'rgba(30, 58, 95, 0.08)' },
          horzLines: { color: 'rgba(30, 58, 95, 0.08)' },
        },
        rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.03)' },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.03)',
          timeVisible: true,
        },
      })
      htfCandleSeries.current = htfChartInstance.current.addCandlestickSeries({
        upColor: 'rgba(52, 211, 153, 0.55)',
        downColor: 'rgba(248, 113, 113, 0.55)',
        borderUpColor: 'rgba(52, 211, 153, 0.55)',
        borderDownColor: 'rgba(248, 113, 113, 0.55)',
        wickUpColor: 'rgba(52, 211, 153, 0.55)',
        wickDownColor: 'rgba(248, 113, 113, 0.55)',
      })
    }

    // Load initial sets
    if (ltfCandleSeries.current && ltfCandles.length > 0) {
      ltfCandleSeries.current.setData(ltfCandles)
    }
    
    if (htfCandleSeries.current && layoutMode === 'split' && htfCandles.length > 0) {
      htfCandleSeries.current.setData(htfCandles)
    }
  }, [isMounted, ltfCandles, htfCandles, layoutMode, sessionId])

  // Chart Resize syncing
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
  }, [layoutMode, ltfCandles])

  // Synchronize Split Crosshairs
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

  // 5. Draw Stop Loss (SL) & Take Profit (TP) lines on the chart
  useEffect(() => {
    if (!ltfCandleSeries.current) return

    // Remove existing lines
    if (ltfEntryLine.current) ltfCandleSeries.current.removePriceLine(ltfEntryLine.current)
    if (ltfSlLine.current) ltfCandleSeries.current.removePriceLine(ltfSlLine.current)
    if (ltfTpLine.current) ltfCandleSeries.current.removePriceLine(ltfTpLine.current)

    if (activePosition) {
      // Entry Level
      ltfEntryLine.current = ltfCandleSeries.current.createPriceLine({
        price: activePosition.entryPrice,
        color: '#F59E0B',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: 'ENTRY LEVEL',
      })

      // Stop Loss Target
      if (activePosition.slPrice) {
        ltfSlLine.current = ltfCandleSeries.current.createPriceLine({
          price: activePosition.slPrice,
          color: '#EF4444',
          lineWidth: 1.5,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `SL (${slPips} pips)`,
        })
      }

      // Take Profit Target
      if (activePosition.tpPrice) {
        ltfTpLine.current = ltfCandleSeries.current.createPriceLine({
          price: activePosition.tpPrice,
          color: '#10B981',
          lineWidth: 1.5,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `TP (${tpPips} pips)`,
        })
      }
    }
  }, [activePosition, slPips, tpPips])



  // 7. Start Simulation Session (REST Call)
  const handleStartSession = async () => {
    setIsStartingSession(true)
    const cleanHost = apiUrl.replace(/^(https?:\/\/)?/, '').replace(/\/$/, '')
    
    try {
      // 1. Create Session in VPS database
      const startRes = await fetch(`https://${cleanHost}/api/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol,
          start_date: sessionStartDate,
          timeframe: timeframe,
          initial_balance: initialBalance
        })
      })
      
      const sessionData = await startRes.json()
      if (!sessionData.session_id) {
        throw new Error(sessionData.detail || "Failed to create session.")
      }

      const activeSessId = sessionData.session_id
      setSessionId(activeSessId)
      setAccountBalance(initialBalance)

      // 2. Fetch Historical candles preceding start date (Initial render)
      const histRes = await fetch(
        `https://${cleanHost}/api/candles/history?symbol=${symbol}&start_date=${sessionStartDate}&timeframe=${timeframe}&limit=200`
      )
      const historicalCandles = await histRes.json()
      
      if (historicalCandles && historicalCandles.length > 0) {
        setLtfCandles(historicalCandles)
        setCurrentCandle(historicalCandles[historicalCandles.length - 1])
      }

      // 3. Establish WebSocket connection for real-time candle streaming
      startWebSocket(activeSessId, cleanHost)
      
    } catch (err: any) {
      alert(`Connection Error: Make sure your VPS setup script is completed and the API URL is correct.\n\nDetail: ${err.message}`)
    } finally {
      setIsStartingSession(false)
    }
  }

  // 8. WebSocket stream connector
  const startWebSocket = (activeSessId: number, cleanHost: string) => {
    if (wsRef.current) wsRef.current.close()

    const ws = new WebSocket(
      `wss://${cleanHost}/api/candles/replay?symbol=${symbol}&start_date=${sessionStartDate}&timeframe=${timeframe}&session_id=${activeSessId}&speed=${playSpeed}`
    )

    ws.onopen = () => {
      console.log("WebSocket Replay Stream Online")
    }

    ws.onmessage = async (event) => {
      const data = jsonParseSafe(event.data)
      if (!data) return

      if (data.error) {
        alert(`WebSocket Error: ${data.error}`)
        setIsPlaying(false)
        return
      }

      // Handle streamed candle update
      if (data.type === "candle") {
        const newBar = data.candle
        
        // Push bar onto chart
        if (ltfCandleSeries.current) {
          ltfCandleSeries.current.update(newBar)
        }
        
        setLtfCandles(prev => {
          // If candle exists at this timestamp, update it, else append
          const exists = prev.findIndex(c => c.time === newBar.time)
          if (exists !== -1) {
            const copy = [...prev]
            copy[exists] = newBar
            return copy
          }
          return [...prev, newBar]
        })
        setCurrentCandle(newBar)
      }

      // Handle SL/TP auto hit triggered by server
      if (data.type === "trade_closed") {
        setIsPlaying(false) // Pause replay for user focus
        
        // Clean active UI elements
        setActivePosition(null)
        
        // Show confetti for wins!
        if (data.pnl > 0) {
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.65 },
            colors: ['#F59E0B', '#10B981', '#ffffff']
          })
        }
        
        // Sync trade row up to Supabase Cloud Journal
        syncClosedTradeToCloud(data.trade_id, data.exit_price, data.pnl, data.reason, new Date(data.time * 1000).toISOString())
        
        // Reload journal tab
        fetchJournalLogs(activeSessId)
      }

      if (data.type === "end") {
        setIsPlaying(false)
        alert("Replay dataset completed! No more 1-minute historical data exists past this range.")
      }
    }

    ws.onclose = () => {
      console.log("WebSocket Replay Stream Offline")
      setIsPlaying(false)
    }

    wsRef.current = ws
  }

  // Safe parsing helper
  const jsonParseSafe = (txt: string) => {
    try {
      return JSON.parse(txt)
    } catch {
      return null
    }
  }

  // 9. Fetch journal log records from VPS database
  const fetchJournalLogs = async (activeSessId: number) => {
    try {
      const cleanHost = apiUrl.replace(/^(https?:\/\/)?/, '').replace(/\/$/, '')
      const res = await fetch(`https://${cleanHost}/api/trades/journal/${activeSessId}`)
      const data = await res.json()
      
      if (data.trades) {
        setTradesHistory(data.trades)
        setStats(data.stats)
      }
      
      // Update running account balance
      const sessRes = await fetch(`https://${cleanHost}/api/sessions/${activeSessId}`)
      const sessData = await sessRes.json()
      if (sessData.current_balance) {
        setAccountBalance(sessData.current_balance)
      }
    } catch (err) {
      console.warn("Failed to fetch journal: ", err)
    }
  }

  // Re-fetch journal logs when session is updated
  useEffect(() => {
    if (sessionId) {
      fetchJournalLogs(sessionId)
    }
  }, [sessionId])

  // 10. Place REST Buy or Sell Order on the VPS Broker
  const executePlaceOrder = async (direction: 'buy' | 'sell') => {
    if (!sessionId || !currentCandle) return
    
    if (activePosition) {
      alert("A position is already active! Close the current trade before opening another.")
      return
    }

    const currentPrice = currentCandle.close
    const pipMultiplier = symbol === 'XAUUSD' ? 0.1 : 1.0
    const slDist = slPips * pipMultiplier
    const tpDist = tpPips * pipMultiplier

    const slPrice = direction === 'buy' ? currentPrice - slDist : currentPrice + slDist
    const tpPrice = direction === 'buy' ? currentPrice + tpDist : currentPrice - tpDist
    const entryTimeIso = new Date(currentCandle.time * 1000).toISOString()

    const cleanHost = apiUrl.replace(/^(https?:\/\/)?/, '').replace(/\/$/, '')
    
    try {
      const res = await fetch(`https://${cleanHost}/api/trades/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          symbol: symbol,
          direction: direction,
          entry_price: currentPrice,
          stop_loss: Number(slPrice.toFixed(2)),
          take_profit: Number(tpPrice.toFixed(2)),
          lot_size: lots,
          entry_time: entryTimeIso,
          timeframe: timeframe
        })
      })

      const data = await res.json()
      if (data.trade_id) {
        setActivePosition({
          id: data.trade_id,
          direction,
          entryPrice: currentPrice,
          slPrice: Number(slPrice.toFixed(2)),
          tpPrice: Number(tpPrice.toFixed(2)),
          lots
        })
      }
    } catch (err) {
      console.error("Order execution failed: ", err)
    }
  }

  // 11. Manual Order Close Trigger
  const executeCloseTrade = async () => {
    if (!sessionId || !activePosition || !currentCandle) return

    const currentPrice = currentCandle.close
    const exitTimeIso = new Date(currentCandle.time * 1000).toISOString()
    const cleanHost = apiUrl.replace(/^(https?:\/\/)?/, '').replace(/\/$/, '')

    try {
      const res = await fetch(`https://${cleanHost}/api/trades/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_id: parseInt(activePosition.id),
          exit_price: currentPrice,
          exit_time: exitTimeIso,
          reason: 'manual'
        })
      })
      const data = await res.json()
      
      // Confetti for manual wins
      if (data.pnl > 0) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.65 },
          colors: ['#F59E0B', '#10B981']
        })
      }

      // Sync completed trade to Supabase Cloud
      syncClosedTradeToCloud(parseInt(activePosition.id), currentPrice, data.pnl, 'manual', exitTimeIso)
      
      setActivePosition(null)
      fetchJournalLogs(sessionId)
    } catch (err) {
      console.error("Manual close failed: ", err)
    }
  }

  // 12. Replication Sync closed trade row up to Supabase Cloud Journal database
  const syncClosedTradeToCloud = async (tradeId: number, exitPrice: number, pnl: number, reason: string, exitTimeIso: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      if (!activePosition) return

      // Formulate sync payload matching Supabase Schema
      const dbPayload = {
        user_id: user.id,
        symbol: symbol,
        direction: activePosition.direction,
        entry_price: activePosition.entryPrice,
        exit_price: exitPrice,
        sl_price: activePosition.slPrice,
        tp_price: activePosition.tpPrice,
        lots: activePosition.lots,
        pnl: pnl,
        pct_return: Number(((pnl / accountBalance) * 100).toFixed(2)),
        duration_candles: 1,
        notes: `Backtest Replay Session #${sessionId}. Exited via ${reason.replace('_', ' ').toUpperCase()}.`
      }

      await supabase.from('backtest_trades').insert(dbPayload)
      console.log("Successfully replicated backtest trade log row to Supabase Cloud.")
    } catch (err) {
      console.warn("Supabase backup synchronization failed: ", err)
    }
  }

  // WebSocket Bi-Directional play control handlers
  const handlePlayToggle = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const newPlaying = !isPlaying
    setIsPlaying(newPlaying)
    wsRef.current.send(JSON.stringify({ action: newPlaying ? "play" : "pause" }))
  }

  const handleStepForward = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setIsPlaying(false)
    wsRef.current.send(JSON.stringify({ action: "step" }))
  }

  const handleSpeedChange = (val: number) => {
    setPlaySpeed(val)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "speed", value: val }))
    }
  }

  // Inline notes update handler
  const saveNotesEdit = (tId: string) => {
    setTradesHistory(prev => prev.map(t => t.id === tId ? { ...t, notes: editingTradeNotes } : t))
    setEditingTradeId(null)
    setEditingTradeNotes('')
  }

  // Real-time floating profit calculator
  const runningPnl = useMemo(() => {
    if (!activePosition || !currentCandle) return 0.00
    
    const currentPrice = currentCandle.close
    const multiplier = symbol === 'XAUUSD' ? 100.0 : 15.0
    const priceDiff = activePosition.direction === 'buy' 
      ? currentPrice - activePosition.entryPrice 
      : activePosition.entryPrice - currentPrice
      
    return priceDiff * activePosition.lots * multiplier
  }, [activePosition, currentCandle, symbol])

  const currentAssetPrice = currentCandle ? currentCandle.close : 0.00

  // Equity growth curve dataset compiler
  const equityCurveData = useMemo(() => {
    if (tradesHistory.length === 0) return []
    
    let runningBal = initialBalance
    const sortedTrades = [...tradesHistory].reverse()
    
    const chartPoints = sortedTrades.map((t, idx) => {
      runningBal += t.pnl
      return {
        tradeIndex: `T-${idx + 1}`,
        balance: Number(runningBal.toFixed(2))
      }
    })
    
    return [{ tradeIndex: 'Start', balance: initialBalance }, ...chartPoints]
  }, [tradesHistory, initialBalance])

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      
      {/* 1. Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/5 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(245,159,11,0.15)]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Visual Replay Backtester <span className="text-[10px] bg-primary text-black font-black uppercase px-2 py-0.5 rounded">VPS Replay</span>
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">Simulate high-fidelity trade execution, test strategy edge, and auto-journal performance in real-time.</p>
          </div>
        </div>

        {/* Action configs */}
        <div className="flex items-center gap-3">
          {sessionId && (
            <button
              onClick={() => {
                if (wsRef.current) wsRef.current.close()
                setSessionId(null)
                setLtfCandles([])
                setHtfCandles([])
                setCurrentCandle(null)
                setTradesHistory([])
                setActivePosition(null)
              }}
              className="p-2 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-black rounded-xl transition-all text-xs font-bold cursor-pointer"
            >
              Close Session
            </button>
          )}
        </div>
      </div>



      {/* --- SESSION CONFIG PANEL (Displays if no session is active) --- */}
      <AnimatePresence mode="wait">
        {!sessionId ? (
          <motion.div
            key="setup-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="max-w-xl mx-auto bg-[#0D1421] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-primary/5 blur-[80px] rounded-full pointer-events-none -z-10" />

            <div className="text-center space-y-2 border-b border-white/5 pb-4 mb-6">
              <PlayCircle className="w-10 h-10 text-primary mx-auto animate-pulse" />
              <h2 className="text-md font-black uppercase text-white tracking-widest">Configure Replay Session</h2>
              <p className="text-xs text-[#64748B]">Set parameters to fetch actual historical candles from your PostgreSQL DB.</p>
            </div>

            <div className="space-y-4">
              {/* Asset Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest block">Instrument Spot Asset</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSymbol('XAUUSD')}
                    className={cn(
                      "py-3 border text-xs font-bold rounded-xl transition-all cursor-pointer",
                      symbol === 'XAUUSD' 
                        ? "bg-primary/10 border-primary/40 text-primary shadow-lg shadow-primary/5" 
                        : "bg-[#060A12] border-white/5 text-[#64748B] hover:border-white/10"
                    )}
                  >
                    🏆 GOLD (XAUUSD)
                  </button>
                  <button
                    disabled
                    className="py-3 bg-[#060A12]/30 border border-white/5 text-[#334155] text-xs font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5"
                    title="BankNifty Spot data is coming soon!"
                  >
                    🏦 BANKNIFTY SPOT <span className="text-[8px] bg-white/5 text-[#64748B] px-1.5 py-0.5 rounded font-black uppercase">SOON</span>
                  </button>
                </div>
              </div>

              {/* Grid 2x2 for timeframe and initial balance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest block">Replay Timeframe</label>
                  <select
                    value={timeframe}
                    onChange={e => setTimeframe(e.target.value)}
                    className="w-full bg-[#060A12] border border-white/10 rounded-xl px-3.5 py-3 text-xs text-white font-bold focus:outline-none focus:border-primary/50"
                  >
                    <option value="1m">1 Minute (Base)</option>
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="30m">30 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="1d">1 Day</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest block">Replay Starting Balance ($)</label>
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={e => setInitialBalance(Math.max(100, parseInt(e.target.value) || 100))}
                    className="w-full bg-[#060A12] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest block">Replay Start Date</label>
                <input
                  type="date"
                  value={sessionStartDate}
                  min={availableDates?.from || "2008-01-01"}
                  max={availableDates?.to || "2026-05-01"}
                  onChange={e => setSessionStartDate(e.target.value)}
                  className="w-full bg-[#060A12] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-primary/50"
                />
                {availableDates ? (
                  <p className="text-[9px] text-[#64748B] italic">
                    💡 Database bounds: {availableDates.from} to {availableDates.to}
                  </p>
                ) : (
                  <p className="text-[9px] text-amber-500/80 italic">
                    ⚠️ Fetching database availability... Check VPS Nginx is started.
                  </p>
                )}
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartSession}
                disabled={isStartingSession}
                className="w-full py-3.5 bg-primary hover:bg-primary/95 disabled:bg-primary/20 text-black disabled:text-black/40 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-4"
              >
                {isStartingSession ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Establishing Session & Fetching history...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-black" /> Begin Replay Backtest
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          /* --- MAIN INTERACTIVE REPLAY SIMULATOR PANEL --- */
          <motion.div
            key="replay-workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 xl:grid-cols-4 gap-6"
          >
            {/* Left Charts Columns (3 Cols) */}
            <div className="xl:col-span-3 space-y-4">
              <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />

                {/* Grid Split Multi Chart Display */}
                <div className={cn("grid gap-4", layoutMode === 'split' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                  
                  {/* HTF Trend aggregate (1H) */}
                  {layoutMode === 'split' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[#64748B]">
                        <span className="flex items-center gap-1.5 text-[#94A3B8]">
                          <Layers className="w-3.5 h-3.5" /> 1-Hour Trend Structure (HTF)
                        </span>
                        <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white font-mono uppercase font-bold">
                          1H Resampled
                        </span>
                      </div>
                      <div ref={htfChartRef} className="border border-white/5 rounded-2xl overflow-hidden bg-[#060A12] shadow-inner" />
                    </div>
                  )}

                  {/* LTF Execution Chart */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[#64748B]">
                      <span className="flex items-center gap-1.5 text-primary">
                        <Target className="w-3.5 h-3.5 animate-pulse" /> Replay Execution Chart (LTF)
                      </span>
                      <span className="text-white font-mono uppercase font-bold text-[9px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                        {symbol} ({timeframe.toUpperCase()}) Live Replay
                      </span>
                    </div>
                    <div ref={ltfChartRef} className="border border-white/5 rounded-2xl overflow-hidden bg-[#060A12] shadow-inner" />
                  </div>
                </div>

                {/* Synced Control Bar */}
                <div className="bg-[#060A12] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsScissorsActive(!isScissorsActive)
                        if (!isScissorsActive) {
                          alert("Scissors Tool Active: Click a historical timestamp on the Lightweight chart timeline to crop the replay boundary!")
                          if (ltfChartInstance.current) {
                            const handler = (param: any) => {
                              if (param.time) {
                                const clickedTime = param.time
                                // Seek candle list
                                const idx = ltfCandles.findIndex(c => c.time === clickedTime)
                                if (idx !== -1) {
                                  setLtfCandles(prev => prev.slice(0, idx + 1))
                                  setIsScissorsActive(false)
                                  ltfChartInstance.current.unsubscribeClick(handler)
                                }
                              }
                            }
                            ltfChartInstance.current.subscribeClick(handler)
                          }
                        }
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all cursor-pointer",
                        isScissorsActive 
                          ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" 
                          : "bg-[#0D1421] border-white/5 hover:border-white/10 text-white"
                      )}
                      title="Scissors: Cut timeline at clicked candle point"
                    >
                      <Scissors className="w-4 h-4" />
                    </button>

                    <div className="w-[1px] h-6 bg-white/10 mx-1" />

                    <button
                      onClick={() => {
                        // Truncate last candle for stepping backward locally
                        if (ltfCandles.length > 5) {
                          setIsPlaying(false)
                          setLtfCandles(prev => prev.slice(0, -1))
                          if (ltfCandles.length > 1) {
                            setCurrentCandle(ltfCandles[ltfCandles.length - 2])
                          }
                        }
                      }}
                      className="p-2.5 bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-xl text-white transition-all active:scale-95 cursor-pointer text-xs font-bold"
                      title="Step candle backward (Local view)"
                    >
                      ◀ Step
                    </button>
                    
                    <button
                      onClick={handlePlayToggle}
                      className="p-2.5 bg-primary text-black rounded-xl hover:bg-primary/95 transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center"
                      title={isPlaying ? "Pause Stream" : "Start Live Stream"}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-black" />}
                    </button>

                    <button
                      onClick={handleStepForward}
                      className="p-2.5 bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-xl text-white transition-all active:scale-95 cursor-pointer text-xs font-bold"
                      title="Step candle forward (VPS DB check)"
                    >
                      Step ▶
                    </button>
                  </div>

                  {/* speed slider */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest">Replay Speed</span>
                    <input
                      type="range"
                      min="1"
                      max="40"
                      step="1"
                      value={playSpeed}
                      onChange={e => handleSpeedChange(Number(e.target.value))}
                      className="w-32 bg-[#0D1421] accent-primary rounded-lg cursor-pointer h-1.5 border border-white/5"
                    />
                    <span className="text-[9px] font-mono text-white bg-white/5 px-2 py-0.5 rounded font-bold">
                      {playSpeed}x/s
                    </span>
                  </div>

                  {/* Price info */}
                  <div className="text-right text-[10px] font-medium leading-normal text-[#64748B]">
                    <div className="font-bold text-white uppercase flex items-center gap-1.5 justify-end">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                      Price: ${currentAssetPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div>Candles replayed: {ltfCandles.length}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Broker Execution Panel (1 Col) */}
            <div className="xl:col-span-1 space-y-6">
              <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-5 relative">
                <h2 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2.5 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" /> Replay Broker
                </h2>

                {/* Account details card */}
                <div className="bg-[#060A12] border border-white/5 rounded-2xl p-4 text-center shadow-inner">
                  <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest">Virtual Account Balance</p>
                  <h3 className="text-xl font-black text-white mt-1 font-mono">
                    ${accountBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h3>
                  <div className="flex items-center justify-between text-[10px] mt-3 pt-3 border-t border-white/5 text-[#64748B]">
                    <span>Floating P&L:</span>
                    <span className={cn("font-bold font-mono", runningPnl >= 0 ? "text-[#10B981]" : "text-[#EF4444]")}>
                      {activePosition ? (runningPnl >= 0 ? `+$${runningPnl.toFixed(2)}` : `-$${Math.abs(runningPnl).toFixed(2)}`) : "$0.00"}
                    </span>
                  </div>
                </div>

                {/* Position toggles */}
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => executePlaceOrder('buy')}
                      disabled={!!activePosition}
                      className="py-3 bg-emerald-500/10 hover:bg-emerald-500 disabled:bg-[#060A12] border border-emerald-500/20 disabled:border-white/5 text-emerald-400 hover:text-black disabled:text-[#334155] font-bold text-xs rounded-xl tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" /> BUY / LONG
                    </button>
                    <button
                      onClick={() => executePlaceOrder('sell')}
                      disabled={!!activePosition}
                      className="py-3 bg-red-500/10 hover:bg-red-500 disabled:bg-[#060A12] border border-red-500/20 disabled:border-white/5 text-red-400 hover:text-black disabled:text-[#334155] font-bold text-xs rounded-xl tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <TrendingDown className="w-3.5 h-3.5 shrink-0" /> SELL / SHORT
                    </button>
                  </div>

                  {activePosition && (
                    <button
                      onClick={executeCloseTrade}
                      className="w-full py-3 bg-red-500/15 hover:bg-red-500 border border-red-500/30 text-red-400 hover:text-black text-xs font-black rounded-xl tracking-wider transition-all active:scale-95 cursor-pointer"
                    >
                      MANUALLY CLOSE POSITION
                    </button>
                  )}
                </div>

                {/* Inputs block */}
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

                {!activePosition && (
                  <div className="p-3 bg-white/2 border border-white/5 rounded-xl flex gap-2.5 items-start text-[10px] text-[#64748B] leading-relaxed">
                    <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>
                      <strong>Replay Protection:</strong> SL and TP targets are simulated in 1-minute real-time on your VPS, closing trades automatically on key triggers.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- JOURNAL LOGS & PERFORMANCE STATS (Only displays if session is active) --- */}
      {sessionId && (
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
                  <h3 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-primary" /> Active Session Replay Logs (VPS Journal)
                  </h3>
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
                            <td className="py-3.5 px-3 font-mono font-bold text-[#94A3B8]">{t.entryPrice.toFixed(2)}</td>
                            <td className="py-3.5 px-3 font-mono font-bold text-[#94A3B8]">
                              {t.exitPrice ? t.exitPrice.toFixed(2) : "—"}
                            </td>
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
                            No trades backtested in this session yet. Take long or short positions above to simulate trades!
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
                {/* Stats cards */}
                <div className="lg:col-span-1 bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase text-[#64748B] tracking-wider border-b border-white/5 pb-2 mb-4">Edge analytics parameters</h3>
                    
                    <div className="space-y-4 text-xs font-semibold">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Total Executions:</span>
                        <span className="text-white font-bold">{stats.total_trades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Win Rate %:</span>
                        <span className="text-emerald-400 font-bold font-mono">{stats.win_rate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Wins count:</span>
                        <span className="text-emerald-400 font-bold font-mono">{stats.wins} W</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Losses count:</span>
                        <span className="text-red-400 font-bold font-mono">{stats.losses} L</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Profit Factor:</span>
                        <span className="text-primary font-black font-mono">{stats.avg_rr.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-3.5 bg-[#060A12] border border-white/5 rounded-2xl text-center">
                    <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest">Net Realized P&L</p>
                    <h4 className={cn("text-xl font-black mt-1 font-mono", stats.total_pnl >= 0 ? "text-[#34D399]" : "text-[#F87171]")}>
                      {stats.total_pnl >= 0 ? `+$${stats.total_pnl.toFixed(2)}` : `-$${Math.abs(stats.total_pnl).toFixed(2)}`}
                    </h4>
                  </div>
                </div>

                {/* Equity Curve Chart */}
                <div className="lg:col-span-2 bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4">
                  <h3 className="text-xs font-black uppercase text-[#64748B] tracking-wider border-b border-white/5 pb-2">Compounding Equity growth curve</h3>
                  
                  {tradesHistory.length === 0 ? (
                    <div className="h-48 border border-dashed border-white/5 rounded-2xl flex items-center justify-center text-xs text-[#334155] italic">
                      Backtest trades first to plot compounding account balance curves.
                    </div>
                  ) : (
                    <div className="h-56 w-full text-[9px] font-mono">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={equityCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
      )}

    </div>
  )
}
