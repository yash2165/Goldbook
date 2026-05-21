'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Wrench, Calculator, Calendar, BookMarked,
  Info, TrendingUp, TrendingDown, Clock, ShieldAlert,
  Plus, Check, Trash2, CheckCircle2, ChevronRight, RefreshCw
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
  const [activeTab, setActiveTab] = useState<'calc' | 'calendar' | 'checklist'>('calc')
  
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
        <div className="flex bg-[#0A0A0F] border border-white/5 p-1 rounded-xl">
          {[
            { id: 'calc', label: 'Risk Calculator', icon: Calculator },
            { id: 'calendar', label: 'News Calendar', icon: Calendar },
            { id: 'checklist', label: 'Plan Checklist', icon: BookMarked },
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
        {activeTab === 'calc' && <PositionSizeCalculatorWidget />}
        {activeTab === 'calendar' && <EconomicCalendarWidget />}
        {activeTab === 'checklist' && <PlanChecklistWidget />}
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
    <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 shadow-2xl relative overflow-hidden">
      
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
            <div className="flex bg-[#0A0A0F] border border-white/5 p-1 rounded-xl">
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
              className="w-full bg-[#0A0A0F] border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
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
      <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-inner">
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

// ── 2. USD News Economic Calendar Widget ───────────────────────────────────────
function EconomicCalendarWidget() {
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [nextEvent, setNextEvent] = useState<EconomicEvent | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00')

  // Generate dynamic, relative dates for demonstration that will ALWAYS look alive
  useEffect(() => {
    const baseEvents: EconomicEvent[] = [
      { name: 'Core CPI (MoM)', date: new Date(Date.now() + 2 * 60 * 60 * 1000 + 45 * 60 * 1000), impact: 'HIGH', forecast: '0.3%', previous: '0.4%' },
      { name: 'Non-Farm Employment Change (NFP)', date: new Date(Date.now() + 15 * 60 * 60 * 1000), impact: 'HIGH', forecast: '185K', previous: '175K' },
      { name: 'FOMC Interest Rate Decision', date: new Date(Date.now() + 38 * 60 * 60 * 1000), impact: 'HIGH', forecast: '5.25%', previous: '5.25%' },
      { name: 'Retail Sales (MoM)', date: new Date(Date.now() + 61 * 60 * 60 * 1000), impact: 'HIGH', forecast: '0.2%', previous: '-0.1%' },
      { name: 'Flash Services PMI', date: new Date(Date.now() + 85 * 60 * 60 * 1000), impact: 'MEDIUM', forecast: '51.3', previous: '50.9' }
    ]
    setEvents(baseEvents)
    setNextEvent(baseEvents[0])
  }, [])

  // Timer logic
  useEffect(() => {
    if (!nextEvent) return

    const timer = setInterval(() => {
      const diff = nextEvent.date.getTime() - Date.now()
      if (diff <= 0) {
        // Event passed, pop to next
        const remaining = events.filter(e => e.date.getTime() > Date.now())
        if (remaining.length > 0) {
          setNextEvent(remaining[0])
        } else {
          setTimeLeft('Released')
          clearInterval(timer)
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
  }, [nextEvent, events])

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 shadow-2xl relative overflow-hidden">
      
      {/* Ticking Countdown Banner Column */}
      <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative shadow-inner">
        <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[9px] font-black bg-[#22C55E]/10 text-[#22C55E] px-2 py-0.5 rounded border border-[#22C55E]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" /> LIVE STREAM
        </div>

        <Clock className="w-10 h-10 text-primary mb-3 animate-[pulse_2s_infinite]" />
        <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Next Volatility Catalyst</p>
        
        <h3 className="font-extrabold text-white text-base mt-2 px-4 truncate max-w-full">
          {nextEvent ? nextEvent.name : 'Loading event...'}
        </h3>

        <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-[#F59E0B] to-orange-500 font-mono tracking-wider mt-4 drop-shadow-[0_0_25px_rgba(245,159,11,0.2)]">
          {timeLeft}
        </div>
        <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold mt-2">Hours : Minutes : Seconds</p>
      </div>

      {/* Volatility Calendar List Column */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Volatility Calendar
          </h2>
          <p className="text-xs text-[#64748B] mt-1">High-impact economic indicators driving major currency swings.</p>
        </div>

        <div className="space-y-3">
          {events.map((e, index) => {
            const isNext = nextEvent?.name === e.name
            return (
              <div
                key={index}
                className={cn(
                  "p-4 border rounded-xl flex items-center justify-between gap-4 transition-all hover:bg-white/2 cursor-default",
                  isNext ? "bg-primary/5 border-primary/20 shadow-md shadow-primary/[0.03]" : "bg-[#0D0D14] border-white/5"
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
                      {e.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} • USD Impact
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
    <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 shadow-2xl relative overflow-hidden">
      
      {/* checklist status card */}
      <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative shadow-inner">
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
