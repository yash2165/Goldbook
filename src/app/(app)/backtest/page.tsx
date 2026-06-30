'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Play, Pause, Plus, Trash2, Scissors, Sparkles, TrendingUp,
  TrendingDown, Target, Clock, ShieldAlert, Award, RefreshCw,
  X, Check, Edit2, Layers, HelpCircle, ChevronRight, Activity, FileSpreadsheet,
  Calculator, Settings, Globe, PlayCircle, BarChart3, Database,
  Move, PenTool, Type, Ruler, Compass, Trash, LogOut, Calendar, DollarSign,
  Brain
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

interface ActiveSession {
  id: number
  symbol: string
  start_date: string
  initial_balance: number
  current_balance: number
  timeframe: string
  status: string
  current_timestamp: string | null
  last_accessed_at: string
}

export default function BacktestReplayPage() {
  const supabase = createClient()

  const [userTier, setUserTier] = useState<'free' | 'paid' | 'pro' | null>(null)
  const [loadingTier, setLoadingTier] = useState(true)

  const [isMounted, setIsMounted] = useState(false)
  const [symbol, setSymbol] = useState<'XAUUSD' | 'BANKNIFTY'>('XAUUSD')
  const [timeframe, setTimeframe] = useState<string>('5m')
  const [layoutMode, setLayoutMode] = useState<'single' | 'split'>('split')
  
  // VPS API Server host (hardcoded silently for public excellence!)
  const apiUrl = 'goldbook-backtest.ddnsfree.com'
  
  // Active Sessions State (TradersCasa Style)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  
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
  
  // Vertical Drawing Tools active selection
  const [activeDrawingTool, setActiveDrawingTool] = useState<string>('cursor')
  
  // Custom persistent drawings & canvas state
  const [drawings, setDrawings] = useState<any[]>([])
  const [isDrawingActive, setIsDrawingActive] = useState(false)
  const [activeShapeId, setActiveShapeId] = useState<string | null>(null)
  
  // Technical Indicator Toggles
  const [showEma20, setShowEma20] = useState(false)
  const [showEma50, setShowEma50] = useState(false)
  const [showEma200, setShowEma200] = useState(false)
  const [showRsi, setShowRsi] = useState(false)
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false)
  
  // DOM & Series Refs for custom overlays
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingsRef = useRef<any[]>([])
  const rsiChartRef = useRef<HTMLDivElement>(null)
  const rsiChartInstance = useRef<any>(null)
  const rsiLineSeries = useRef<any>(null)
  const ltfEma20Series = useRef<any>(null)
  const ltfEma50Series = useRef<any>(null)
  const ltfEma200Series = useRef<any>(null)
  
  // Keep drawingsRef synchronized with drawings state to prevent stale closures in event listeners
  useEffect(() => {
    drawingsRef.current = drawings
  }, [drawings])

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

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleRazorpayCheckout = async (tierName: 'paid' | 'pro', amount: number) => {
    const loaded = await loadRazorpayScript()
    if (!loaded) {
      alert('Failed to load Razorpay SDK. Please check your internet connection.')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in to upgrade your plan.')
        return
      }

      const options = {
        key: 'rzp_test_Sv9GJ0OEOAIjVO',
        amount: amount * 100, // Amount in paise
        currency: 'INR',
        name: 'GoldBook',
        description: `Upgrade to ${tierName === 'paid' ? 'The Automated Trader' : 'The Elite Professional'}`,
        image: 'https://goldbook-roan.vercel.app/logo.png',
        handler: async function (response: any) {
          try {
            // Update Supabase profile directly on success
            const { error: dbErr } = await supabase
              .from('profiles')
              .update({ tier: tierName })
              .eq('id', user.id)

            if (dbErr) throw dbErr

            alert(`Payment Successful! Your account has been upgraded to ${tierName === 'paid' ? 'Paid' : 'Pro'} tier.`)
            window.location.reload()
          } catch (err: any) {
            alert('Payment was successful (Payment ID: ' + response.razorpay_payment_id + '), but your profile update failed. Please contact support.')
          }
        },
        prefill: {
          email: user.email || '',
        },
        theme: {
          color: tierName === 'pro' ? '#F59E0B' : '#3B82F6',
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (err: any) {
      console.error(err)
      alert('Error initializing checkout. Please try again.')
    }
  }

  useEffect(() => {
    async function loadUserTier() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('tier')
            .eq('id', user.id)
            .single()
          
          if (data && data.tier) {
            setUserTier(data.tier as any)
          } else {
            setUserTier('free')
          }
        }
      } catch (err) {
        setUserTier('free')
      } finally {
        // Force tier to 'pro' to bypass restrictions and make the website free
        setUserTier('pro')
        setLoadingTier(false)
      }
    }
    loadUserTier()
  }, [])
  
  if (loadingTier) {
    return (
      <div className="p-6 max-w-full mx-auto space-y-6 min-h-[60vh] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
          <div className="absolute inset-0 rounded-full border border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-[#64748B] text-xs font-mono animate-pulse">Authenticating behavioral tier...</p>
      </div>
    )
  }

  if (userTier !== 'pro') {
    return (
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-12 min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Premium Gating Card */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-30 pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#0D1421] border border-white/5 rounded-3xl p-6 text-center space-y-4 shadow-2xl backdrop-blur-md relative z-10"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] mx-auto shadow-[0_0_20px_rgba(245,159,11,0.15)] animate-pulse">
            <Brain className="w-7 h-7 stroke-[1.5]" />
          </div>
          
          <div className="space-y-1.5">
            <span className="text-[9px] bg-[#F59E0B] text-black font-black uppercase px-2.5 py-0.5 rounded font-mono tracking-wider">
              ELITE PRO FEATURE
            </span>
            <h2 className="text-lg font-black text-white uppercase tracking-wider mt-2.5">Visual Replay Backtester</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              The high-fidelity TradingView visual replay simulation terminal is an Elite Pro feature. Upgrade to Pro below to unlock tick-by-tick charting rollbacks and compound backtesting simulation!
            </p>
          </div>
        </motion.div>

        {/* Stunning 3-Tier Modern Pricing Plans Grid */}
        <div className="w-full space-y-6 relative z-10">
          <div className="text-center space-y-1">
            <h2 className="text-sm font-black uppercase text-white tracking-widest">Select Your Professional Edge</h2>
            <p className="text-xs text-[#64748B]">Unlock automated systems, deep behavioral psychology, and priority cloud execution.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1000px] mx-auto">
            
            {/* Free Plan */}
            <div className="bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#64748B]">Free forever</h3>
                  <h4 className="text-sm font-black text-white">The Accountable Trader</h4>
                  <div className="text-2xl font-black text-white mt-1">$0 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited manual journaling</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Full TradingView charts suite</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Complete stats & metrics grids</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Public community & leaderboards</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No background MT5 auto-sync</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No AI Psychology audits & chat</p>
                </div>
              </div>
              <button disabled className="mt-6 w-full py-3 bg-white/5 text-[#64748B] font-black text-xs uppercase tracking-wider rounded-xl cursor-not-allowed">
                {userTier === 'free' ? 'Current Plan' : 'Standard'}
              </button>
            </div>

            {/* Paid Plan */}
            <div className="bg-[#0D1421] border border-[#3B82F6]/10 hover:border-[#3B82F6]/30 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#3B82F6]/5 rounded-full blur-2xl group-hover:bg-[#3B82F6]/10 transition-all pointer-events-none" />
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#3B82F6]">Automated Sync</h3>
                  <h4 className="text-sm font-black text-white font-bold">The Automated Trader</h4>
                  <div className="text-2xl font-black text-white mt-1">$9 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">1 Active MT5 Account Sync</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited active journal history</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Standard analytical drawdowns grid</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Weekly/Monthly static AI reports</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Custom templates & habit logs</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No Conversational AI coaching chat</p>
                </div>
              </div>
              {userTier === 'paid' ? (
                <button disabled className="mt-6 w-full py-3 bg-blue-500/20 text-[#3B82F6] font-black text-xs uppercase tracking-wider rounded-xl cursor-not-allowed">
                  Current Plan
                </button>
              ) : (
                <button 
                  onClick={() => handleRazorpayCheckout('paid', 750)} 
                  className="mt-6 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  Select Plan
                </button>
              )}
            </div>

            {/* Pro Plan */}
            <div className="bg-[#0D1421] border border-[#F59E0B]/20 hover:border-[#F59E0B]/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B]/10 rounded-full blur-2xl group-hover:bg-[#F59E0B]/15 transition-all pointer-events-none" />
              <div className="absolute -right-12 -top-12 w-24 h-24 bg-[#F59E0B] text-black font-black uppercase text-[8px] flex items-center justify-center rotate-45 tracking-widest pt-12 shadow-lg animate-pulse">
                Ultimate
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#F59E0B]">Nirikshan Pro</h3>
                  <h4 className="text-sm font-black text-white font-bold">The Elite Professional</h4>
                  <div className="text-2xl font-black text-white mt-1">$29 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">Unlimited MT5 Accounts Sync</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">Nirikshan Conversational AI Chat</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> AI Cognitive bias threat heatmaps</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Visual Replay Backtest (Scissors)</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Priority sandbox processing</p>
                </div>
              </div>
              <button 
                onClick={() => handleRazorpayCheckout('pro', 2400)} 
                className="mt-6 w-full py-3 bg-primary hover:bg-primary/95 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-primary/10"
              >
                Select Plan
              </button>
            </div>

          </div>
        </div>
      </div>
    )
  }

  const showComingSoon = true // Gated for major upgrades
  if (showComingSoon) {
    return (
      <div className="p-6 max-w-full mx-auto space-y-6 min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Premium Glassmorphism Coming Soon Card */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-30 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/5 rounded-full blur-3xl opacity-20 pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-md w-full bg-[#0D1421] border border-white/5 rounded-3xl p-8 text-center space-y-6 shadow-2xl backdrop-blur-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto shadow-[0_0_20px_rgba(245,159,11,0.15)] animate-pulse">
            <PlayCircle className="w-8 h-8 stroke-[1.5]" />
          </div>
          
          <div className="space-y-2">
            <span className="text-[10px] bg-primary text-black font-black uppercase px-2.5 py-1 rounded-lg tracking-wider">
              FEATURE GATED
            </span>
            <h2 className="text-xl font-black text-white uppercase tracking-wider mt-3">Visual Backtester</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              The high-fidelity TradingView visual replay simulation terminal is currently undergoing core upgrades to integrate the advanced native TradingView terminal.
            </p>
          </div>

          <div className="bg-[#060A12]/80 border border-white/5 rounded-2xl p-4 text-left">
            <div className="flex items-center gap-2 text-xs text-white font-bold mb-1">
              <Clock className="w-3.5 h-3.5 text-primary" /> ETA: Next Release
            </div>
            <p className="text-[10px] text-[#64748B] leading-normal font-medium">
              This module will release with the fully integrated TradingView charting suite, drag-and-drop order tickets directly on charts, and automatic journal sync.
            </p>
          </div>

          <Link 
            href="/dashboard"
            className="block w-full py-3.5 bg-primary hover:bg-primary/95 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 text-center cursor-pointer"
          >
            Return to Dashboard
          </Link>
        </motion.div>
      </div>
    )
  }



  // 2. Load Active Sessions from database on mount
  const fetchActiveSessions = async () => {
    setIsLoadingSessions(true)
    try {
      const res = await fetch(`https://${apiUrl}/api/sessions/active`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setActiveSessions(data)
      }
    } catch (err) {
      console.warn("Failed to load active backtest sessions:", err)
    } finally {
      setIsLoadingSessions(false)
    }
  }

  useEffect(() => {
    if (isMounted) {
      fetchActiveSessions()
    }
  }, [isMounted])

  // 3. Fetch available dataset dates when symbol is changed
  useEffect(() => {
    if (!isMounted) return
    
    const fetchDates = async () => {
      try {
        const res = await fetch(`https://${apiUrl}/api/candles/available-dates?symbol=${symbol}`)
        const data = await res.json()
        if (data.from && data.to) {
          setAvailableDates({ from: data.from, to: data.to })
          setSessionStartDate(data.from)
        }
      } catch (err) {
        console.warn("Could not fetch database available dates:", err)
      }
    }
    
    fetchDates()
  }, [symbol, isMounted])

  // 4. Synthesize Higher Timeframe (H1) candles dynamically from accumulated LTF (M5/M15) candles
  useEffect(() => {
    if (ltfCandles.length === 0) return
    
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

  // 4a. Math calculations for standard Technical Indicators (EMA & RSI)
  const calculateEMA = (data: any[], period: number) => {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    let emaVal = data[0].close;
    const emaData = [{ time: data[0].time, value: emaVal }];
    
    for (let i = 1; i < data.length; i++) {
      emaVal = data[i].close * k + emaVal * (1 - k);
      emaData.push({ time: data[i].time, value: Number(emaVal.toFixed(4)) });
    }
    return emaData;
  };

  const calculateRSI = (data: any[], period: number = 14) => {
    if (data.length < period + 1) return [];
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    const rsiData = [];
    
    for (let i = 0; i < period; i++) {
      rsiData.push({ time: data[i].time, value: 50.0 });
    }
    
    const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiData.push({ time: data[period].time, value: Number((100 - (100 / (1 + firstRS))).toFixed(2)) });
    
    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsiVal = 100 - (100 / (1 + rs));
      rsiData.push({ time: data[i].time, value: Number(rsiVal.toFixed(2)) });
    }
    return rsiData;
  };

  // Debounced API call to save drawings state to PostgreSQL on the VPS
  const saveDrawingsDebounced = useRef<any>(null);
  const triggerAutosaveDrawings = (currentDrawings: any[], currentIndicators: any) => {
    if (saveDrawingsDebounced.current) clearTimeout(saveDrawingsDebounced.current);
    
    saveDrawingsDebounced.current = setTimeout(async () => {
      if (!sessionId) return;
      try {
        await fetch(`https://${apiUrl}/api/sessions/${sessionId}/drawings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drawings_state: currentDrawings,
            indicator_settings: currentIndicators
          })
        });
        console.log("Drawings and indicator settings auto-saved to database.");
      } catch (err) {
        console.warn("Failed to auto-save drawings state:", err);
      }
    }, 1000); // 1 second debounce
  };

  // 4b. Draw drawings list onto Canvas Overlay mapped to Lightweight Charts coordinate space
  const drawAllShapes = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ltfChartInstance.current || !ltfCandleSeries.current) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Resize canvas dynamically to match current visible size of chart
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const timeScale = ltfChartInstance.current.timeScale();
    const series = ltfCandleSeries.current;
    const currentDrawings = drawingsRef.current || [];
    
    currentDrawings.forEach(shape => {
      if (!shape.points || shape.points.length === 0) return;
      
      // Convert points to screen coordinates
      const pt1 = shape.points[0];
      const x1 = timeScale.timeToCoordinate(pt1.time);
      const y1 = series.priceToCoordinate(pt1.price);
      
      if (x1 === null || y1 === null) return;
      
      ctx.strokeStyle = shape.color || '#38BDF8';
      ctx.lineWidth = shape.lineWidth || 2;
      ctx.fillStyle = (shape.color || '#38BDF8') + '15'; // transparent fill
      
      if (shape.type === 'trendline' && shape.points.length > 1) {
        const pt2 = shape.points[1];
        const x2 = timeScale.timeToCoordinate(pt2.time);
        const y2 = series.priceToCoordinate(pt2.price);
        
        if (x2 !== null && y2 !== null) {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } else if (shape.type === 'horizontal') {
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.lineTo(canvas.width, y1);
        ctx.stroke();
      } else if (shape.type === 'rectangle' && shape.points.length > 1) {
        const pt2 = shape.points[1];
        const x2 = timeScale.timeToCoordinate(pt2.time);
        const y2 = series.priceToCoordinate(pt2.price);
        
        if (x2 !== null && y2 !== null) {
          ctx.beginPath();
          ctx.rect(x1, y1, x2 - x1, y2 - y1);
          ctx.fill();
          ctx.stroke();
        }
      } else if (shape.type === 'ruler' && shape.points.length > 1) {
        const pt2 = shape.points[1];
        const x2 = timeScale.timeToCoordinate(pt2.time);
        const y2 = series.priceToCoordinate(pt2.price);
        
        if (x2 !== null && y2 !== null) {
          // Shaded measurement box
          ctx.beginPath();
          ctx.rect(x1, y1, x2 - x1, y2 - y1);
          ctx.fill();
          ctx.stroke();
          
          const priceDiff = pt2.price - pt1.price;
          const pips = (priceDiff * (symbol === 'XAUUSD' ? 10.0 : 1.0)).toFixed(1);
          const pct = ((priceDiff / pt1.price) * 100).toFixed(2);
          
          // Shaded tooltip label
          ctx.fillStyle = '#060A12';
          ctx.strokeStyle = shape.color || '#38BDF8';
          ctx.lineWidth = 1;
          ctx.fillRect(x2 + 8, y2 - 25, 95, 34);
          ctx.strokeRect(x2 + 8, y2 - 25, 95, 34);
          
          ctx.fillStyle = '#E2E8F0';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`Pips : ${pips}`, x2 + 14, y2 - 14);
          ctx.fillStyle = priceDiff >= 0 ? '#34D399' : '#F87171';
          ctx.fillText(`P&L  : ${priceDiff >= 0 ? '+' : ''}${pct}%`, x2 + 14, y2 - 3);
        }
      }
    });
  };

  // 4c. Interactive drawings mouse events
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeDrawingTool === 'cursor' || !ltfChartInstance.current || !ltfCandleSeries.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const time = ltfChartInstance.current.timeScale().coordinateToTime(mouseX);
    const price = ltfCandleSeries.current.coordinateToPrice(mouseY);
    
    if (!time || !price) return;
    
    if (activeDrawingTool === 'horizontal') {
      const newShape = {
        id: Math.random().toString(36).substring(7),
        type: 'horizontal',
        points: [{ time, price }],
        color: '#EF4444',
        lineWidth: 1.5
      };
      setDrawings(prev => {
        const next = [...prev, newShape];
        triggerAutosaveDrawings(next, { showEma20, showEma50, showEma200, showRsi });
        return next;
      });
      setActiveDrawingTool('cursor');
    } else {
      const newShape = {
        id: Math.random().toString(36).substring(7),
        type: activeDrawingTool,
        points: [{ time, price }, { time, price }],
        color: activeDrawingTool === 'ruler' ? '#F59E0B' : '#38BDF8',
        lineWidth: 2
      };
      setIsDrawingActive(true);
      setActiveShapeId(newShape.id);
      setDrawings(prev => [...prev, newShape]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingActive || !activeShapeId || !ltfChartInstance.current || !ltfCandleSeries.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const time = ltfChartInstance.current.timeScale().coordinateToTime(mouseX);
    const price = ltfCandleSeries.current.coordinateToPrice(mouseY);
    
    if (!time || !price) return;
    
    setDrawings(prev => prev.map(shape => {
      if (shape.id === activeShapeId) {
        return {
          ...shape,
          points: [shape.points[0], { time, price }]
        };
      }
      return shape;
    }));
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingActive) return;
    setIsDrawingActive(false);
    setActiveShapeId(null);
    setActiveDrawingTool('cursor');
    triggerAutosaveDrawings(drawings, { showEma20, showEma50, showEma200, showRsi });
  };

  // 5. Initialize Lightweight Charts (LTF & HTF)
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
          vertLines: { color: 'rgba(30, 58, 95, 0.05)' },
          horzLines: { color: 'rgba(30, 58, 95, 0.05)' },
        },
        rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.03)' },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.03)',
          timeVisible: true,
        },
      })
      ltfCandleSeries.current = ltfChartInstance.current.addCandlestickSeries({
        upColor: '#10B981',
        downColor: '#EF4444',
        borderUpColor: '#10B981',
        borderDownColor: '#EF4444',
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
      })

      // Subscribe to visible range changes to redraw canvas drawings instantly
      ltfChartInstance.current.timeScale().subscribeVisibleLogicalRangeChange(drawAllShapes)
    }

    // Build HTF Chart (1H)
    if (htfChartRef.current && !htfChartInstance.current && layoutMode === 'split') {
      htfChartInstance.current = createChart(htfChartRef.current, {
        layout: {
          background: { color: '#060A12' },
          textColor: '#64748B',
        },
        grid: {
          vertLines: { color: 'rgba(30, 58, 95, 0.05)' },
          horzLines: { color: 'rgba(30, 58, 95, 0.05)' },
        },
        rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.03)' },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.03)',
          timeVisible: true,
        },
      })
      htfCandleSeries.current = htfChartInstance.current.addCandlestickSeries({
        upColor: 'rgba(16, 185, 129, 0.5)',
        downColor: 'rgba(239, 68, 68, 0.5)',
        borderUpColor: 'rgba(16, 185, 129, 0.5)',
        borderDownColor: 'rgba(239, 68, 68, 0.5)',
        wickUpColor: 'rgba(16, 185, 129, 0.5)',
        wickDownColor: 'rgba(239, 68, 68, 0.5)',
      })
    }

    // Load initial sets
    if (ltfCandleSeries.current && ltfCandles.length > 0) {
      ltfCandleSeries.current.setData(ltfCandles)
    }
    
    if (htfCandleSeries.current && layoutMode === 'split' && htfCandles.length > 0) {
      htfCandleSeries.current.setData(htfCandles)
    }

    // --- Dynamic Technical Indicator Overlays ---
    if (ltfChartInstance.current) {
      // EMA 20 Overlay
      if (showEma20 && ltfCandles.length > 20) {
        if (!ltfEma20Series.current) {
          ltfEma20Series.current = ltfChartInstance.current.addLineSeries({
            color: '#38BDF8', // Cyan
            lineWidth: 1.5,
            title: 'EMA 20'
          })
        }
        ltfEma20Series.current.setData(calculateEMA(ltfCandles, 20))
      } else if (!showEma20 && ltfEma20Series.current) {
        ltfChartInstance.current.removeSeries(ltfEma20Series.current)
        ltfEma20Series.current = null
      }

      // EMA 50 Overlay
      if (showEma50 && ltfCandles.length > 50) {
        if (!ltfEma50Series.current) {
          ltfEma50Series.current = ltfChartInstance.current.addLineSeries({
            color: '#F59E0B', // Amber
            lineWidth: 1.5,
            title: 'EMA 50'
          })
        }
        ltfEma50Series.current.setData(calculateEMA(ltfCandles, 50))
      } else if (!showEma50 && ltfEma50Series.current) {
        ltfChartInstance.current.removeSeries(ltfEma50Series.current)
        ltfEma50Series.current = null
      }

      // EMA 200 Overlay
      if (showEma200 && ltfCandles.length > 200) {
        if (!ltfEma200Series.current) {
          ltfEma200Series.current = ltfChartInstance.current.addLineSeries({
            color: '#EC4899', // Pink
            lineWidth: 1.5,
            title: 'EMA 200'
          })
        }
        ltfEma200Series.current.setData(calculateEMA(ltfCandles, 200))
      } else if (!showEma200 && ltfEma200Series.current) {
        ltfChartInstance.current.removeSeries(ltfEma200Series.current)
        ltfEma200Series.current = null
      }
    }

    // --- Dynamic RSI Sub-Pane Chart ---
    if (showRsi && rsiChartRef.current && ltfChartInstance.current) {
      if (!rsiChartInstance.current) {
        rsiChartInstance.current = createChart(rsiChartRef.current, {
          layout: {
            background: { color: '#060A12' },
            textColor: '#64748B',
          },
          grid: {
            vertLines: { color: 'rgba(30, 58, 95, 0.03)' },
            horzLines: { color: 'rgba(30, 58, 95, 0.03)' },
          },
          rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.03)' },
          timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.03)',
            timeVisible: true,
          },
          height: 120
        })

        // Constant oversold/overbought lines (30/70)
        const rsiOversold = rsiChartInstance.current.addLineSeries({
          color: 'rgba(239, 68, 68, 0.25)', // red
          lineWidth: 1,
          lineStyle: 2,
        })
        const rsiOverbought = rsiChartInstance.current.addLineSeries({
          color: 'rgba(16, 185, 129, 0.25)', // green
          lineWidth: 1,
          lineStyle: 2,
        })

        const rsiBounds = ltfCandles.map(c => ({ time: c.time, value: 30 }))
        const rsiOverboughtBounds = ltfCandles.map(c => ({ time: c.time, value: 70 }))
        
        rsiOversold.setData(rsiBounds)
        rsiOverbought.setData(rsiOverboughtBounds)

        rsiLineSeries.current = rsiChartInstance.current.addLineSeries({
          color: '#A855F7', // Purple
          lineWidth: 1.5,
          title: 'RSI (14)'
        })

        // Sync timescale scrolling between LTF chart and RSI sub-pane
        ltfChartInstance.current.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
          if (rsiChartInstance.current && range) {
            rsiChartInstance.current.timeScale().setVisibleLogicalRange(range)
          }
        })
      }

      if (rsiLineSeries.current && ltfCandles.length > 14) {
        rsiLineSeries.current.setData(calculateRSI(ltfCandles, 14))
      }
    } else if (!showRsi && rsiChartInstance.current) {
      rsiChartInstance.current.remove()
      rsiChartInstance.current = null
      rsiLineSeries.current = null
    }

    // Trigger canvas redraw on initial render / load
    setTimeout(drawAllShapes, 100)

  }, [isMounted, ltfCandles, htfCandles, layoutMode, sessionId, showEma20, showEma50, showEma200, showRsi])

  // Chart Resize syncing
  useEffect(() => {
    const width = ltfChartRef.current?.clientWidth || 600
    if (ltfChartInstance.current) {
      ltfChartInstance.current.resize(
        width,
        layoutMode === 'split' ? 320 : 450
      )
    }
    if (htfChartInstance.current && layoutMode === 'split') {
      htfChartInstance.current.resize(
        htfChartRef.current?.clientWidth || 600,
        320
      )
    }
    if (rsiChartInstance.current) {
      rsiChartInstance.current.resize(
        width,
        120
      )
    }
    // Redraw canvas drawings to match new bounding boxes
    setTimeout(drawAllShapes, 50)
  }, [layoutMode, ltfCandles, showRsi])

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

  // 6. Draw Stop Loss (SL) & Take Profit (TP) lines on the chart
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
    
    try {
      // 1. Create Session in VPS database
      const startRes = await fetch(`https://${apiUrl}/api/sessions/start`, {
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
      setIsCreateModalOpen(false)

      // 2. Fetch Historical candles preceding start date (Initial render)
      const histRes = await fetch(
        `https://${apiUrl}/api/candles/history?symbol=${symbol}&start_date=${sessionStartDate}&timeframe=${timeframe}&limit=200`
      )
      const historicalCandles = await histRes.json()
      
      if (historicalCandles && historicalCandles.length > 0) {
        setLtfCandles(historicalCandles)
        setCurrentCandle(historicalCandles[historicalCandles.length - 1])
      }

      // 3. Establish WebSocket connection for real-time candle streaming
      startWebSocket(activeSessId)
      
    } catch (err: any) {
      alert(`Connection Error: Make sure your VPS setup script is completed.\n\nDetail: ${err.message}`)
    } finally {
      setIsStartingSession(false)
    }
  }

  // --- PERSISTENCE: Resume Active Session in one-click ---
  const handleResumeSession = async (session: ActiveSession) => {
    setSessionId(session.id)
    setSymbol(session.symbol as 'XAUUSD' | 'BANKNIFTY')
    setTimeframe(session.timeframe)
    setInitialBalance(session.initial_balance)
    setAccountBalance(session.current_balance)
    
    try {
      // 1. Fetch full session details (restores drawings & indicator workspace state)
      const detailsRes = await fetch(`https://${apiUrl}/api/sessions/${session.id}`)
      const details = await detailsRes.json()
      if (details.drawings_state) {
        setDrawings(details.drawings_state)
      }
      if (details.indicator_settings) {
        const ind = details.indicator_settings
        setShowEma20(!!ind.showEma20)
        setShowEma50(!!ind.showEma50)
        setShowEma200(!!ind.showEma200)
        setShowRsi(!!ind.showRsi)
      }

      // Fetch history leading up to the session's current timestamp (restores workspace state!)
      const histRes = await fetch(
        `https://${apiUrl}/api/candles/history?symbol=${session.symbol}&start_date=${session.start_date}&timeframe=${session.timeframe}&limit=200&session_id=${session.id}`
      )
      const historicalCandles = await histRes.json()
      
      if (historicalCandles && historicalCandles.length > 0) {
        setLtfCandles(historicalCandles)
        setCurrentCandle(historicalCandles[historicalCandles.length - 1])
      }

      // Open WebSocket starting from the saved progress
      startWebSocket(session.id)
    } catch (err) {
      alert("Failed to resume session. Verify your VPS server is online.")
    }
  }

  // --- PERSISTENCE: Terminate Session (Complete/Archive) ---
  const handleTerminateSession = async (id: number) => {
    if (!confirm("Are you sure you want to permanently close and archive this session? Your balance and trades will be finalized.")) return
    
    try {
      const res = await fetch(`https://${apiUrl}/api/sessions/close/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (res.ok) {
        fetchActiveSessions()
      }
    } catch (err) {
      alert("Failed to close session.")
    }
  }

  // --- PERSISTENCE: Delete Session (Delete completely) ---
  const handleDeleteSession = async (id: number) => {
    if (!confirm("Are you sure you want to delete this session? This will wipe all its trades and history.")) return
    
    try {
      const res = await fetch(`https://${apiUrl}/api/sessions/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchActiveSessions()
      }
    } catch (err) {
      alert("Failed to delete session.")
    }
  }

  // 8. WebSocket stream connector
  const startWebSocket = (activeSessId: number) => {
    if (wsRef.current) wsRef.current.close()

    const ws = new WebSocket(
      `wss://${apiUrl}/api/candles/replay?symbol=${symbol}&start_date=${sessionStartDate}&timeframe=${timeframe}&session_id=${activeSessId}&speed=${playSpeed}`
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
        setActivePosition(null)
        
        // Confetti for wins!
        if (data.pnl > 0) {
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.65 },
            colors: ['#F59E0B', '#10B981', '#ffffff']
          })
        }
        
        // Sync trade log to Supabase Cloud
        syncClosedTradeToCloud(data.trade_id, data.exit_price, data.pnl, data.reason, new Date(data.time * 1000).toISOString())
        fetchJournalLogs(activeSessId)
      }

      if (data.type === "end") {
        setIsPlaying(false)
        alert("Replay dataset completed! No more 1-minute historical data past this range.")
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
      const res = await fetch(`https://${apiUrl}/api/trades/journal/${activeSessId}`)
      const data = await res.json()
      
      if (data.trades) {
        setTradesHistory(data.trades)
        setStats(data.stats)
      }
      
      // Update running account balance
      const sessRes = await fetch(`https://${apiUrl}/api/sessions/${activeSessId}`)
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

    try {
      const res = await fetch(`https://${apiUrl}/api/trades/open`, {
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

    try {
      const res = await fetch(`https://${apiUrl}/api/trades/close`, {
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

  // Exit Session (Graceful disconnect back to dashboard)
  const handleExitSession = () => {
    if (wsRef.current) wsRef.current.close()
    
    // Clear memory states to return to dashboard
    setSessionId(null)
    setLtfCandles([])
    setHtfCandles([])
    setCurrentCandle(null)
    setTradesHistory([])
    setActivePosition(null)
    setIsPlaying(false)
    
    // Reload active sessions list
    fetchActiveSessions()
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
    <div className="p-6 max-w-full mx-auto space-y-6">
      
      {/* 1. Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/5 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(245,159,11,0.15)]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Visual Replay Backtester <span className="text-[10px] bg-primary text-black font-black uppercase px-2 py-0.5 rounded">SIMULATOR</span>
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">Simulate high-fidelity trade execution, test strategy edge, and auto-journal performance in real-time.</p>
          </div>
        </div>
      </div>

      {/* --- DASHBOARD VIEW (Active Sessions Grid) --- */}
      <AnimatePresence mode="wait">
        {!sessionId ? (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Top metrics bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-inner flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest">Active Workspace Sessions</p>
                  <h3 className="text-2xl font-black text-white mt-1">{activeSessions.length}</h3>
                </div>
                <Database className="w-8 h-8 text-primary/40" />
              </div>
              <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-inner flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest">Selected Asset</p>
                  <h3 className="text-2xl font-black text-white mt-1">XAUUSD Gold</h3>
                </div>
                <Target className="w-8 h-8 text-emerald-500/40" />
              </div>
              <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-inner flex items-center justify-between">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full py-4.5 bg-primary hover:bg-primary/95 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md hover:shadow-primary/5 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 stroke-[3px]" /> Create New Session
                </button>
              </div>
            </div>

            {/* Sessions Title */}
            <div className="border-t border-white/5 pt-6 space-y-4">
              <h2 className="text-sm font-black uppercase text-white tracking-widest">My Active Replay Workspaces</h2>
              
              {isLoadingSessions ? (
                <div className="py-12 text-center text-xs text-[#64748B] flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" /> Loading saved sessions...
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-white/5 rounded-3xl text-xs text-[#64748B] bg-[#0D1421]/20">
                  <PlayCircle className="w-10 h-10 text-[#334155] mx-auto mb-2" />
                  No active backtesting workspaces found. Click <strong className="text-primary cursor-pointer hover:underline" onClick={() => setIsCreateModalOpen(true)}>Create New Session</strong> above to start!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeSessions.map((session) => (
                    <div
                      key={session.id}
                      className="bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-3xl p-5 shadow-2xl space-y-4 flex flex-col justify-between relative transition-all"
                    >
                      <div className="space-y-3">
                        {/* Session header */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider font-mono">
                            {session.symbol}
                          </span>
                          <span className="text-[9px] text-[#64748B] flex items-center gap-1 font-semibold">
                            <Clock className="w-3.5 h-3.5" /> TF: {session.timeframe.toUpperCase()}
                          </span>
                        </div>

                        {/* Middle Info */}
                        <div className="space-y-2 pt-1 font-semibold text-xs text-[#64748B]">
                          <div className="flex justify-between items-center">
                            <span>Started:</span>
                            <span className="text-white font-mono">{session.start_date}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Virtual Balance:</span>
                            <span className="text-white font-mono font-bold">${session.current_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          {session.current_timestamp && (
                            <div className="flex justify-between items-center">
                              <span>Saved Progress:</span>
                              <span className="text-[#38BDF8] font-mono font-bold">{new Date(session.current_timestamp).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer buttons */}
                      <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-white/5">
                        <button
                          onClick={() => handleTerminateSession(session.id)}
                          className="py-2.5 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-black rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                          title="Lock final balance and archive"
                        >
                          Archive
                        </button>
                        <button
                          onClick={() => handleResumeSession(session)}
                          className="py-2.5 bg-primary hover:bg-primary/95 text-black font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          Resume ▶
                        </button>
                      </div>
                      
                      {/* Delete button (Trash bin) */}
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="absolute top-4 right-4 p-1.5 bg-white/0 hover:bg-red-500/10 text-[#334155] hover:text-red-400 rounded-lg transition-all cursor-pointer opacity-0 hover:opacity-100 group-hover:opacity-100"
                        title="Delete Session"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Session Dialog Modal Popup */}
            <AnimatePresence>
              {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-[#0D1421] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-primary" /> Create Backtest Session
                      </h3>
                      <button onClick={() => setIsCreateModalOpen(false)} className="text-[#64748B] hover:text-white cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Symbol Select */}
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

                      {/* Timeframe & balance */}
                      <div className="grid grid-cols-2 gap-4">
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
                          <label className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest block">Starting Balance ($)</label>
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
                            ⚠️ Connecting to database boundaries...
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => setIsCreateModalOpen(false)}
                        className="py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleStartSession}
                        disabled={isStartingSession}
                        className="py-2.5 bg-primary hover:bg-primary/95 text-black font-black text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isStartingSession ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Launching...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3.5 h-3.5" /> Start Workspace
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* --- FULL SCREEN INTERACTIVE WORKSPACE VIEW (TradersCasa Style) --- */
          <motion.div
            key="replay-workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Top Workspace controls bar */}
            <div className="bg-[#0D1421] border border-white/5 rounded-2xl px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs bg-primary/10 border border-primary/20 text-primary font-black px-2.5 py-1 rounded-lg uppercase font-mono tracking-wider">
                  {symbol}
                </span>
                <span className="text-[10px] text-[#64748B] font-bold bg-[#060A12] border border-white/5 px-2.5 py-1 rounded-lg">
                  TIMEFRAME: {timeframe.toUpperCase()}
                </span>
              </div>
              
              <div className="flex items-center gap-3 relative">
                {/* Technical Indicators Dropdown */}
                <button
                  onClick={() => setIsIndicatorsOpen(!isIndicatorsOpen)}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-white/5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Indicators
                </button>
                
                {isIndicatorsOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsIndicatorsOpen(false)} />
                    <div className="absolute right-0 top-10 z-40 bg-[#0D1421] border border-white/10 rounded-2xl p-3 w-52 shadow-2xl flex flex-col gap-2 font-bold text-xs">
                      <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest border-b border-white/5 pb-2 mb-1">Overlay Indicators</p>
                      <label className="flex items-center justify-between text-white hover:bg-white/5 p-1.5 rounded-lg cursor-pointer transition-all">
                        <span>EMA 20</span>
                        <input
                          type="checkbox"
                          checked={showEma20}
                          onChange={() => {
                            setShowEma20(!showEma20)
                            triggerAutosaveDrawings(drawings, { showEma20: !showEma20, showEma50, showEma200, showRsi })
                          }}
                          className="accent-primary"
                        />
                      </label>
                      <label className="flex items-center justify-between text-white hover:bg-white/5 p-1.5 rounded-lg cursor-pointer transition-all">
                        <span>EMA 50</span>
                        <input
                          type="checkbox"
                          checked={showEma50}
                          onChange={() => {
                            setShowEma50(!showEma50)
                            triggerAutosaveDrawings(drawings, { showEma20, showEma50: !showEma50, showEma200, showRsi })
                          }}
                          className="accent-primary"
                        />
                      </label>
                      <label className="flex items-center justify-between text-white hover:bg-white/5 p-1.5 rounded-lg cursor-pointer transition-all">
                        <span>EMA 200</span>
                        <input
                          type="checkbox"
                          checked={showEma200}
                          onChange={() => {
                            setShowEma200(!showEma200)
                            triggerAutosaveDrawings(drawings, { showEma20, showEma50, showEma200: !showEma200, showRsi })
                          }}
                          className="accent-primary"
                        />
                      </label>
                      <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest border-b border-white/5 pb-2 mt-2 mb-1">Oscillators</p>
                      <label className="flex items-center justify-between text-white hover:bg-white/5 p-1.5 rounded-lg cursor-pointer transition-all">
                        <span>RSI 14</span>
                        <input
                          type="checkbox"
                          checked={showRsi}
                          onChange={() => {
                            setShowRsi(!showRsi)
                            triggerAutosaveDrawings(drawings, { showEma20, showEma50, showEma200, showRsi: !showRsi })
                          }}
                          className="accent-primary"
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Left Toolbar + Interactive Replay Chart Split */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 relative">
              
              {/* Left Drawing Tools panel (TradingView Style Left Sidebar) */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-[#060A12]/85 backdrop-blur-md border border-white/10 rounded-2xl p-1.5 flex flex-col gap-3 shadow-2xl">
                <button
                  onClick={() => setActiveDrawingTool('cursor')}
                  className={cn(
                    "p-2 rounded-xl transition-all cursor-pointer hover:bg-white/5",
                    activeDrawingTool === 'cursor' ? "bg-primary/15 text-primary border border-primary/20" : "text-[#64748B]"
                  )}
                  title="Cursor Selector"
                >
                  <Move className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveDrawingTool('trendline')}
                  className={cn(
                    "p-2 rounded-xl transition-all cursor-pointer hover:bg-white/5",
                    activeDrawingTool === 'trendline' ? "bg-primary/15 text-primary border border-primary/20" : "text-[#64748B]"
                  )}
                  title="Draw Trendlines"
                >
                  <PenTool className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveDrawingTool('rectangle')}
                  className={cn(
                    "p-2 rounded-xl transition-all cursor-pointer hover:bg-white/5",
                    activeDrawingTool === 'rectangle' ? "bg-primary/15 text-primary border border-primary/20" : "text-[#64748B]"
                  )}
                  title="Draw Rectangle Boxes"
                >
                  <Compass className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveDrawingTool('ruler')}
                  className={cn(
                    "p-2 rounded-xl transition-all cursor-pointer hover:bg-white/5",
                    activeDrawingTool === 'ruler' ? "bg-primary/15 text-primary border border-primary/20" : "text-[#64748B]"
                  )}
                  title="Measure pips / distance (Ruler)"
                >
                  <Ruler className="w-4 h-4" />
                </button>
                <div className="h-[1px] bg-white/10 mx-1" />
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to permanently clear all drawings from this workspace?")) {
                      setDrawings([])
                      triggerAutosaveDrawings([], { showEma20, showEma50, showEma200, showRsi })
                    }
                  }}
                  className="p-2 rounded-xl text-[#64748B] hover:text-red-400 transition-all cursor-pointer hover:bg-red-500/10"
                  title="Clear Drawings"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>

              {/* Main Replay Chart Area (3 Cols) */}
              <div className="xl:col-span-3 space-y-4">
                <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />

                  {/* Split Display Grid */}
                  <div className={cn("grid gap-4 pl-12", layoutMode === 'split' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                    
                    {/* HTF Trend (1H) */}
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
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[#64748B] pb-1">
                        <span className="flex items-center gap-1.5 text-primary">
                          <Target className="w-3.5 h-3.5 animate-pulse" /> Replay Execution Chart (LTF)
                        </span>
                        <span className="text-white font-mono uppercase font-bold text-[9px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                          {symbol} ({timeframe.toUpperCase()}) Live Replay
                        </span>
                      </div>
                      <div className="relative border border-white/5 rounded-2xl overflow-hidden bg-[#060A12] shadow-inner">
                        <div ref={ltfChartRef} />
                        <canvas
                          ref={canvasRef}
                          className={cn(
                            "absolute inset-0 z-10 w-full h-full",
                            activeDrawingTool === 'cursor' ? "pointer-events-none cursor-default" : "pointer-events-auto cursor-crosshair"
                          )}
                          onMouseDown={handleCanvasMouseDown}
                          onMouseMove={handleCanvasMouseMove}
                          onMouseUp={handleCanvasMouseUp}
                        />
                      </div>
                      
                      {showRsi && (
                        <div className="space-y-1.5 pt-2">
                          <div className="text-[9px] font-bold uppercase text-[#64748B] flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-[#A855F7]" /> Relative Strength Index (RSI 14)
                          </div>
                          <div ref={rsiChartRef} className="border border-white/5 rounded-2xl overflow-hidden bg-[#060A12] shadow-inner" style={{ height: '120px' }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* --- PERSISTENCE: Floating Replay Controller (TradersCasa Style!) --- */}
                  <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-[#060A12]/90 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-4 shadow-2xl">
                    {/* Scissors Tool */}
                    <button
                      onClick={() => {
                        setIsScissorsActive(!isScissorsActive)
                        if (!isScissorsActive) {
                          if (ltfChartInstance.current) {
                            const handler = async (param: any) => {
                              if (param.time && sessionId) {
                                const clickedTime = param.time
                                const clickedIsoString = new Date(clickedTime * 1000).toISOString()
                                
                                if (!confirm(`Are you sure you want to cut the timeline at ${new Date(clickedTime * 1000).toLocaleString()}? This will permanently delete all trades opened after this point and roll back your balance.`)) {
                                  setIsScissorsActive(false)
                                  ltfChartInstance.current.unsubscribeClick(handler)
                                  return
                                }
                                
                                try {
                                  const res = await fetch(`https://${apiUrl}/api/sessions/${sessionId}/re-cut`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ cut_timestamp: clickedIsoString })
                                  })
                                  const data = await res.json()
                                  
                                  if (data.status === 'success') {
                                    const idx = ltfCandles.findIndex(c => c.time === clickedTime)
                                    if (idx !== -1) {
                                      setLtfCandles(prev => prev.slice(0, idx + 1))
                                      setCurrentCandle(ltfCandles[idx])
                                    }
                                    setAccountBalance(data.current_balance)
                                    startWebSocket(sessionId)
                                    fetchJournalLogs(sessionId)
                                  }
                                } catch (err) {
                                  console.error("Timeline cut failed:", err)
                                } finally {
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
                        "p-1.5 rounded-lg border transition-all cursor-pointer",
                        isScissorsActive 
                          ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" 
                          : "bg-[#0D1421] border-white/5 hover:border-white/10 text-white"
                      )}
                      title="Scissors: Cut timeline at clicked candle point"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-[1px] h-4 bg-white/10" />

                    {/* Step back */}
                    <button
                      onClick={() => {
                        if (ltfCandles.length > 5) {
                          setIsPlaying(false)
                          setLtfCandles(prev => prev.slice(0, -1))
                          if (ltfCandles.length > 1) {
                            setCurrentCandle(ltfCandles[ltfCandles.length - 2])
                          }
                        }
                      }}
                      className="p-1.5 bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-lg text-white transition-all active:scale-95 cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                      title="Step candle backward"
                    >
                      ◀ Step
                    </button>
                    
                    {/* Play/Pause */}
                    <button
                      onClick={handlePlayToggle}
                      className="p-2 bg-primary text-black rounded-lg hover:bg-primary/95 transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center"
                      title={isPlaying ? "Pause Stream" : "Start Live Stream"}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-black" />}
                    </button>

                    {/* Step forward */}
                    <button
                      onClick={handleStepForward}
                      className="p-1.5 bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-lg text-white transition-all active:scale-95 cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                      title="Step candle forward"
                    >
                      Step ▶
                    </button>

                    <div className="w-[1px] h-4 bg-white/10" />

                    {/* Speed selection dropdown (TradersCasa Style) */}
                    <select
                      value={playSpeed}
                      onChange={e => handleSpeedChange(Number(e.target.value))}
                      className="bg-[#0D1421] border border-white/5 rounded-lg px-2 py-1 text-[9px] font-mono text-white focus:outline-none"
                    >
                      <option value="1">1x/s</option>
                      <option value="3">3x/s</option>
                      <option value="5">5x/s</option>
                      <option value="10">10x/s</option>
                      <option value="20">20x/s</option>
                      <option value="40">40x/s</option>
                    </select>

                    <div className="text-[9px] font-mono text-white bg-white/5 px-2 py-1 rounded">
                      Candles: {ltfCandles.length}
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

                  {/* Active P&L card */}
                  <div className="bg-[#060A12] border border-white/5 rounded-2xl p-4 text-center shadow-inner">
                    <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest">Selected Spot Asset</p>
                    <h3 className="text-xl font-black text-white mt-1 font-mono uppercase">
                      {symbol}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] mt-3 pt-3 border-t border-white/5 text-[#64748B]">
                      <span>Live Asset Price:</span>
                      <span className="font-bold font-mono text-white">
                        ${currentAssetPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Position execution buttons */}
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

                  {/* Inputs */}
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
                </div>
              </div>
            </div>

            {/* --- PERSISTENCE: Horizontal bottom status bar (TradersCasa Style!) --- */}
            <div className="bg-[#060A12] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-bold text-xs shadow-inner">
              <div className="flex flex-wrap items-center gap-6 text-[#64748B]">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[#64748B]" /> Balance: 
                  <span className="text-white font-mono font-bold">${accountBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-[#64748B]" /> Open Floating Profit: 
                  <span className={cn("font-mono font-bold", runningPnl >= 0 ? "text-[#10B981]" : "text-[#EF4444]")}>
                    {activePosition ? (runningPnl >= 0 ? `+$${runningPnl.toFixed(2)}` : `-$${Math.abs(runningPnl).toFixed(2)}`) : "$0.00"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Layout Switcher */}
                <div className="flex bg-[#0D1421] border border-white/5 p-1 rounded-xl">
                  <button
                    onClick={() => setLayoutMode('single')}
                    className={cn(
                      "px-3 py-1.5 text-[9px] font-black rounded-lg transition-all uppercase tracking-wider",
                      layoutMode === 'single' ? "bg-white/5 text-white" : "text-[#64748B]"
                    )}
                  >
                    Single
                  </button>
                  <button
                    onClick={() => setLayoutMode('split')}
                    className={cn(
                      "px-3 py-1.5 text-[9px] font-black rounded-lg transition-all uppercase tracking-wider",
                      layoutMode === 'split' ? "bg-white/5 text-white" : "text-[#64748B]"
                    )}
                  >
                    Split
                  </button>
                </div>

                {/* Exit button */}
                <button
                  onClick={handleExitSession}
                  className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-black rounded-xl transition-all font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" /> Exit Session
                </button>
              </div>
            </div>

            {/* Replay Trade logs underneath */}
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
                                No trades simulated in this workspace yet. Click BUY or SELL above to trade!
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
                            <span className="text-[#64748B]">Average Profit R:R:</span>
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
                          Simulate trades first to plot compounding account balance curves.
                        </div>
                      ) : (
                        <div className="h-56 w-full text-[9px] font-mono">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
