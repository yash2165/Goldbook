'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Wrench, Calculator, Calendar, BookMarked,
  Info, TrendingUp, TrendingDown, Clock, ShieldAlert,
  Plus, Check, Trash2, CheckCircle2, ChevronRight, RefreshCw,
  Flame, Award, CheckSquare, Edit2, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TradingRule {
  id?: string
  rule_type: string
  label: string
  is_active: boolean
  value?: number | null
}

interface EconomicEvent {
  name: string
  date: Date
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  forecast: string
  previous: string
}

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<'calc' | 'calendar' | 'checklist' | 'habit'>('calc')
  
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(245,159,11,0.15)]">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Trading Tools</h1>
            <p className="text-xs text-[#64748B] mt-0.5">Professional utility suite to optimize your execution edge.</p>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="flex bg-[#060A12] border border-white/5 p-1 rounded-xl">
          {[
            { id: 'calc', label: 'Risk Calculator', icon: Calculator },
            { id: 'calendar', label: 'News Calendar', icon: Calendar },
            { id: 'checklist', label: 'Plan Checklist', icon: BookMarked },
            { id: 'habit', label: 'Habit Tracker', icon: CheckCircle2 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wider",
                activeTab === tab.id
                  ? "bg-primary/10 border border-primary/20 text-primary"
                  : "text-[#64748B] hover:text-white"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 gap-6">
        <div className={cn(activeTab === 'calc' ? 'block' : 'hidden')}>
          <PositionSizeCalculatorWidget />
        </div>
        <div className={cn(activeTab === 'calendar' ? 'block' : 'hidden')}>
          <EconomicCalendarWidget />
        </div>
        <div className={cn(activeTab === 'checklist' ? 'block' : 'hidden')}>
          <PlanChecklistWidget />
        </div>
        <div className={cn(activeTab === 'habit' ? 'block' : 'hidden')}>
          <HabitTrackerWidget />
        </div>
      </div>
    </div>
  )
}

// ── 1. Position Size Calculator Widget ─────────────────────────────────────────
function PositionSizeCalculatorWidget() {
  const [balance, setBalance] = useState<number>(10000)
  const [riskPercent, setRiskPercent] = useState<number>(1.0)
  const [slPips, setSlPips] = useState<number>(50)
  const [tpPips, setTpPips] = useState<number>(150)
  const [entryPrice, setEntryPrice] = useState<number>(2400.0)
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy')
  const [pair, setPair] = useState<string>('XAUUSD')

  // Calculate standard pip parameters based on pair
  const isGold = pair === 'XAUUSD'
  const pipMultiplier = isGold ? 0.10 : 0.0001
  const pipValuePerLot = 10 // Standard contract sizes for quote USD (EURUSD lot = 100k -> 1 pip = 10, XAUUSD contract = 100 -> 1 pip = 10)

  // Calculations
  const riskAmount = balance * (riskPercent / 100)
  const recommendedLotSize = Math.max(0.01, riskAmount / (slPips * pipValuePerLot))
  
  // SL & TP Targets
  const slPrice = direction === 'buy'
    ? entryPrice - (slPips * pipMultiplier)
    : entryPrice + (slPips * pipMultiplier)

  const tpPrice = direction === 'buy'
    ? entryPrice + (tpPips * pipMultiplier)
    : entryPrice - (tpPips * pipMultiplier)

  const rewardAmount = recommendedLotSize * tpPips * pipValuePerLot
  const rrRatio = slPips > 0 ? (tpPips / slPips).toFixed(2) : '0.00'

  return (
    <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 shadow-2xl relative overflow-hidden">
      
      {/* Glow Effect */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Input Form Column */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" /> Risk & Position Sizer
          </h2>
          <p className="text-xs text-[#64748B] mt-1">Configure inputs to compute institutional stop parameters and lot sizers.</p>
        </div>

        {/* Direction & Pair Selection Toggle */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Direction</label>
            <div className="flex bg-[#060A12] border border-white/5 p-1 rounded-xl">
              <button
                onClick={() => setDirection('buy')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                  direction === 'buy' ? "bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E]" : "text-[#64748B]"
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" /> BUY
              </button>
              <button
                onClick={() => setDirection('sell')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                  direction === 'sell' ? "bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444]" : "text-[#64748B]"
                )}
              >
                <TrendingDown className="w-3.5 h-3.5" /> SELL
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Trading Pair</label>
            <select
              value={pair}
              onChange={(e) => {
                setPair(e.target.value)
                setEntryPrice(e.target.value === 'XAUUSD' ? 2400.0 : e.target.value === 'EURUSD' ? 1.0850 : 1.2720)
              }}
              className="w-full bg-[#060A12] border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
            >
              <option value="XAUUSD">GOLD (XAUUSD)</option>
              <option value="EURUSD">EURUSD</option>
              <option value="GBPUSD">GBPUSD</option>
            </select>
          </div>
        </div>

        {/* Numbers Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Account Balance ($)</label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0D0D14] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors text-white font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Risk Percentage (%)</label>
            <input
              type="number"
              step="0.1"
              value={riskPercent}
              onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0D0D14] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors text-white font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Stop Loss (pips)</label>
              <span className="text-[9px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded font-bold">
                {isGold ? '1 pip = $0.10 gold' : '1 pip = 0.0001 fx'}
              </span>
            </div>
            <input
              type="number"
              value={slPips}
              onChange={(e) => setSlPips(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0D0D14] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors text-white font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Take Profit (pips)</label>
            <input
              type="number"
              value={tpPips}
              onChange={(e) => setTpPips(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0D0D14] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors text-white font-bold"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Entry Price</label>
            <input
              type="number"
              step="0.0001"
              value={entryPrice}
              onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#0D0D14] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors text-white font-bold"
            />
          </div>
        </div>
      </div>

      {/* Visual Calculations Sidebar Column */}
      <div className="bg-[#060A12] border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-inner">
        <div className="space-y-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#334155]">Calculated Outputs</p>

          {/* Recommended Lot Size Block */}
          <div className="space-y-1">
            <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Recommended Lot Size</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-primary drop-shadow-[0_0_20px_rgba(245,159,11,0.3)]">
                {recommendedLotSize.toFixed(2)}
              </span>
              <span className="text-xs text-[#64748B] font-bold">Lots</span>
            </div>
          </div>

          {/* Financial Risk Block */}
          <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
            <div>
              <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Total Cash Risk</p>
              <p className="text-lg font-black text-[#EF4444] mt-1">${riskAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Target Reward</p>
              <p className="text-lg font-black text-[#22C55E] mt-1">${rewardAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Target Levels Block */}
          <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-medium">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Stop Loss Level</span>
              <span className="font-bold text-white tabular-nums">{slPrice.toFixed(isGold ? 2 : 5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Take Profit Level</span>
              <span className="font-bold text-white tabular-nums">{tpPrice.toFixed(isGold ? 2 : 5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Risk-to-Reward Ratio</span>
              <span className="font-extrabold text-primary tabular-nums">1 : {rrRatio}</span>
            </div>
          </div>
        </div>

        {/* Warning Indicator */}
        {parseFloat(rrRatio) < 1.5 && (
          <div className="mt-6 p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl flex gap-2 items-start">
            <ShieldAlert className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#EF4444] leading-relaxed">
              <strong>Risk Warning:</strong> Your Risk/Reward is below 1:1.5. Elite traders typically seek at least 1:2 to ensure positive long-term mathematical expectancy.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function EconomicCalendarWidget() {
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [nextEvent, setNextEvent] = useState<EconomicEvent | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00')
  const [isWeekend, setIsWeekend] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  // Helper to check if current time is weekend
  const checkIsWeekend = (): boolean => {
    const now = new Date()
    const day = now.getUTCDay()
    const hours = now.getUTCHours()
    if (day === 6) return true // Saturday is fully weekend
    if (day === 5 && hours >= 22) return true // Friday night after market close (10 PM UTC)
    if (day === 0 && hours < 22) return true // Sunday before market open (10 PM UTC)
    return false
  }

  // Calculate next Sunday 22:00 UTC market open
  const getNextMarketOpen = (): Date => {
    const now = new Date()
    const nextOpen = new Date()
    const currentDay = now.getUTCDay()
    const daysUntilSunday = (7 - currentDay) % 7
    
    nextOpen.setUTCDate(now.getUTCDate() + daysUntilSunday)
    nextOpen.setUTCHours(22, 0, 0, 0)
    
    if (nextOpen.getTime() <= now.getTime()) {
      nextOpen.setUTCDate(nextOpen.getUTCDate() + 7)
    }
    return nextOpen
  }

  // Fetch live economic news from API
  useEffect(() => {
    async function loadNews() {
      setLoading(true)
      const weekendActive = checkIsWeekend()
      setIsWeekend(weekendActive)

      try {
        const res = await fetch('/api/news')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            const parsedEvents = data.map((e: any) => ({
              ...e,
              date: new Date(e.date)
            }))
            
            setEvents(parsedEvents)
            
            // Filter only upcoming events for nextEvent targeting
            const upcoming = parsedEvents.filter((e: any) => e.date.getTime() > Date.now())
            if (upcoming.length > 0) {
              setNextEvent(upcoming[0])
            } else {
              setNextEvent(null)
            }
            setLoading(false)
            return
          }
        }
      } catch (err) {
        console.error('Failed to fetch live economic news:', err)
      }

      setEvents([])
      setNextEvent(null)
      setLoading(false)
    }

    loadNews()
    
    // Check for weekend changes periodically
    const interval = setInterval(() => {
      setIsWeekend(checkIsWeekend())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      const targetTime = isWeekend ? getNextMarketOpen().getTime() : (nextEvent?.date.getTime() ?? 0)
      if (targetTime === 0) {
        setTimeLeft('—')
        return
      }

      const diff = targetTime - Date.now()
      if (diff <= 0) {
        if (isWeekend) {
          setIsWeekend(false) // Market opened!
        } else {
          // Event passed, pop to next
          const remaining = events.filter(e => e.date.getTime() > Date.now())
          if (remaining.length > 0) {
            setNextEvent(remaining[0])
          } else {
            setNextEvent(null)
            setTimeLeft('Released')
            clearInterval(timer)
          }
        }
        return
      }

      const h = Math.floor(diff / (60 * 60 * 1000))
      const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
      const s = Math.floor((diff % (60 * 1000)) / 1000)

      setTimeLeft(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      )
    }, 1000)

    return () => clearInterval(timer)
  }, [nextEvent, events, isWeekend])

  return (
    <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 shadow-2xl relative overflow-hidden">
      
      {/* Ticking Countdown Banner Column */}
      <div className={cn(
        "border rounded-2xl p-6 flex flex-col items-center justify-center text-center relative shadow-inner transition-all duration-300",
        isWeekend 
          ? "bg-[#181109] border-amber-500/25 shadow-amber-950/20" 
          : "bg-[#060A12] border-white/5"
      )}>
        {isWeekend ? (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[9px] font-black bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Market Closed
          </div>
        ) : (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[9px] font-black bg-[#22C55E]/10 text-[#22C55E] px-2 py-0.5 rounded border border-[#22C55E]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" /> LIVE STREAM
          </div>
        )}

        <Clock className={cn("w-10 h-10 mb-3 animate-[pulse_2s_infinite]", isWeekend ? "text-amber-500" : "text-primary")} />
        <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">
          {isWeekend ? "Monday Opening Countdown" : "Next Volatility Catalyst"}
        </p>
        
        <h3 className="font-extrabold text-white text-sm mt-2 px-4 truncate max-w-full">
          {isWeekend ? "Global Markets Opening Session" : (nextEvent ? nextEvent.name : 'Loading event...')}
        </h3>

        <div className={cn(
          "text-4xl md:text-5xl font-black text-transparent bg-clip-text font-mono tracking-wider mt-4",
          isWeekend
            ? "bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-600 drop-shadow-[0_0_25px_rgba(245,158,11,0.3)]"
            : "bg-gradient-to-r from-yellow-300 via-[#F59E0B] to-orange-500 drop-shadow-[0_0_25px_rgba(245,159,11,0.2)]"
        )}>
          {timeLeft}
        </div>
        <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold mt-2">Hours : Minutes : Seconds</p>
      </div>

      {/* Volatility Calendar List Column */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className={cn("w-5 h-5", isWeekend ? "text-amber-500" : "text-primary")} /> 
            {isWeekend ? "Weekly Catalyst Forecast" : "Volatility Calendar"}
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            {isWeekend 
              ? "Global financial markets are paused for the weekend. Review high-impact triggers scheduled for next week."
              : "High-impact economic indicators driving major currency swings."}
          </p>
        </div>

        <div className="space-y-3">
          {events.map((e, index) => {
            const isNext = nextEvent?.name === e.name
            return (
              <div
                key={index}
                className={cn(
                  "p-4 border rounded-xl flex items-center justify-between gap-4 transition-all hover:bg-white/2 cursor-default",
                  isNext 
                    ? (isWeekend ? "bg-amber-500/5 border-amber-500/20 shadow-md shadow-amber-500/[0.02]" : "bg-primary/5 border-primary/20 shadow-md shadow-primary/[0.03]") 
                    : "bg-[#0D0D14] border-white/5"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Impact Tag */}
                  <span
                    className={cn(
                      "text-[9px] px-2 py-0.5 rounded font-black tracking-wider border shrink-0",
                      e.impact === 'HIGH' ? "bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]" : "bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B]"
                    )}
                  >
                    {e.impact}
                  </span>
                  
                  {/* Event Meta */}
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{e.name}</p>
                    <p className="text-[10px] text-[#64748B] mt-0.5">
                      {e.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {e.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} • USD Impact
                    </p>
                  </div>
                </div>

                {/* Values Panel */}
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div className="text-xs">
                    <p className="text-[#64748B] text-[9px] uppercase tracking-wider font-semibold">Forecast</p>
                    <p className="font-bold text-white mt-0.5">{e.forecast}</p>
                  </div>
                  <div className="text-xs">
                    <p className="text-[#64748B] text-[9px] uppercase tracking-wider font-semibold">Previous</p>
                    <p className="font-bold text-[#94A3B8] mt-0.5">{e.previous}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 3. Database-Backed Pre-Trade Checklist Widget ─────────────────────────────
function PlanChecklistWidget() {
  const [checklist, setChecklist] = useState<TradingRule[]>([])
  const [newRuleLabel, setNewRuleLabel] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [adding, setAdding] = useState<boolean>(false)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  // Load custom checklist rules from public.trading_rules
  const loadChecklist = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Offline fallback: load mock checklists
      const mockRules: TradingRule[] = [
        { id: '1', rule_type: 'custom', label: 'Verified H4 and Daily trend alignment', is_active: true },
        { id: '2', rule_type: 'custom', label: 'Risk to reward exceeds 1:2 on active lot sizer', is_active: true },
        { id: '3', rule_type: 'custom', label: 'Ensured no high-impact economic data is released within 60 minutes', is_active: true },
        { id: '4', rule_type: 'custom', label: 'Accepted worst-case dollar loss limit unconditionally', is_active: true }
      ]
      setChecklist(mockRules)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('trading_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('rule_type', 'custom')
      .order('created_at', { ascending: true })

    if (!error && data) {
      setChecklist(data as TradingRule[])
    } else {
      // Local fallback
      const local = localStorage.getItem('goldbook_pretrade_checklist')
      if (local) setChecklist(JSON.parse(local))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadChecklist()
  }, [loadChecklist])

  // Sync back to local storage as fallback
  useEffect(() => {
    if (checklist.length > 0) {
      localStorage.setItem('goldbook_pretrade_checklist', JSON.stringify(checklist))
    }
  }, [checklist])

  // Toggle item completed state locally
  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Add a new checklist rule
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRuleLabel.trim()) return

    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Anonymous checklist addition
      const tempId = `temp_${Date.now()}`
      const newRuleObj: TradingRule = {
        id: tempId,
        rule_type: 'custom',
        label: newRuleLabel.trim(),
        is_active: true
      }
      setChecklist(prev => [...prev, newRuleObj])
      setNewRuleLabel('')
      setAdding(false)
      return
    }

    const newRulePayload = {
      user_id: user.id,
      rule_type: 'custom',
      label: newRuleLabel.trim(),
      is_active: true
    }

    const { data, error } = await supabase
      .from('trading_rules')
      .insert(newRulePayload)
      .select()
      .single()

    if (!error && data) {
      setChecklist(prev => [...prev, data as TradingRule])
      setNewRuleLabel('')
    }
    setAdding(false)
  }

  // Delete checklist rule
  const handleDeleteRule = async (id: string) => {
    // If it's a temporary ID, delete locally
    if (id.startsWith('temp_')) {
      setChecklist(prev => prev.filter(r => r.id !== id))
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('trading_rules').delete().eq('id', id)
    }
    
    setChecklist(prev => prev.filter(r => r.id !== id))
  }

  // Check if everything is aligned
  const allChecked = checklist.length > 0 && checklist.every(item => item.id && checkedItems[item.id])

  return (
    <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 shadow-2xl relative overflow-hidden">
      
      {/* checklist status card */}
      <div className="bg-[#060A12] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative shadow-inner">
        {allChecked ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center mx-auto text-[#22C55E] shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                PSYCHOLOGY ALIGNED
              </span>
              <h3 className="font-extrabold text-white text-base mt-4">EXECUTION APPROVED</h3>
              <p className="text-[10px] text-[#64748B] max-w-[200px] mx-auto mt-2 leading-relaxed">
                All pre-flight rules successfully verified. Open your terminal and execute with absolute clarity.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary shadow-[0_0_20px_rgba(245,159,11,0.15)]">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                PRE-FLIGHT STAGED
              </span>
              <h3 className="font-extrabold text-white text-base mt-4">SYSTEMS STAGED</h3>
              <p className="text-[10px] text-[#64748B] max-w-[200px] mx-auto mt-2 leading-relaxed">
                {checklist.length > 0
                  ? `Verify your alignment. Check off remaining ${checklist.length - Object.values(checkedItems).filter(Boolean).length} items.`
                  : 'Establish parameters by adding custom rules below.'
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* checklist manager */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-primary" /> Pre-Trade Checklist
          </h2>
          <p className="text-xs text-[#64748B] mt-1">Enforce discipline by confirming rules checklist prior to entry execution.</p>
        </div>

        {/* Add item bar */}
        <form onSubmit={handleAddRule} className="flex gap-2">
          <input
            type="text"
            value={newRuleLabel}
            onChange={(e) => setNewRuleLabel(e.target.value)}
            placeholder="Add new rule e.g. High volume session active..."
            disabled={adding}
            className="flex-1 bg-[#0D0D14] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50 placeholder:text-[#334155]"
          />
          <button
            type="submit"
            disabled={adding || !newRuleLabel.trim()}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-black font-bold rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all active:scale-95"
          >
            {adding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} ADD
          </button>
        </form>

        {/* checklist list */}
        {loading ? (
          <div className="h-40 flex items-center justify-center text-[#64748B] text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span>Loading pre-flight directives...</span>
          </div>
        ) : checklist.length === 0 ? (
          <div className="border border-dashed border-white/5 rounded-2xl py-12 text-center text-[#334155] text-xs">
            No rules registered. Setup your checklist to enforce emotional accountability.
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
            {checklist.map(item => {
              if (!item.id) return null
              const isChecked = checkedItems[item.id] || false
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id!)}
                  className={cn(
                    "p-3 bg-[#0D0D14] border rounded-xl flex items-center justify-between gap-3 group transition-all cursor-pointer",
                    isChecked ? "border-[#22C55E]/30 bg-[#22C55E]/5" : "border-white/5"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox indicator */}
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0",
                        isChecked
                          ? "bg-[#22C55E] border-[#22C55E] text-black"
                          : "border-white/10 group-hover:border-white/30"
                      )}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <span
                      className={cn(
                        "text-xs font-semibold truncate select-none transition-all",
                        isChecked ? "text-[#94A3B8] line-through decoration-white/20" : "text-white"
                      )}
                    >
                      {item.label}
                    </span>
                  </div>

                  {/* Delete trigger */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteRule(item.id!)
                    }}
                    className="p-1 rounded bg-white/0 hover:bg-white/5 text-[#64748B] hover:text-[#EF4444] opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 4. Premium Habit Tracker Widget ───────────────────────────────────────────
interface Habit {
  id: string
  name: string
}

interface HabitCompletions {
  [habitId: string]: {
    Mon?: boolean
    Tue?: boolean
    Wed?: boolean
    Thu?: boolean
    Fri?: boolean
    Sat?: boolean
    Sun?: boolean
  }
}

function HabitTrackerWidget() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<HabitCompletions>({})
  const [newHabitText, setNewHabitText] = useState('')
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null)
  const [editingHabitText, setEditingHabitText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

  // Load habits and completions
  const loadHabits = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Local fallback
      const local = localStorage.getItem('goldbook_habit_tracker')
      if (local) {
        const parsed = JSON.parse(local)
        setHabits(parsed.habits || [])
        setCompletions(parsed.completions || {})
      } else {
        const defaultHabits = [
          { id: '1', name: 'No revenge trading' },
          { id: '2', name: 'Stick to risk limit (1% max)' },
          { id: '3', name: 'Wait for checklist confirmation' },
          { id: '4', name: 'Review higher timeframe trend' },
          { id: '5', name: 'Meditated/Reset before session' }
        ]
        setHabits(defaultHabits)
        setCompletions({})
      }
      setLoading(false)
      return
    }

    // Try custom_habit_tracker column
    const { data: profile } = await supabase
      .from('profiles')
      .select('custom_habit_tracker, trading_setups')
      .eq('id', user.id)
      .single()

    if (profile?.custom_habit_tracker) {
      const data = profile.custom_habit_tracker as any
      setHabits(data.habits || [])
      setCompletions(data.completions || {})
    } else if (profile?.trading_setups && (profile.trading_setups as any).__custom_habit_tracker) {
      const data = (profile.trading_setups as any).__custom_habit_tracker
      setHabits(data.habits || [])
      setCompletions(data.completions || {})
    } else {
      // Default initial habits
      const defaultHabits = [
        { id: '1', name: 'No revenge trading' },
        { id: '2', name: 'Stick to risk limit (1% max)' },
        { id: '3', name: 'Wait for checklist confirmation' },
        { id: '4', name: 'Review higher timeframe trend' },
        { id: '5', name: 'Meditated/Reset before session' }
      ]
      setHabits(defaultHabits)
      setCompletions({})
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadHabits()
  }, [loadHabits])

  // Save utility
  const saveTracker = async (newHabits: Habit[], newCompletions: HabitCompletions) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      localStorage.setItem('goldbook_habit_tracker', JSON.stringify({ habits: newHabits, completions: newCompletions }))
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
      return
    }

    const payload = { habits: newHabits, completions: newCompletions }

    // Try updating directly
    const { error } = await supabase
      .from('profiles')
      .update({ custom_habit_tracker: payload })
      .eq('id', user.id)

    if (error) {
      // Fallback to storing in trading_setups
      const { data: profile } = await supabase.from('profiles').select('trading_setups').eq('id', user.id).single()
      const setups = profile?.trading_setups || {}
      await supabase
        .from('profiles')
        .update({
          trading_setups: { ...setups, __custom_habit_tracker: payload }
        })
        .eq('id', user.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  // Toggle habit checkbox
  const toggleDay = (habitId: string, day: typeof DAYS[number]) => {
    const newCompletions = { ...completions }
    if (!newCompletions[habitId]) {
      newCompletions[habitId] = {}
    }
    newCompletions[habitId][day] = !newCompletions[habitId][day]
    setCompletions(newCompletions)
    saveTracker(habits, newCompletions)
  }

  // Add a new custom habit
  const addHabit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHabitText.trim()) return

    const newHabitObj: Habit = {
      id: `habit_${Date.now()}`,
      name: newHabitText.trim()
    }
    const updatedHabits = [...habits, newHabitObj]
    setHabits(updatedHabits)
    setNewHabitText('')
    saveTracker(updatedHabits, completions)
  }

  // Delete habit
  const deleteHabit = (habitId: string) => {
    const updatedHabits = habits.filter(h => h.id !== habitId)
    const newCompletions = { ...completions }
    delete newCompletions[habitId]
    setHabits(updatedHabits)
    setCompletions(newCompletions)
    saveTracker(updatedHabits, newCompletions)
  }

  // Save edited habit text
  const saveEditHabit = (habitId: string) => {
    if (!editingHabitText.trim()) return
    const updatedHabits = habits.map(h => h.id === habitId ? { ...h, name: editingHabitText.trim() } : h)
    setHabits(updatedHabits)
    setEditingHabitId(null)
    setEditingHabitText('')
    saveTracker(updatedHabits, completions)
  }

  // Quick add recommended habit
  const addSuggestedHabit = (habitName: string) => {
    if (habits.some(h => h.name.toLowerCase() === habitName.toLowerCase())) return
    const newHabitObj: Habit = {
      id: `habit_${Date.now()}`,
      name: habitName
    }
    const updatedHabits = [...habits, newHabitObj]
    setHabits(updatedHabits)
    saveTracker(updatedHabits, completions)
  }

  // Reset to default professional checklist
  const resetToDefaultHabits = () => {
    if (confirm("Reset to default professional trading habits? This will not clear your past completions.")) {
      const defaultHabits = [
        { id: '1', name: 'No revenge trading' },
        { id: '2', name: 'Stick to risk limit (1% max)' },
        { id: '3', name: 'Wait for checklist confirmation' },
        { id: '4', name: 'Review higher timeframe trend' },
        { id: '5', name: 'Meditated/Reset before session' }
      ]
      setHabits(defaultHabits)
      saveTracker(defaultHabits, completions)
    }
  }

  // Statistics Computations
  const totalPossibleChecks = habits.length * 7
  const currentCheckedCount = useMemo(() => {
    let count = 0
    habits.forEach(h => {
      const hComp = completions[h.id] || {}
      DAYS.forEach(d => {
        if (hComp[d]) count++
      })
    })
    return count
  }, [habits, completions])

  const completionRate = totalPossibleChecks > 0 ? (currentCheckedCount / totalPossibleChecks) * 100 : 0

  // Day completions list
  const dayCompletions = useMemo(() => {
    return DAYS.map(d => {
      let count = 0
      habits.forEach(h => {
        const hComp = completions[h.id] || {}
        if (hComp[d]) count++
      })
      const rate = habits.length > 0 ? (count / habits.length) * 100 : 0
      return { day: d, count, rate }
    })
  }, [habits, completions])

  // Get active streak
  const currentWeekStreak = useMemo(() => {
    let streak = 0
    const now = new Date()
    const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1
    
    for (let i = currentDayIdx; i >= 0; i--) {
      const d = DAYS[i]
      const allCompleted = habits.length > 0 && habits.every(h => completions[h.id]?.[d])
      if (allCompleted) {
        streak++
      } else {
        break
      }
    }
    return streak
  }, [habits, completions])

  const disciplineGrade = useMemo(() => {
    if (completionRate >= 90) return { letter: 'A+', color: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10', glow: 'shadow-emerald-500/10' }
    if (completionRate >= 80) return { letter: 'A', color: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10', glow: 'shadow-emerald-500/10' }
    if (completionRate >= 70) return { letter: 'B+', color: 'text-cyan-400 border-cyan-500/25 bg-cyan-500/10', glow: 'shadow-cyan-500/10' }
    if (completionRate >= 60) return { letter: 'B', color: 'text-cyan-400 border-cyan-500/25 bg-cyan-500/10', glow: 'shadow-cyan-500/10' }
    if (completionRate >= 50) return { letter: 'C', color: 'text-yellow-400 border-yellow-500/25 bg-yellow-500/10', glow: 'shadow-yellow-500/10' }
    if (completionRate > 0) return { letter: 'D', color: 'text-rose-400 border-rose-500/25 bg-rose-500/10', glow: 'shadow-rose-500/10' }
    return { letter: 'F', color: 'text-[#64748B] border-white/5 bg-white/5', glow: 'shadow-none' }
  }, [completionRate])

  return (
    <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8 shadow-2xl relative overflow-hidden">
      
      {/* Visual Analytics Sidebar Column */}
      <div className="lg:col-span-1 space-y-6 bg-[#060A12] border border-white/5 rounded-2xl p-5 shadow-inner flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Discipline Metrics</span>
            {saving ? (
              <span className="text-[9px] font-bold text-primary animate-pulse">Syncing...</span>
            ) : saved ? (
              <span className="text-[9px] font-bold text-emerald-400">✓ Saved</span>
            ) : (
              <span className="text-[9px] text-[#64748B]">Saved to cloud</span>
            )}
          </div>

          {/* Grade Card */}
          <div className={cn(
            "p-5 rounded-2xl border text-center relative overflow-hidden transition-all shadow-md",
            disciplineGrade.color,
            disciplineGrade.glow
          )}>
            <Award className="w-8 h-8 mx-auto mb-1.5 opacity-60" />
            <p className="text-[9px] uppercase tracking-widest font-bold opacity-75">Weekly Grade</p>
            <h3 className="text-4xl font-black mt-1 tracking-tight">{disciplineGrade.letter}</h3>
            <p className="text-[10px] mt-2 opacity-80 leading-normal">
              {completionRate >= 80 ? "Superb psychological containment. Keep executing!" :
               completionRate >= 60 ? "Solid routine, but check for late-week mental decay." :
               completionRate > 0 ? "High risk of trade rules dilution. Enforce strict limits." :
               "Set habits below to trigger discipline grades."}
            </p>
          </div>

          {/* Streak & Completion */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0D0D14] border border-white/5 p-4 rounded-xl text-center">
              <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1.5 animate-pulse" />
              <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Week Streak</p>
              <p className="text-lg font-black text-white mt-0.5">{currentWeekStreak} day{currentWeekStreak !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-[#0D0D14] border border-white/5 p-4 rounded-xl text-center">
              <CheckSquare className="w-5 h-5 text-primary mx-auto mb-1.5" />
              <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold">Completed</p>
              <p className="text-lg font-black text-white mt-0.5">{completionRate.toFixed(0)}%</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-[#64748B] font-bold">WEEKLY TASK COMPLETION</span>
              <span className="font-bold text-white">{currentCheckedCount}/{totalPossibleChecks}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500" 
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Add habit form */}
        <form onSubmit={addHabit} className="mt-6 space-y-2 pt-4 border-t border-white/5">
          <label className="text-[10px] text-[#64748B] uppercase tracking-widest font-black font-sans">Configure Habit List</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newHabitText}
              onChange={e => setNewHabitText(e.target.value)}
              placeholder="e.g. Keep lot sizes < 1.0..."
              className="flex-1 bg-[#0D0D14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#334155] focus:outline-none focus:border-primary/50"
            />
            <button
              type="submit"
              disabled={!newHabitText.trim()}
              className="p-2 bg-primary disabled:opacity-40 text-black rounded-xl hover:bg-primary/95 transition-all flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </form>

        {/* Suggested Habits Catalog */}
        <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[#64748B] uppercase tracking-widest font-black font-sans">Recommended Habits</label>
            <button
              type="button"
              onClick={resetToDefaultHabits}
              className="text-[9px] text-primary hover:underline font-bold transition-all cursor-pointer"
            >
              Reset to Defaults
            </button>
          </div>
          
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
            {[
              {
                category: 'Risk Management',
                items: [
                  'Strict 1% max risk',
                  'Stop trading after 2 losses',
                  'Exit before high news',
                ]
              },
              {
                category: 'Psychology',
                items: [
                  'No revenge trading',
                  'Meditate before session',
                  'Accept risk unconditionally',
                ]
              },
              {
                category: 'Routine & Systems',
                items: [
                  'Review H4/Daily trend',
                  'Log setups immediately',
                  'Post-market review',
                ]
              }
            ].map(cat => (
              <div key={cat.category} className="space-y-1">
                <p className="text-[8px] text-[#334155] font-black uppercase tracking-wider">{cat.category}</p>
                <div className="flex flex-wrap gap-1">
                  {cat.items.map(item => {
                    const isAdded = habits.some(h => h.name.toLowerCase() === item.toLowerCase())
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => !isAdded && addSuggestedHabit(item)}
                        disabled={isAdded}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer",
                          isAdded
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default"
                            : "bg-[#0D0D14] border-white/5 text-[#64748B] hover:text-white hover:border-white/10"
                        )}
                      >
                        {isAdded ? '✓ ' : '+ '}
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Habits Grid Table Column */}
      <div className="lg:col-span-3 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" /> Notion Habit Checklist
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Establish routines and enforce mechanical execution rules on a daily basis. Updates save in real-time.
          </p>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center text-[#64748B] text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span>Loading routines...</span>
          </div>
        ) : habits.length === 0 ? (
          <div className="border border-dashed border-white/5 rounded-2xl py-12 text-center text-[#334155] text-xs">
            No habits configured. Create a list of daily trading habits in the sidebar to begin tracking.
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/5 rounded-2xl bg-[#0D0D14] shadow-md">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/2 text-[9px] text-[#64748B] uppercase tracking-wider">
                  <th className="py-3 px-4 font-black w-2/5">Habit / Rule</th>
                  {DAYS.map(d => (
                    <th key={d} className="py-3 px-2 font-black text-center">{d}</th>
                  ))}
                  <th className="py-3 px-3 font-black text-center w-12">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {habits.map(h => {
                  const hComp = completions[h.id] || {}
                  
                  // Calculate completions for this row
                  let rowComps = 0
                  DAYS.forEach(d => { if (hComp[d]) rowComps++ })
                  const rowPct = (rowComps / 7) * 100

                  const isEditing = editingHabitId === h.id

                  return (
                    <tr key={h.id} className="group hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white leading-normal">
                        {isEditing ? (
                          <div className="flex items-center gap-2 max-w-full">
                            <input
                              type="text"
                              value={editingHabitText}
                              onChange={e => setEditingHabitText(e.target.value)}
                              className="flex-1 min-w-0 bg-[#0D0D14] border border-primary/30 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-primary font-bold"
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEditHabit(h.id)
                                if (e.key === 'Escape') setEditingHabitId(null)
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => saveEditHabit(h.id)}
                              className="p-1 rounded bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all cursor-pointer shrink-0"
                              title="Save"
                            >
                              <Check className="w-3 h-3 stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingHabitId(null)}
                              className="p-1 rounded bg-white/5 border border-white/10 text-[#64748B] hover:text-white transition-all cursor-pointer shrink-0"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div>{h.name}</div>
                            {rowComps > 0 && (
                              <div className="text-[9px] text-[#64748B] font-mono mt-0.5">
                                {rowComps}/7 days completed ({rowPct.toFixed(0)}%)
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      
                      {DAYS.map(d => {
                        const isChecked = hComp[d] || false
                        return (
                          <td key={d} className="py-3.5 px-2 text-center">
                            <button
                              onClick={() => toggleDay(h.id, d)}
                              className={cn(
                                "w-6 h-6 mx-auto rounded-lg flex items-center justify-center border transition-all duration-200 active:scale-90 cursor-pointer",
                                isChecked
                                  ? "bg-primary border-primary text-black shadow-md shadow-primary/20"
                                  : "border-white/10 hover:border-white/30 hover:bg-white/5 text-transparent"
                              )}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </td>
                        )
                      })}

                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingHabitId(h.id)
                                setEditingHabitText(h.name)
                              }}
                              className="p-1 rounded hover:bg-primary/10 text-[#334155] hover:text-primary transition-all cursor-pointer"
                              title="Edit habit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteHabit(h.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-[#334155] hover:text-[#EF4444] transition-all cursor-pointer"
                            title="Delete habit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                
                {/* Column completion stats row */}
                <tr className="bg-white/[0.02] border-t border-white/5 text-[9px] text-[#64748B] font-black uppercase font-mono">
                  <td className="py-3.5 px-4">Daily Performance Rate</td>
                  {dayCompletions.map(dc => (
                    <td key={dc.day} className="py-3.5 px-2 text-center text-white font-mono">
                      {dc.rate.toFixed(0)}%
                    </td>
                  ))}
                  <td className="py-3.5 px-3" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
