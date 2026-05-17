'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AddTradeModalProps {
  onClose: () => void
  onSaved: () => void
  accountId?: string
}

export function AddTradeModal({ onClose, onSaved, accountId }: AddTradeModalProps) {
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [profileChecklist, setProfileChecklist] = useState<string[]>([])
  const [profileSetups, setProfileSetups] = useState<{name: string, description: string}[]>([])
  
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('pre_trade_checklist, trading_setups').eq('id', user.id).single()
      if (data?.pre_trade_checklist) {
        setProfileChecklist(data.pre_trade_checklist)
        setChecks(Object.fromEntries(data.pre_trade_checklist.map((c: string) => [c, true])))
      } else {
        const def = [
          'Checked higher timeframe',
          'Risk within limits',
          'Fits my trading plan',
          'Key levels identified',
          'Economic calendar checked'
        ]
        setProfileChecklist(def)
        setChecks(Object.fromEntries(def.map((c: string) => [c, true])))
      }
      if (data?.trading_setups) {
        setProfileSetups(data.trading_setups)
      }
    }
    load()
  }, [])

  const now = format(new Date(), "yyyy-MM-dd'T'HH:mm")

  const [form, setForm] = useState({
    symbol: 'XAUUSD',
    lot_size: '1',
    entry_price: '',
    exit_price: '',
    open_time: now,
    close_time: '',
    sl: '',
    tp: '',
    notes: '',
    setup_tag: '',
  })

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/trades/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    setLoading(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#12121a] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Add Trade
          </h2>
          <button onClick={onClose} className="text-[#64748B] hover:text-foreground transition-colors">
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
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
                direction === 'buy' ? 'bg-[#22C55E] text-white shadow-lg' : 'text-[#64748B] hover:text-foreground'
              )}
            >
              <TrendingUp className="w-4 h-4" /> Long
            </button>
            <button
              type="button"
              onClick={() => setDirection('sell')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
                direction === 'sell' ? 'bg-[#EF4444] text-white shadow-lg' : 'text-[#64748B] hover:text-foreground'
              )}
            >
              <TrendingDown className="w-4 h-4" /> Short
            </button>
          </div>

          {/* Symbol + Lot Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Symbol</Label>
              <Input
                value={form.symbol}
                onChange={e => f('symbol', e.target.value.toUpperCase())}
                className="bg-white/5 border-white/10 h-11"
                placeholder="XAUUSD"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Quantity (Lots)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.lot_size}
                onChange={e => f('lot_size', e.target.value)}
                className="bg-white/5 border-white/10 h-11"
                required
              />
            </div>
          </div>

          {/* Entry + Exit Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Entry Price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.entry_price}
                onChange={e => f('entry_price', e.target.value)}
                className="bg-white/5 border-white/10 h-11"
                placeholder="2024.50"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Exit Price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.exit_price}
                onChange={e => f('exit_price', e.target.value)}
                className="bg-white/5 border-white/10 h-11"
                placeholder="2030.00"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Entry Date</Label>
              <Input
                type="datetime-local"
                value={form.open_time}
                onChange={e => f('open_time', e.target.value)}
                className="bg-white/5 border-white/10 h-11 [color-scheme:dark]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Exit Date</Label>
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

          {/* Pre-Trade Checklist */}
          <div className="space-y-2">
            <button
              type="button"
              className="text-xs text-[#64748B] uppercase tracking-wider flex items-center gap-2 hover:text-foreground transition-colors"
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
                      'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm transition-all',
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
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
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

          {error && (
            <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 border-white/10 bg-transparent" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary/90">
              {loading ? 'Saving...' : 'Save Trade'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Fix missing import
function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}
