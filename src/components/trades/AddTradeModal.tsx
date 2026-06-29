'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Check, Plus, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Portal } from '@/components/ui/Portal'
import { useMarketMode } from '@/context/MarketModeContext'

const BEFORE_EMOTIONS = [
  { value: 'confident', label: 'Confident', icon: '✨', activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]' },
  { value: 'nervous', label: 'Nervous', icon: '🌀', activeClass: 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.2)]' },
  { value: 'neutral', label: 'Neutral', icon: '😐', activeClass: 'bg-slate-500/20 border-slate-500/50 text-slate-400 shadow-[0_0_12px_rgba(100,116,139,0.2)]' },
  { value: 'excited', label: 'Excited', icon: '⚡', activeClass: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]' },
  { value: 'fearful', label: 'Fearful', icon: '😨', activeClass: 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]' },
  { value: 'greedy', label: 'Greedy', icon: '🤑', activeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]' },
]

const AFTER_EMOTIONS = [
  { value: 'satisfied', label: 'Satisfied', icon: '😊', activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]' },
  { value: 'regret', label: 'Regret', icon: '😔', activeClass: 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.2)]' },
  { value: 'neutral', label: 'Neutral', icon: '😐', activeClass: 'bg-slate-500/20 border-slate-500/50 text-slate-400 shadow-[0_0_12px_rgba(100,116,139,0.2)]' },
  { value: 'relieved', label: 'Relieved', icon: '😌', activeClass: 'bg-teal-500/20 border-teal-500/50 text-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.2)]' },
  { value: 'frustrated', label: 'Frustrated', icon: '😤', activeClass: 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]' },
  { value: 'proud', label: 'Proud', icon: '🏆', activeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]' },
]

const FOREX_PRESETS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'NAS100', 'US30', 'BTCUSD']
const INDIAN_PRESETS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'HDFCBANK']

const LOT_SIZES_HINTS: Record<string, string> = {
  NIFTY: '1 lot = 65 shares (NSE standard)',
  BANKNIFTY: '1 lot = 30 shares',
  FINNIFTY: '1 lot = 60 shares',
  MIDCPNIFTY: '1 lot = 120 shares',
  SENSEX: '1 lot = 20 shares'
}

function formatToDatetimeLocal(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const offset = d.getTimezoneOffset()
    const localDate = new Date(d.getTime() - offset * 60 * 1000)
    return localDate.toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

interface AddTradeModalProps {
  onClose: () => void
  onSaved: () => void
  accountId?: string
  trade?: any // For Edit Mode
}

export function AddTradeModal({ onClose, onSaved, accountId, trade }: AddTradeModalProps) {
  const { isIndian, currencySymbol } = useMarketMode()
  const isEditMode = !!trade

  const [direction, setDirection] = useState<'buy' | 'sell'>(trade?.direction || 'buy')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [profileChecklist, setProfileChecklist] = useState<string[]>([])
  const [profileSetups, setProfileSetups] = useState<{name: string, description: string}[]>([])

  // Indian Specific fields
  const [instrumentType, setInstrumentType] = useState<'spot' | 'equity' | 'options' | 'futures'>(
    trade?.instrument_type || (isIndian ? 'options' : 'spot')
  )
  const [optionType, setOptionType] = useState<'CE' | 'PE'>(trade?.option_type || 'CE')
  const [strikePrice, setStrikePrice] = useState(trade?.strike_price?.toString() || '')
  const [expiryDate, setExpiryDate] = useState(trade?.expiry_date || '')
  const [spotPriceEntry, setSpotPriceEntry] = useState(trade?.spot_price_entry?.toString() || '')
  const [spotPriceExit, setSpotPriceExit] = useState(trade?.spot_price_exit?.toString() || '')
  const [indiaVix, setIndiaVix] = useState(trade?.india_vix?.toString() || '')
  const [brokerage, setBrokerage] = useState(trade?.brokerage?.toString() || '20')
  const [stt, setStt] = useState(trade?.stt?.toString() || '')
  const [otherCharges, setOtherCharges] = useState(trade?.other_charges?.toString() || '')

  // Manual P&L Override Toggle
  const [useManualPnl, setUseManualPnl] = useState(
    trade?.net_profit !== null && 
    (trade?.source === 'manual' || trade?.source === 'csv_import') &&
    (trade?.brokerage > 0 || trade?.stt > 0 || trade?.other_charges > 0 || trade?.symbol !== 'XAUUSD')
  )
  const [manualPnl, setManualPnl] = useState(trade?.gross_profit?.toString() || '')

  // Custom emotions
  const [customEmotionBefore, setCustomEmotionBefore] = useState('')
  const [showCustomBefore, setShowCustomBefore] = useState(false)
  const [customEmotionAfter, setCustomEmotionAfter] = useState('')
  const [showCustomAfter, setShowCustomAfter] = useState(false)

  const now = format(new Date(), "yyyy-MM-dd'T'HH:mm")

  const [form, setForm] = useState({
    symbol: trade?.symbol || (isIndian ? 'NIFTY' : 'XAUUSD'),
    lot_size: trade?.lot_size?.toString() || '1',
    entry_price: trade?.entry_price?.toString() || '',
    exit_price: trade?.exit_price?.toString() || '',
    open_time: formatToDatetimeLocal(trade?.open_time) || now,
    close_time: formatToDatetimeLocal(trade?.close_time) || '',
    sl: trade?.sl?.toString() || '',
    tp: trade?.tp?.toString() || '',
    notes: trade?.notes || '',
    setup_tag: trade?.setup_tag || '',
    emotion_before: trade?.emotion_before || '',
    emotion_after: trade?.emotion_after || '',
    rating: trade?.rating?.toString() || '0',
  })

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('pre_trade_checklist, trading_setups').eq('id', user.id).single()
      
      if (data?.pre_trade_checklist) {
        setProfileChecklist(data.pre_trade_checklist)
        // If edit mode, load trade's checklist, otherwise default to all checked
        if (isEditMode && trade?.pre_trade_checklist) {
          setChecks(trade.pre_trade_checklist)
        } else {
          setChecks(Object.fromEntries(data.pre_trade_checklist.map((c: string) => [c, true])))
        }
      } else {
        const def = [
          'Checked higher timeframe',
          'Risk within limits',
          'Fits my trading plan',
          'Key levels identified',
          'Economic calendar checked'
        ]
        setProfileChecklist(def)
        if (isEditMode && trade?.pre_trade_checklist) {
          setChecks(trade.pre_trade_checklist)
        } else {
          setChecks(Object.fromEntries(def.map((c: string) => [c, true])))
        }
      }
      
      if (data?.trading_setups) {
        setProfileSetups(data.trading_setups)
      }
    }
    load()

    // Handle initial custom emotion loading
    if (trade?.emotion_before && !BEFORE_EMOTIONS.some(e => e.value === trade.emotion_before)) {
      setCustomEmotionBefore(trade.emotion_before)
      setShowCustomBefore(true)
      f('emotion_before', trade.emotion_before)
    }
    if (trade?.emotion_after && !AFTER_EMOTIONS.some(e => e.value === trade.emotion_after)) {
      setCustomEmotionAfter(trade.emotion_after)
      setShowCustomAfter(true)
      f('emotion_after', trade.emotion_after)
    }
  }, [isEditMode, trade])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      tradeId: trade?.id, // Only used in PUT
      account_id: accountId ?? null,
      symbol: form.symbol,
      direction,
      lot_size: parseFloat(form.lot_size),
      entry_price: parseFloat(form.entry_price),
      exit_price: form.exit_price ? parseFloat(form.exit_price) : undefined,
      open_time: new Date(form.open_time).toISOString(),
      close_time: form.close_time ? new Date(form.close_time).toISOString() : undefined,
      sl: form.sl ? parseFloat(form.sl) : undefined,
      tp: form.tp ? parseFloat(form.tp) : undefined,
      notes: form.notes,
      setup_tag: form.setup_tag,
      pre_trade_checklist: checks,
      emotion_before: form.emotion_before || undefined,
      emotion_after: form.emotion_after || undefined,
      rating: form.rating && parseInt(form.rating) > 0 ? parseInt(form.rating) : undefined,
      // Indian specific fields
      instrument_type: instrumentType,
      option_type: instrumentType === 'options' ? optionType : undefined,
      strike_price: instrumentType === 'options' && strikePrice ? parseFloat(strikePrice) : undefined,
      expiry_date: (instrumentType === 'options' || instrumentType === 'futures') && expiryDate ? expiryDate : undefined,
      spot_price_entry: spotPriceEntry ? parseFloat(spotPriceEntry) : undefined,
      spot_price_exit: spotPriceExit ? parseFloat(spotPriceExit) : undefined,
      india_vix: indiaVix ? parseFloat(indiaVix) : undefined,
      brokerage: brokerage ? parseFloat(brokerage) : 0,
      stt: stt ? parseFloat(stt) : 0,
      other_charges: otherCharges ? parseFloat(otherCharges) : 0,
      manual_pnl: useManualPnl && manualPnl ? parseFloat(manualPnl) : undefined,
      currency: isIndian ? 'INR' : 'USD'
    }

    const endpoint = isEditMode ? '/api/trades/manual/edit' : '/api/trades/manual'
    const method = isEditMode ? 'PUT' : 'POST'

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    setLoading(false)
    onSaved()
  }

  const presets = isIndian ? INDIAN_PRESETS : FOREX_PRESETS

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-[#0D1421] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            {isEditMode ? <Edit3 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />} 
            {isEditMode ? 'Edit Trade' : 'Add Trade'} {isIndian && '(Indian Markets)'}
          </h2>
          <button onClick={onClose} className="text-[#64748B] hover:text-foreground transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Long / Short toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setDirection('buy')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                direction === 'buy' ? 'bg-[#22C55E] text-white shadow-lg' : 'text-[#64748B] hover:text-foreground'
              )}
            >
              <TrendingUp className="w-4 h-4" /> Long
            </button>
            <button
              type="button"
              onClick={() => setDirection('sell')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                direction === 'sell' ? 'bg-[#EF4444] text-white shadow-lg' : 'text-[#64748B] hover:text-foreground'
              )}
            >
              <TrendingDown className="w-4 h-4" /> Short
            </button>
          </div>

          {/* Instrument segment toggle if Indian */}
          {isIndian && (
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Trading Segment</Label>
              <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                {(['equity', 'options', 'futures'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setInstrumentType(type)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer',
                      instrumentType === type 
                        ? 'bg-primary text-black shadow-md' 
                        : 'text-[#64748B] hover:text-white'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Symbol chips selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#64748B] uppercase tracking-wider">Quick Symbols</Label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map(sym => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => f('symbol', sym)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer',
                    form.symbol === sym 
                      ? 'bg-primary/20 border border-primary/45 text-primary' 
                      : 'bg-white/5 text-[#64748B] hover:text-white border border-transparent'
                  )}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Symbol + Lot Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Symbol</Label>
              <Input
                value={form.symbol}
                onChange={e => f('symbol', e.target.value.toUpperCase())}
                className="bg-white/5 border-white/10 h-11"
                placeholder={isIndian ? 'NIFTY' : 'XAUUSD'}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">
                {isIndian ? 'Quantity / Lots' : 'Quantity (Lots)'}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.lot_size}
                onChange={e => f('lot_size', e.target.value)}
                className="bg-white/5 border-white/10 h-11"
                required
              />
              {isIndian && LOT_SIZES_HINTS[form.symbol] && (
                <span className="text-[10px] text-primary/75 block leading-tight">
                  {LOT_SIZES_HINTS[form.symbol]}
                </span>
              )}
            </div>
          </div>

          {/* F&O Fields for Indian Option */}
          {isIndian && instrumentType === 'options' && (
            <div className="grid grid-cols-2 gap-4 p-4 border border-white/5 bg-white/[0.02] rounded-xl animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#64748B] uppercase tracking-wider">Option Type</Label>
                <div className="flex bg-[#060A12] border border-white/10 rounded-lg p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setOptionType('CE')}
                    className={cn(
                      'flex-1 py-1 rounded-md text-xs font-black transition-all cursor-pointer',
                      optionType === 'CE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-[#64748B] hover:text-white'
                    )}
                  >
                    CE (Call)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptionType('PE')}
                    className={cn(
                      'flex-1 py-1 rounded-md text-xs font-black transition-all cursor-pointer',
                      optionType === 'PE' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-[#64748B] hover:text-white'
                    )}
                  >
                    PE (Put)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#64748B] uppercase tracking-wider">Strike Price</Label>
                <Input
                  type="number"
                  value={strikePrice}
                  onChange={e => setStrikePrice(e.target.value)}
                  className="bg-white/5 border-white/10 h-9"
                  placeholder="24500"
                  required
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-[#64748B] uppercase tracking-wider">Expiry Date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="bg-white/5 border-white/10 h-9 [color-scheme:dark]"
                  required
                />
              </div>
            </div>
          )}

          {/* F&O Fields for Indian Futures */}
          {isIndian && instrumentType === 'futures' && (
            <div className="space-y-1.5 p-4 border border-white/5 bg-white/[0.02] rounded-xl animate-in fade-in duration-200">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Contract Expiry Date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="bg-white/5 border-white/10 h-9 [color-scheme:dark]"
                required
              />
            </div>
          )}

          {/* Entry + Exit Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">
                {isIndian && (instrumentType === 'options' || instrumentType === 'futures') ? 'Entry Premium' : 'Entry Price'}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.entry_price}
                onChange={e => f('entry_price', e.target.value)}
                className="bg-white/5 border-white/10 h-11"
                placeholder={isIndian ? "150.00" : "2024.50"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">
                {isIndian && (instrumentType === 'options' || instrumentType === 'futures') ? 'Exit Premium' : 'Exit Price'}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.exit_price}
                onChange={e => f('exit_price', e.target.value)}
                className="bg-white/5 border-white/10 h-11"
                placeholder={isIndian ? "220.00" : "2030.00"}
              />
            </div>
          </div>

          {/* Spot price inputs for Indian derivatives */}
          {isIndian && (instrumentType === 'options' || instrumentType === 'futures') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#64748B] uppercase tracking-wider">Spot Price (Entry)</Label>
                <Input
                  type="number"
                  step="0.05"
                  value={spotPriceEntry}
                  onChange={e => setSpotPriceEntry(e.target.value)}
                  className="bg-white/5 border-white/10 h-9"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#64748B] uppercase tracking-wider">Spot Price (Exit)</Label>
                <Input
                  type="number"
                  step="0.05"
                  value={spotPriceExit}
                  onChange={e => setSpotPriceExit(e.target.value)}
                  className="bg-white/5 border-white/10 h-9"
                  placeholder="Optional"
                />
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Entry Time</Label>
              <Input
                type="datetime-local"
                value={form.open_time}
                onChange={e => f('open_time', e.target.value)}
                className="bg-white/5 border-white/10 h-11 [color-scheme:dark]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Exit Time</Label>
              <Input
                type="datetime-local"
                value={form.close_time}
                onChange={e => f('close_time', e.target.value)}
                className="bg-white/5 border-white/10 h-11 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* SL + TP */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#EF4444]/70 uppercase tracking-wider">Stop Loss</Label>
              <Input type="number" step="0.01" value={form.sl} onChange={e => f('sl', e.target.value)} className="bg-white/5 border-[#EF4444]/20 h-11" placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#22C55E]/70 uppercase tracking-wider">Take Profit</Label>
              <Input type="number" step="0.01" value={form.tp} onChange={e => f('tp', e.target.value)} className="bg-white/5 border-[#22C55E]/20 h-11" placeholder="Optional" />
            </div>
          </div>

          {/* Indian specific charges & manual pnl override */}
          {isIndian && (
            <div className="space-y-4 border-t border-white/5 pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-white uppercase tracking-wider">Charges & Override</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="manualPnlToggle"
                    checked={useManualPnl}
                    onChange={e => setUseManualPnl(e.target.checked)}
                    className="rounded border-white/10 bg-white/5 text-primary focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <Label htmlFor="manualPnlToggle" className="text-xs text-[#64748B] cursor-pointer">Override P&L manually</Label>
                </div>
              </div>

              {useManualPnl ? (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                  <Label className="text-xs text-[#F59E0B] uppercase tracking-wider">Manual Net Profit / Loss ({currencySymbol})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={manualPnl}
                    onChange={e => setManualPnl(e.target.value)}
                    className="bg-white/5 border-white/10 h-11 font-mono text-white"
                    placeholder="e.g. 4550.00"
                    required
                  />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 animate-in slide-in-from-top-1 duration-150">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#64748B] uppercase tracking-wider">Brokerage (₹)</Label>
                    <Input
                      type="number"
                      value={brokerage}
                      onChange={e => setBrokerage(e.target.value)}
                      className="bg-white/5 border-white/10 h-9 font-mono text-xs"
                      placeholder="20"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#64748B] uppercase tracking-wider">STT (₹)</Label>
                    <Input
                      type="number"
                      value={stt}
                      onChange={e => setStt(e.target.value)}
                      className="bg-white/5 border-white/10 h-9 font-mono text-xs"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#64748B] uppercase tracking-wider">Other Fees (₹)</Label>
                    <Input
                      type="number"
                      value={otherCharges}
                      onChange={e => setOtherCharges(e.target.value)}
                      className="bg-white/5 border-white/10 h-9 font-mono text-xs"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Forex manual P&L override fallback */}
          {!isIndian && form.symbol !== 'XAUUSD' && (
            <div className="space-y-3 border-t border-white/5 pt-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[#64748B] uppercase tracking-wider">Forex Pip Override</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="manualPnlToggleForex"
                    checked={useManualPnl}
                    onChange={e => setUseManualPnl(e.target.checked)}
                    className="rounded border-white/10 bg-white/5 text-primary focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <Label htmlFor="manualPnlToggleForex" className="text-xs text-[#64748B] cursor-pointer">Override P&L manually</Label>
                </div>
              </div>

              {useManualPnl && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                  <Label className="text-xs text-[#F59E0B] uppercase tracking-wider">Manual Net P&L ({currencySymbol})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={manualPnl}
                    onChange={e => setManualPnl(e.target.value)}
                    className="bg-white/5 border-white/10 h-11 font-mono text-white"
                    placeholder="e.g. 150.00"
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* Psychological State Tracking */}
          <div className="space-y-4 border-t border-white/5 pt-4">
            <Label className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider block">Psychological Mood Tracker</Label>
            
            <div className="space-y-2.5">
              <Label className="text-[11px] text-[#64748B] uppercase tracking-wider block">Emotion Before Execution</Label>
              <div className="grid grid-cols-3 gap-2">
                {BEFORE_EMOTIONS.map(em => {
                  const isSelected = form.emotion_before === em.value
                  return (
                    <button
                      key={em.value}
                      type="button"
                      onClick={() => { f('emotion_before', em.value); setShowCustomBefore(false) }}
                      className={cn(
                        'px-2 py-2.5 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer',
                        isSelected && !showCustomBefore
                          ? em.activeClass
                          : 'bg-white/5 border-white/5 text-[#64748B] hover:bg-white/10 hover:text-white hover:border-white/10'
                      )}
                    >
                      <span className="text-base">{em.icon}</span>
                      <span>{em.label}</span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => { setShowCustomBefore(true); f('emotion_before', customEmotionBefore) }}
                  className={cn(
                    'px-2 py-2.5 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer',
                    showCustomBefore
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-white/5 border-white/5 text-[#64748B] hover:bg-white/10 hover:text-white hover:border-white/10'
                  )}
                >
                  <span className="text-base">💭</span>
                  <span>{customEmotionBefore ? 'Other: ' + customEmotionBefore : 'Other...'}</span>
                </button>
              </div>

              {showCustomBefore && (
                <div className="pt-1.5 animate-in slide-in-from-top-1 duration-150">
                  <Input
                    value={customEmotionBefore}
                    onChange={e => { setCustomEmotionBefore(e.target.value); f('emotion_before', e.target.value) }}
                    placeholder="Type custom mood (e.g. Overtrading, Distracted)..."
                    className="bg-white/5 border-white/10 h-10 text-xs"
                    required
                  />
                </div>
              )}
            </div>

            {/* Display post-trade emotions and rating only if trade is closed */}
            {form.exit_price && (
              <div className="space-y-4 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-2.5">
                  <Label className="text-[11px] text-[#64748B] uppercase tracking-wider block">Emotion After Close</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {AFTER_EMOTIONS.map(em => {
                      const isSelected = form.emotion_after === em.value
                      return (
                        <button
                          key={em.value}
                          type="button"
                          onClick={() => { f('emotion_after', em.value); setShowCustomAfter(false) }}
                          className={cn(
                            'px-2 py-2.5 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer',
                            isSelected && !showCustomAfter
                              ? em.activeClass
                              : 'bg-white/5 border-white/5 text-[#64748B] hover:bg-white/10 hover:text-white hover:border-white/10'
                      )}
                    >
                      <span className="text-base">{em.icon}</span>
                      <span>{em.label}</span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => { setShowCustomAfter(true); f('emotion_after', customEmotionAfter) }}
                  className={cn(
                    'px-2 py-2.5 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer',
                    showCustomAfter
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-white/5 border-white/5 text-[#64748B] hover:bg-white/10 hover:text-white hover:border-white/10'
                  )}
                >
                  <span className="text-base">💭</span>
                  <span>{customEmotionAfter ? 'Other: ' + customEmotionAfter : 'Other...'}</span>
                </button>
              </div>

              {showCustomAfter && (
                <div className="pt-1.5 animate-in slide-in-from-top-1 duration-150">
                  <Input
                    value={customEmotionAfter}
                    onChange={e => { setCustomEmotionAfter(e.target.value); f('emotion_after', e.target.value) }}
                    placeholder="Type custom mood (e.g. Relieved, Disappointed)..."
                    className="bg-white/5 border-white/10 h-10 text-xs"
                    required
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] text-[#64748B] uppercase tracking-wider block">Trade Execution Rating (1-5)</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => f('rating', star.toString())}
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold transition-all cursor-pointer',
                      parseInt(form.rating) >= star
                        ? 'bg-[#F59E0B] text-black shadow-[0_0_12px_rgba(245,159,11,0.4)]'
                        : 'bg-white/5 border border-white/5 text-[#64748B] hover:bg-white/10 hover:text-white'
                    )}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

          {/* Pre-Trade Checklist */}
          <div className="space-y-2">
            <button
              type="button"
              className="text-xs text-[#64748B] uppercase tracking-wider flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
            >
              ↓ Pre-Trade Checklist (Optional)
            </button>
            <div className="space-y-2">
              {profileChecklist.length === 0 ? (
                <p className="text-xs text-[#64748B]">No checklist items configured in Settings.</p>
              ) : (
                profileChecklist.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setChecks(p => ({ ...p, [item]: !p[item] }))}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm transition-all cursor-pointer',
                      checks[item]
                        ? 'border-[#22C55E]/30 bg-[#22C55E]/10 text-foreground'
                        : 'border-white/5 bg-white/2 text-[#64748B]'
                    )}
                  >
                    <div className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0', checks[item] ? 'bg-[#22C55E]' : 'bg-white/5')}>
                      {checks[item] && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {item}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Setup Tag */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#64748B] uppercase tracking-wider">Setup / Strategy</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {profileSetups.map(s => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => f('setup_tag', s.name)}
                  title={s.description}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                    form.setup_tag === s.name ? 'bg-primary text-white' : 'bg-white/5 text-[#64748B] hover:text-white'
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <Input
              value={form.setup_tag}
              onChange={e => f('setup_tag', e.target.value)}
              className="bg-white/5 border-white/10 h-11"
              placeholder="Or type a custom setup..."
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#64748B] uppercase tracking-wider">Notes</Label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Trade rationale, entry/exit notes..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Tip Banner */}
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-center">
            <p className="text-[10px] text-[#64748B] leading-relaxed">
              💡 <strong>Elite Tip:</strong> You can paste TradingView screenshots (Ctrl+V), track emotional states, and set discipline ratings directly inside your <strong>Journal</strong> page once this trade is logged!
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 border-white/10 bg-transparent cursor-pointer" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary/90 cursor-pointer text-black font-bold">
              {loading ? 'Saving...' : isEditMode ? 'Update Trade' : 'Save Trade'}
            </Button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  )
}
