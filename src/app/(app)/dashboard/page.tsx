'use client'

import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { useMarketMode } from '@/context/MarketModeContext'
import {
  computeStats,
  computeEquityCurve,
  computeDailyPnl,
  fmt,
  getOpenTrades,
} from '@/lib/calculations'
import { TrendingUp, TrendingDown, Plus, LineChart, Activity, Target, Zap, Clock, ChevronRight, Brain, Award, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useMemo } from 'react'
import CountUp from 'react-countup'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth } from 'date-fns'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'


const PERIOD_OPTS = ['1D', '1W', '1M', '3M', 'ALL'] as const
type Period = (typeof PERIOD_OPTS)[number]

function filterByPeriod(trades: any[], period: Period) {
  if (period === 'ALL') return trades
  const now = new Date()
  const days = period === '1D' ? 1 : period === '1W' ? 7 : period === '1M' ? 30 : 90
  const cutoff = new Date(now.getTime() - days * 86400000)
  return trades.filter(t => t.close_time && new Date(t.close_time) >= cutoff)
}

// ── Animated stat card ────────────────────────────────────────────────────────
function StatCard({
  label, value, isCurrency, color, icon: Icon, index, subtitle, badge, isProgress
}: {
  label: string
  value: number
  isCurrency?: boolean
  color: string
  icon: React.ElementType
  index: number
  subtitle?: string
  badge?: string
  isProgress?: boolean
}) {
  const { currencySymbol } = useMarketMode()
  const isPositive = value >= 0
  const [prevVal, setPrevVal] = useState(value)
  const [flashState, setFlashState] = useState<'up' | 'down' | null>(null)
  const [blurState, setBlurState] = useState(false)


  useEffect(() => {
    if (value !== prevVal && prevVal !== undefined) {
      setFlashState(value > prevVal ? 'up' : 'down')
      setBlurState(true)
      
      const t1 = setTimeout(() => setBlurState(false), 150)
      const t2 = setTimeout(() => setFlashState(null), 800)
      
      setPrevVal(value)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [value, prevVal])

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={cn(
        "relative overflow-hidden border border-[#1A1A2E] rounded-2xl p-5 group cursor-default shadow-lg transition-all duration-500",
        flashState === 'up' ? 'bg-[#22C55E]/10' : flashState === 'down' ? 'bg-[#EF4444]/10' : 'bg-[#0F0F18]'
      )}
    >
      {/* Top accent line */}
      <motion.div
        className={cn('absolute top-0 left-0 right-0 h-[1px]',
          color === 'text-primary' ? 'bg-gradient-to-r from-transparent via-[#F59E0B]/40 to-transparent' :
          isCurrency
            ? isPositive ? 'bg-gradient-to-r from-transparent via-[#22C55E]/40 to-transparent'
              : 'bg-gradient-to-r from-transparent via-[#EF4444]/40 to-transparent'
            : 'bg-gradient-to-r from-transparent via-[#F59E0B]/40 to-transparent'
        )}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay: index * 0.08 + 0.2 }}
      />

      <div className="relative flex flex-col justify-between h-full">
        <div className="flex items-start justify-between">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-white/5 bg-white/5'
          )}>
            <Icon className={cn('w-4 h-4', color)} />
          </div>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 uppercase tracking-wider">
              {badge}
            </span>
          )}
        </div>
        
        <div className="mt-4">
          <p className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold">{label}</p>
          <div className={cn(
            'text-3xl font-black mt-1 tabular-nums tracking-tight text-[#F1F5F9]',
            'transition-all duration-150',
            blurState ? 'blur-[4px]' : 'blur-0'
          )}>
            {isCurrency && value < 0 && <span>-</span>}
            {isCurrency && <span>{currencySymbol}</span>}
            <CountUp
              end={Math.abs(value)}
              decimals={isCurrency || !Number.isInteger(value) ? 2 : 0}
              duration={0.6}
              separator=","
              preserveValue
            />
            {!isCurrency && label === 'WIN RATE' && <span className="text-xl ml-0.5">%</span>}
          </div>
          
          {isProgress ? (
            <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-[#F59E0B] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 1.5, delay: 0.5, type: 'spring', bounce: 0.2 }}
              />
            </div>
          ) : (
            subtitle && <p className="text-xs text-[#F59E0B] mt-2 font-medium flex items-center gap-1">→ {subtitle}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Calendar heatmap ──────────────────────────────────────────────────────────
function CalendarHeatmap({ dailyPnl, month }: { dailyPnl: Record<string, number>; month: Date }) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end })

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="bg-[#0F0F18] border border-[#1A1A2E] rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold">P&L Calendar</p>
          <p className="text-sm font-semibold mt-0.5 text-[#F1F5F9]">{format(month, 'MMMM yyyy')}</p>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-[10px] text-[#64748B] text-center font-medium pb-1">{d}</div>
        ))}
        {days.map((day, i) => {
          const key = format(day, 'yyyy-MM-dd')
          const pnl = dailyPnl[key]
          const isCurrentMonth = isSameMonth(day, month)
          const hasTrades = pnl !== undefined
          
          const row = Math.floor(i / 7)
          const col = i % 7
          const staggerDelay = (row * 4 + col) * 0.015

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: isCurrentMonth ? 1 : 0.3, scale: 1 }}
              transition={{ 
                delay: staggerDelay, 
                type: 'spring', 
                stiffness: 400, 
                damping: 20 
              }}
              className={cn(
                'group relative h-10 rounded-lg border flex flex-col items-center justify-center text-[10px]',
                'cursor-help transition-transform hover:scale-125 z-0 hover:z-50 duration-200',
                hasTrades
                  ? pnl >= 0
                    ? 'bg-[#22C55E]/10 border-[#22C55E]/25'
                    : 'bg-[#EF4444]/10 border-[#EF4444]/25'
                  : 'bg-[#060A12] border-white/5'
              )}
            >
              <span className={cn('font-medium text-[11px]', hasTrades ? 'text-white' : 'text-[#64748B]')}>
                {format(day, 'd')}
              </span>
              {hasTrades && (
                <>
                  <div className={cn('absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full', pnl >= 0 ? 'bg-[#22C55E]' : 'bg-[#EF4444]')} />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1A1A2E] border border-white/10 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap shadow-[0_0_20px_rgba(0,0,0,0.5)] pointer-events-none z-50">
                    <span className={cn('font-bold', pnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>{fmt(pnl)}</span>
                    <p className="text-[#64748B] text-[10px] mt-0.5">{format(day, 'MMM d')}</p>
                  </div>
                </>
              )}
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-20 bg-white/5 rounded mb-3" />
      <div className="h-8 w-28 bg-white/5 rounded" />
    </div>
  )
}

export default function DashboardPage() {
  const { activeAccount } = useAccounts()
  const { currencySymbol, formatCurrency } = useMarketMode()
  const { trades, loading } = useTrades(activeAccount?.id)

  const [period, setPeriod] = useState<Period>('1M')
  const [news, setNews] = useState<any[]>([])
  
  // Real-time spot price metrics for dynamic floating calculations
  const [liveGoldPrice, setLiveGoldPrice] = useState<number | null>(null)

  // Fetch live spot Gold price from public Binance PAXGUSDT API every 8 seconds
  useEffect(() => {
    let active = true
    async function fetchPrice() {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT')
        if (res.ok) {
          const data = await res.json()
          if (active && data.price) {
            setLiveGoldPrice(parseFloat(data.price))
          }
        }
      } catch (err) {
        console.warn('Failed to fetch live gold price:', err)
      }
    }
    
    fetchPrice()
    const interval = setInterval(fetchPrice, 8000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNews(data)
      })
      .catch(console.error)
  }, [])

  const [latestAiReport, setLatestAiReport] = useState<any | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    async function loadLatestReport() {
      if (!activeAccount?.id) {
        setLatestAiReport(null)
        return
      }
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('ai_reports')
          .select('*')
          .eq('account_id', activeAccount.id)
          .order('generated_at', { ascending: false })
          .limit(1)
        
        if (data && data.length > 0) {
          setLatestAiReport(data[0])
        } else {
          setLatestAiReport(null)
        }
      } catch (err) {
        console.error('Failed to load latest AI report on dashboard:', err)
      }
    }
    loadLatestReport()
  }, [activeAccount?.id])

  const unjournaledCount = useMemo(() => {
    const closed = trades.filter(t => t.status === 'closed')
    return closed.filter(t => {
      let isUnj = false
      if (!t.notes) {
        isUnj = true
      } else {
        try {
          const parsed = JSON.parse(t.notes)
          if (parsed && typeof parsed === 'object') {
            isUnj = !(parsed.p1?.trim() || parsed.p2?.trim() || parsed.p3?.trim() || parsed.p4?.trim())
          } else {
            isUnj = !t.notes.trim()
          }
        } catch (e) {
          isUnj = !t.notes.trim()
        }
      }
      if (!isUnj || !t.close_time) return false
      const closeDate = new Date(t.close_time)
      const hoursSinceClose = (Date.now() - closeDate.getTime()) / (1000 * 60 * 60)
      return hoursSinceClose > 2
    }).length
  }, [trades])

  useEffect(() => {
    if (!loading && unjournaledCount > 0) {
      const shown = sessionStorage.getItem('unjournaled_toast_shown')
      if (!shown) {
        setToastVisible(true)
        sessionStorage.setItem('unjournaled_toast_shown', 'true')
        const timer = setTimeout(() => {
          setToastVisible(false)
        }, 6000)
        return () => clearTimeout(timer)
      }
    }
  }, [loading, unjournaledCount])

  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  const todayStr = useMemo(() => {
    if (!isClient) return ''
    return format(new Date(), 'yyyy-MM-dd')
  }, [isClient])

  const todayTrades = useMemo(() => {
    if (!todayStr) return []
    return trades.filter(t => t.status === 'closed' && t.close_time && format(new Date(t.close_time), 'yyyy-MM-dd') === todayStr)
  }, [trades, todayStr])

  const todayPnl = useMemo(() => {
    return todayTrades.reduce((sum, t) => sum + (t.net_profit ?? 0), 0)
  }, [todayTrades])

  // Count both open & closed trades that were opened today
  const todayOpenedCount = useMemo(() => {
    if (!todayStr) return 0
    return trades.filter(t => t.open_time && format(new Date(t.open_time), 'yyyy-MM-dd') === todayStr).length
  }, [trades, todayStr])

  const todayFloatingPnl = useMemo(() => {
    if (!todayStr) return 0
    const openToday = trades.filter(t => t.status === 'open' && t.open_time && format(new Date(t.open_time), 'yyyy-MM-dd') === todayStr)
    
    let floating = 0
    openToday.forEach(t => {
      if (t.net_profit != null && Number(t.net_profit) !== 0) {
        floating += Number(t.net_profit)
        return
      }
      const cleanSymbol = String(t.symbol).toUpperCase().replace(/[^A-Z]/g, '')
      if (cleanSymbol.includes('XAU') && liveGoldPrice && t.entry_price && t.lot_size) {
        const entry = Number(t.entry_price)
        const lots = Number(t.lot_size)
        const isBuy = t.direction === 'buy'
        const multiplier = 100
        const diff = isBuy ? (liveGoldPrice - entry) : (entry - liveGoldPrice)
        floating += diff * multiplier * lots
      }
    })
    return floating
  }, [trades, todayStr, liveGoldPrice])

  const nextNewsItem = useMemo(() => {
    if (news.length === 0) return null
    const sorted = [...news].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const now = new Date().getTime()
    return sorted.find(n => new Date(n.date).getTime() > now) || sorted[0]
  }, [news])

  const filteredTrades = filterByPeriod(trades, period)
  const stats = computeStats(filteredTrades)
  
  const startingBalance = (() => {
    const initialBal = activeAccount?.initial_balance ?? activeAccount?.current_balance ?? 10000.0
    if (period === 'ALL') return initialBal
    const now = new Date()
    const days = period === '1D' ? 1 : period === '1W' ? 7 : period === '1M' ? 30 : 90
    const cutoff = new Date(now.getTime() - days * 86400000)
    const profitBefore = trades
      .filter(t => t.status === 'closed' && t.net_profit !== null && t.close_time && new Date(t.close_time) < cutoff)
      .reduce((sum, t) => sum + (t.net_profit ?? 0), 0)
    return initialBal + profitBefore
  })()

  const curve = computeEquityCurve(filteredTrades, startingBalance)
  const dailyPnl = computeDailyPnl(trades)
  const openTrades = getOpenTrades(trades)

  // 100% Dynamic active unrealised floating P&L calculation
  const computedUnrealizedPnl = useMemo(() => {
    if (openTrades.length === 0) return 0

    let totalFloating = 0
    openTrades.forEach(t => {
      // If synced MT5 position with dynamic profit updated
      if (t.net_profit != null && Number(t.net_profit) !== 0) {
        totalFloating += Number(t.net_profit)
        return
      }

      // If manual open trade or missing synced profit, calculate it dynamically using public quotes if gold spot
      const cleanSymbol = String(t.symbol).toUpperCase().replace(/[^A-Z]/g, '')
      if (cleanSymbol.includes('XAU') && liveGoldPrice && t.entry_price && t.lot_size) {
        const entry = Number(t.entry_price)
        const lots = Number(t.lot_size)
        const isBuy = t.direction === 'buy'
        const multiplier = 100
        const diff = isBuy ? (liveGoldPrice - entry) : (entry - liveGoldPrice)
        totalFloating += diff * multiplier * lots
      }
    })

    // If verified MT5 account but no open trades calculations differed, we can use the equity-balance delta as fallback
    if (totalFloating === 0 && activeAccount?.is_verified && activeAccount.current_equity != null && activeAccount.current_balance != null) {
      return activeAccount.current_equity - activeAccount.current_balance
    }

    return totalFloating
  }, [activeAccount, openTrades, liveGoldPrice])

  const statCards = [
    {
      label: 'TOTAL P&L',
      value: stats.realizedPnl + computedUnrealizedPnl,
      isCurrency: true,
      color: (stats.realizedPnl + computedUnrealizedPnl) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]',
      icon: TrendingUp,
      badge: 'TOTAL',
      subtitle: `${stats.closedTrades} trades`,
    },
    {
      label: 'UNREALIZED',
      value: computedUnrealizedPnl,
      isCurrency: true,
      color: computedUnrealizedPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]',
      icon: Clock,
      subtitle: `${openTrades.length} open ${openTrades.length === 1 ? 'position' : 'positions'}`,
    },
    {
      label: 'REALIZED',
      value: stats.realizedPnl,
      isCurrency: true,
      color: stats.realizedPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]',
      icon: Zap,
      subtitle: `${stats.closedTrades} closed trades`,
    },
    {
      label: 'WIN RATE',
      value: stats.winRate,
      color: 'text-primary',
      icon: Target,
      isProgress: true,
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Link href="/trades">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Add Trade
          </motion.button>
        </Link>
      </motion.div>

      {/* Premium Growth Analysis Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-[#0F0F18]/80 to-transparent p-5 backdrop-blur-xl"
      >
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-[#F59E0B]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/35 flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0">
              <LineChart className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-100 tracking-tight">Growth Visualization Ready</h4>
              <p className="text-xs text-slate-400 leading-normal max-w-2xl">
                Visit the <strong className="text-blue-400">Analysis page</strong> to get the full analysis of your growth, in-depth account diagnostics, compounding trajectory, and interactive win-rate metrics.
              </p>
            </div>
          </div>
          <Link href="/analysis/performance" className="shrink-0 w-full md:w-auto">
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              Explore Growth Analysis <ChevronRight className="w-3.5 h-3.5" />
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card, i) => (
            <StatCard key={card.label} {...card} index={i} />
          ))
        }
      </div>

      {/* Today's Trading Conditions widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <h3 className="font-semibold text-xs tracking-wider text-[#94A3B8] uppercase flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" /> Today's Trading Conditions
          </h3>
          <span className="text-[9px] px-2.5 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-full font-black uppercase tracking-widest">
            Live Feed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Today's Performance */}
          <div className="bg-[#09090E]/60 p-4 rounded-xl border border-white/5 space-y-1.5 flex flex-col justify-between">
            <span className="text-[10px] text-[#64748B] uppercase font-black tracking-wider block">Today's Performance</span>
            <div>
              <div className="text-xl font-bold text-white tracking-tight flex flex-col justify-end">
                <div className="flex items-baseline gap-2">
                  <span className={cn(todayPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
                    {todayPnl >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(todayPnl).toFixed(2)}
                  </span>
                  <span className="text-xs text-[#64748B] font-mono">({todayTrades.length} closed)</span>
                </div>
                {todayFloatingPnl !== 0 && (
                  <span className={cn("text-xs font-bold font-mono mt-0.5", todayFloatingPnl >= 0 ? "text-emerald-400 animate-pulse" : "text-rose-400 animate-pulse")}>
                    {todayFloatingPnl >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(todayFloatingPnl).toFixed(2)} floating
                  </span>
                )}
              </div>
              <span className="text-[9px] text-[#64748B] block mt-1.5">Realized and active floating P&L today</span>
            </div>
          </div>

          {/* Activity/Volatility */}
          <div className="bg-[#09090E]/60 p-4 rounded-xl border border-white/5 space-y-1.5 flex flex-col justify-between">
            <span className="text-[10px] text-[#64748B] uppercase font-black tracking-wider block">Volatility / Activity</span>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-black px-2.5 py-0.5 rounded-lg border font-mono uppercase tracking-wider",
                  todayOpenedCount > 3
                    ? "bg-red-500/10 border-red-500/25 text-[#EF4444]"
                    : "bg-emerald-500/10 border-emerald-500/25 text-[#22C55E]"
                )}>
                  {todayOpenedCount > 3 ? "⚡ High Activity" : "✔ Quiet"}
                </span>
              </div>
              <span className="text-[9px] text-[#64748B] block mt-1.5">
                {todayOpenedCount > 3 
                  ? `Overtrading danger zone. ${todayOpenedCount} trades opened today. Respect maximum daily limits.` 
                  : `Calm trading parameters (${todayOpenedCount} opened). Focus on high-quality setups.`}
              </span>
            </div>
          </div>

          {/* Next Catalyst */}
          <div className="bg-[#09090E]/60 p-4 rounded-xl border border-white/5 space-y-1.5 flex flex-col justify-between">
            <span className="text-[10px] text-[#64748B] uppercase font-black tracking-wider block">Upcoming Catalyst</span>
            {nextNewsItem ? (
              <div>
                <span className="text-xs font-bold text-white line-clamp-1 block">
                  [{nextNewsItem.country}] {nextNewsItem.title}
                </span>
                <span className="text-[9px] text-[#F59E0B] font-black uppercase tracking-wider block mt-1 font-mono">
                  High Impact ({format(new Date(nextNewsItem.date), 'HH:mm')})
                </span>
              </div>
            ) : (
              <div>
                <span className="text-xs font-bold text-[#64748B] block">No upcoming catalysts scheduled</span>
                <span className="text-[9px] text-[#64748B] block mt-1">Calendar scans clear for rest of day</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Chart + Calendar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Equity curve */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="xl:col-span-2 bg-[#0D1421] border border-white/5 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold">Equity Curve</p>
              {curve.length > 0 && (
                <p className={cn('text-sm font-semibold mt-0.5', stats.totalPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                  {fmt(stats.totalPnl)}
                </p>
              )}
            </div>
            <div className="flex bg-white/5 rounded-lg p-1 gap-0.5">
              {PERIOD_OPTS.map(p => (
                <motion.button
                  key={p}
                  onClick={() => setPeriod(p)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'relative px-3 py-1 rounded-md text-xs font-medium transition-all',
                    period === p ? 'text-white' : 'text-[#64748B] hover:text-foreground'
                  )}
                >
                  {period === p && (
                    <motion.div
                      layoutId="period-pill"
                      className="absolute inset-0 bg-primary rounded-md"
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <span className="relative z-10">{p}</span>
                </motion.button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {curve.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-52 flex flex-col items-center justify-center text-[#334155] gap-3"
              >
                <LineChart className="w-10 h-10 opacity-40" />
                <p className="text-sm">No trades in this period</p>
              </motion.div>
            ) : (
              <motion.div
                key={period}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="h-52"
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={curve} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stats.totalPnl >= 0 ? '#22C55E' : '#EF4444'} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={stats.totalPnl >= 0 ? '#22C55E' : '#EF4444'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                       dataKey="time" 
                       stroke="#64748B" 
                       fontSize={10} 
                       tickLine={false} 
                       axisLine={false}
                       tickFormatter={(val) => {
                         try { return format(new Date(val), period === '1D' ? 'HH:mm' : 'MMM d') }
                         catch { return val }
                       }}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      stroke="#64748B" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => `${currencySymbol}${val.toLocaleString()}`}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1a24',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                      }}
                      formatter={(v: any) => [fmt(v), 'Balance']}
                      labelFormatter={(label) => {
                        try { return format(new Date(label), 'MMM d, yyyy HH:mm') }
                        catch { return label }
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke={stats.totalPnl >= 0 ? '#22C55E' : '#EF4444'}
                      strokeWidth={2}
                      fill="url(#equityGrad)"
                      dot={false}
                      animationDuration={1500}
                      animationEasing="ease-out"
                      isAnimationActive={true}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Calendar heatmap */}
        <CalendarHeatmap dailyPnl={dailyPnl} month={new Date()} />
      </div>

      {/* Open positions & AI Psychology Coach Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Open positions - spans 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-2 bg-[#0D1421] border border-white/5 rounded-2xl p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Open Positions</h2>
                {openTrades.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-bold flex items-center justify-center animate-pulse"
                  >
                    {openTrades.length}
                  </motion.span>
                )}
              </div>
              <Link href="/trades" className="text-xs text-primary hover:text-primary/80 transition-colors">
                View all →
              </Link>
            </div>

            {openTrades.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center text-[#334155] text-sm flex flex-col items-center justify-center"
              >
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No open positions
              </motion.div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#334155] border-b border-white/5">
                      <th className="text-left pb-3 font-semibold">Symbol</th>
                      <th className="text-left pb-3 font-semibold">Direction</th>
                      <th className="text-left pb-3 font-semibold">Entry</th>
                      <th className="text-left pb-3 font-semibold">Size</th>
                      <th className="text-right pb-3 font-semibold">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    <AnimatePresence mode="popLayout">
                      {openTrades.map((t, i) => {
                        let displayProfit = t.net_profit ?? 0
                        const cleanSymbol = String(t.symbol).toUpperCase().replace(/[^A-Z]/g, '')
                        if (displayProfit === 0 && cleanSymbol.includes('XAU') && liveGoldPrice && t.entry_price && t.lot_size) {
                          const entry = Number(t.entry_price)
                          const lots = Number(t.lot_size)
                          const isBuy = t.direction === 'buy'
                          const multiplier = 100
                          const diff = isBuy ? (liveGoldPrice - entry) : (entry - liveGoldPrice)
                          displayProfit = diff * multiplier * lots
                        }
                        const isPositive = displayProfit >= 0
                        
                        return (
                          <motion.tr
                            key={t.id}
                            initial={{ opacity: 0, y: -20, backgroundColor: 'rgba(245,159,11,0.12)' }}
                            animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ 
                              opacity: { duration: 0.3 }, 
                              y: { duration: 0.4, type: 'spring', bounce: 0.2 },
                              backgroundColor: { duration: 3, delay: 0.5 }
                            }}
                            className="group border-b border-white/[0.02] hover:bg-white/[0.01]"
                          >
                            <td className="py-4 px-2 font-bold tracking-tight flex items-center gap-2">
                              {t.symbol}
                            </td>
                            <td className="py-4 px-2">
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded-md font-semibold',
                                t.direction === 'buy'
                                  ? 'bg-[#22C55E]/12 text-[#22C55E]'
                                  : 'bg-[#EF4444]/12 text-[#EF4444]'
                              )}>
                                {t.direction === 'buy' ? '↗ Long' : '↘ Short'}
                              </span>
                            </td>
                            <td className="py-4 px-2 font-mono text-[#64748B] text-xs">${t.entry_price?.toFixed(2) ?? '—'}</td>
                            <td className="py-4 px-2 text-[#64748B] text-xs">{t.lot_size ?? '—'} lots</td>
                            <td className={cn('py-4 px-2 text-right font-bold tabular-nums', isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                              <motion.div
                                animate={isPositive ? { scale: [1, 1.015, 1] } : {}}
                                transition={isPositive ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
                              >
                                {fmt(displayProfit)}
                              </motion.div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>

        {/* AI Psychology Coach Card - 1 col */}
        <div className="col-span-1 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[300px] shadow-xl group hover:border-[#F59E0B]/30 transition-all duration-300"
          >
            {/* Subtle top decoration */}
            <div className="absolute right-0 top-0 w-24 h-24 bg-[#F59E0B]/5 rounded-full blur-xl pointer-events-none" />

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <h3 className="font-semibold text-xs tracking-wider text-[#94A3B8] uppercase flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-primary animate-pulse" /> AI Psychology Coach
                </h3>
                <span className="text-[8px] px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full font-black uppercase tracking-widest">
                  Nirikshan
                </span>
              </div>

              {latestAiReport ? (
                <div className="space-y-3.5">
                  <div className="space-y-2">
                    <span className="text-[9px] text-[#64748B] uppercase font-black block">Detected Cognitive Profile</span>
                    {latestAiReport.rules_analysis?.cognitive_biases && latestAiReport.rules_analysis.cognitive_biases.filter((b: any) => b.severity === 'critical' || b.severity === 'moderate').length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {latestAiReport.rules_analysis.cognitive_biases
                          .filter((b: any) => b.severity === 'critical' || b.severity === 'moderate')
                          .map((b: any) => (
                            <span
                              key={b.bias_name}
                              title={b.description}
                              className={cn(
                                "text-[10px] px-2.5 py-0.5 rounded-lg border font-black uppercase tracking-wider shadow-sm flex items-center gap-1",
                                b.severity === 'critical' 
                                  ? "bg-red-500/10 border-red-500/30 text-[#EF4444]" 
                                  : "bg-amber-500/10 border-amber-500/30 text-[#F59E0B]"
                              )}
                            >
                              ⚠ {b.bias_name}
                            </span>
                          ))
                        }
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-lg border font-black uppercase tracking-wider bg-emerald-500/10 border-emerald-500/30 text-[#22C55E] flex items-center gap-1">
                          ✔ Stable Focus
                        </span>
                        <span className="text-xs text-slate-300 font-medium font-mono">Disciplined State</span>
                      </div>
                    )}
                  </div>

                  <div className="border-l-2 border-primary bg-[#09090E]/60 p-3 rounded-r-xl text-xs text-slate-300 italic font-medium leading-relaxed">
                    "{latestAiReport.summary}"
                  </div>

                  {latestAiReport.rules_analysis?.cognitive_biases && latestAiReport.rules_analysis.cognitive_biases.length > 0 && (
                    <div className="bg-white/5 border border-white/5 p-3 rounded-xl space-y-1">
                      <span className="text-[9px] text-primary uppercase font-black block tracking-wider">Recommended Exercise</span>
                      <p className="text-[11px] text-slate-300 leading-normal">
                        {latestAiReport.rules_analysis.cognitive_biases[0].psychological_exercise}
                      </p>
                    </div>
                  )}

                  <div 
                    onClick={() => setShowBreakdown(!showBreakdown)}
                    className="flex items-center justify-between text-[10px] text-[#64748B] font-mono bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg cursor-pointer transition-colors border border-white/5"
                  >
                    <span className="flex items-center gap-1">Discipline: <strong className="text-white">{latestAiReport.discipline_score}/10</strong></span>
                    <span className="flex items-center gap-1">Risk Control: <strong className="text-white">{latestAiReport.risk_score}/10</strong></span>
                    <span className="text-xs text-slate-500">{showBreakdown ? '▲' : '▼'}</span>
                  </div>

                  {/* Collapsible breakdown */}
                  <AnimatePresence>
                    {showBreakdown && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden space-y-2.5 mt-2"
                      >
                        <div className="text-[#94A3B8] font-bold uppercase tracking-wider text-[9px] mb-1.5 flex items-center justify-between">
                          <span>Telemetry Breakdown</span>
                          <span className="text-[8px] font-normal text-slate-500 font-mono">Real-time Metrics</span>
                        </div>
                        
                        <div className="space-y-2 bg-[#09090E]/60 p-2.5 rounded-xl border border-white/5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-[#64748B]">Discipline Expectancy</span>
                            <span className="font-bold text-white font-mono">{latestAiReport.discipline_score * 10}%</span>
                          </div>
                          <p className="text-[10px] text-[#94A3B8] leading-tight pl-2 border-l border-primary/30">
                            {latestAiReport.discipline_score >= 8 ? 'Exceptional execution. You are keeping trade sizes consistent and respecting rule boundaries.' : 
                             latestAiReport.discipline_score >= 5 ? 'Moderate execution. Watch out for impulse sizing and stray setups near sessions transition.' : 
                             'Critical lapses. Revenge entries detected after stopout. High risk of capital erosion.'}
                          </p>
                        </div>

                        <div className="space-y-2 bg-[#09090E]/60 p-2.5 rounded-xl border border-white/5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-[#64748B]">Risk Management</span>
                            <span className="font-bold text-white font-mono">{latestAiReport.risk_score * 10}%</span>
                          </div>
                          <p className="text-[10px] text-[#94A3B8] leading-tight pl-2 border-l border-[#EF4444]/30">
                            {latestAiReport.risk_score >= 8 ? 'Excellent drawdown preservation. Trade duration ratio aligns with standard risk-reward rules.' : 
                             latestAiReport.risk_score >= 5 ? 'Moderate risk profile. Holding losing trades significantly longer than winners on average.' : 
                             'Extremely high risk profile. Stop-loss movement or missing stops detected.'}
                          </p>
                        </div>

                        {latestAiReport.rules_analysis?.compliance_score !== undefined && (
                          <div className="space-y-2 bg-[#09090E]/60 p-2.5 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-[#64748B]">Rule Compliance</span>
                              <span className="font-bold text-white font-mono">{latestAiReport.rules_analysis.compliance_score * 10}%</span>
                            </div>
                            <p className="text-[10px] text-[#94A3B8] leading-tight pl-2 border-l border-emerald-500/30">
                              {latestAiReport.rules_analysis.compliance_score >= 8 ? 'Flawless compliance with your personal checklist rules.' : 
                               latestAiReport.rules_analysis.compliance_score >= 5 ? 'Minor breaches. Entering trades without complete checklist validation.' : 
                               'Severe rule violations. Active trading rules ignored on high lot sizes.'}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <ShieldAlert className="w-8 h-8 text-[#64748B] mx-auto opacity-35 animate-bounce" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">No Psychological Audits</p>
                    <p className="text-[10px] text-[#64748B] max-w-xs mx-auto leading-relaxed">
                      You haven't run any cognitive trading audits yet. Nirikshan stands ready to scan your behavior!
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 shrink-0 mt-4">
              <Link href="/ai-report">
                <button className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-[#F59E0B]/25 border border-primary/20 hover:border-primary/40 rounded-xl text-xs font-black text-primary transition-all active:scale-95 shadow-md">
                  {latestAiReport ? 'Open Full Diagnostics Dossier' : 'Generate Behavior Diagnostic'} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Unjournaled alert banner box */}
          {unjournaledCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.48 }}
              className="bg-[#0D1421] border border-amber-500/20 rounded-2xl p-4 space-y-3 shadow-xl"
            >
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                <span className="text-sm">⚠</span>
                <span>Unjournaled Trades Reminder</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                You have <strong className="text-white">{unjournaledCount}</strong> trade{unjournaledCount > 1 ? 's' : ''} closed more than 2 hours ago that haven't been journaled. Reflections are vital to diagnose and prevent revenge trading cycles.
              </p>
              <Link href="/journal">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 font-black rounded-xl text-[10px] text-black transition-all active:scale-95 shadow-sm mt-1">
                  Go to Journal <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </motion.div>
          )}
        </div>

      </div>

      {/* News Ticker */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="bg-[#0d1017] border border-white/5 rounded-2xl p-4 flex items-center overflow-hidden"
      >
        <div className="flex items-center gap-2 pr-4 border-r border-white/10 shrink-0">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-bold tracking-widest text-[#64748B]">NEWS</span>
        </div>
        <div className="flex-1 overflow-hidden ml-4 relative">
          <div className="flex whitespace-nowrap animate-[marquee_20s_linear_infinite]">
            {news.length === 0 ? (
              <span className="text-sm font-medium mr-12 text-[#64748B]">No high-impact news upcoming...</span>
            ) : (
              [...news, ...news].map((n, i) => {
                const timeStr = format(new Date(n.date), 'MMM d, HH:mm')
                return (
                  <span key={i} className="text-sm font-medium mr-12">
                    <span className="text-xs text-[#64748B] mr-2">{n.country}</span> 
                    {n.title} 
                    <span className="text-[#EF4444] ml-2">High Impact ({timeStr})</span>
                  </span>
                )
              })
            )}
          </div>
        </div>
      </motion.div>

      {/* Framer motion toast notification */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm bg-[#0D1421] border border-amber-500/25 shadow-[0_10px_30px_rgba(245,159,11,0.15)] rounded-2xl p-4 flex gap-3 items-start"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shrink-0 mt-0.5 animate-pulse">
              <span>⚠</span>
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-xs font-black text-white uppercase tracking-wider block">Reflective Alert</span>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                You have <strong className="text-white">{unjournaledCount} unjournaled trade{unjournaledCount > 1 ? 's' : ''}</strong> older than 2 hours. Reviewing your trades keeps your discipline high!
              </p>
              <div className="flex gap-2 pt-1">
                <Link href="/journal">
                  <button 
                    onClick={() => setToastVisible(false)}
                    className="text-[10px] px-2.5 py-1 bg-amber-500 text-black hover:bg-amber-400 font-bold rounded-lg transition-colors"
                  >
                    Journal Now
                  </button>
                </Link>
                <button 
                  onClick={() => setToastVisible(false)}
                  className="text-[10px] px-2.5 py-1 bg-white/5 text-[#64748B] hover:text-white rounded-lg transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
