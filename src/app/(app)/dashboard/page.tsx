'use client'

import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import {
  computeStats,
  computeEquityCurve,
  computeDailyPnl,
  fmt,
  getOpenTrades,
} from '@/lib/calculations'
import { TrendingUp, TrendingDown, Plus, LineChart, Activity, Target, Zap, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
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
  const isPositive = value >= 0
  const [prevVal, setPrevVal] = useState(value)
  const [flashState, setFlashState] = useState<'up' | 'down' | null>(null)
  const [blurState, setBlurState] = useState(false)

  useEffect(() => {
    if (value !== prevVal && prevVal !== undefined) {
      setFlashState(value > prevVal ? 'up' : 'down')
      setBlurState(true)
      
      // Remove blur after 150ms (start of number roll)
      const t1 = setTimeout(() => setBlurState(false), 150)
      // Fade out flash background after 800ms
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
            {isCurrency && <span>$</span>}
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
          
          // Calculate grid row/col for precise stagger delay
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
                  : 'bg-[#0A0A0F] border-white/5'
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

// ── Loading skeleton ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-[#12121a] border border-white/5 rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-20 bg-white/5 rounded mb-3" />
      <div className="h-8 w-28 bg-white/5 rounded" />
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const [period, setPeriod] = useState<Period>('1M')
  const [news, setNews] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNews(data)
      })
      .catch(console.error)
  }, [])

  const filteredTrades = filterByPeriod(trades, period)
  const stats = computeStats(filteredTrades)
  const curve = computeEquityCurve(filteredTrades, activeAccount?.initial_balance ?? activeAccount?.current_balance ?? 0)
  const dailyPnl = computeDailyPnl(trades)
  const openTrades = getOpenTrades(trades)

  const statCards = [
    {
      label: 'TOTAL P&L',
      value: stats.totalPnl,
      isCurrency: true,
      color: stats.totalPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]',
      icon: TrendingUp,
      badge: 'TOTAL',
      subtitle: `${stats.closedTrades} trades`,
    },
    {
      label: 'UNREALIZED',
      value: stats.unrealizedPnl,
      isCurrency: true,
      color: stats.unrealizedPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]',
      icon: Clock,
      subtitle: `${stats.openTrades} open positions`,
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card, i) => (
            <StatCard key={card.label} {...card} index={i} />
          ))
        }
      </div>

      {/* Chart + Calendar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Equity curve */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="xl:col-span-2 bg-[#12121a] border border-white/5 rounded-2xl p-5"
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
                      tickFormatter={(val) => `$${val.toLocaleString()}`}
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

      {/* Open positions */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="bg-[#12121a] border border-white/5 rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">Open Positions</h2>
            {openTrades.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-5 h-5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-bold flex items-center justify-center"
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
            className="py-10 text-center text-[#334155] text-sm"
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
                    const isPositive = (t.net_profit ?? 0) >= 0
                    
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
                        className="group border-b border-white/[0.02]"
                      >
                        <td className="py-4 px-2 font-bold tracking-tight flex items-center gap-2">
                          {t.symbol}
                          <motion.span 
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            transition={{ delay: 5, duration: 1 }}
                            className="text-[9px] bg-[#F59E0B] text-black px-1.5 py-0.5 rounded font-black tracking-widest uppercase"
                          >
                            NEW
                          </motion.span>
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
                            {fmt(t.net_profit ?? 0)}
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
      </motion.div>

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
              // Duplicate the news list so the marquee loops seamlessly
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

    </div>
  )
}
