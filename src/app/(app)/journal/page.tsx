'use client'

import { useState } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { getClosedTrades, fmt } from '@/lib/calculations'
import { format } from 'date-fns'
import { BookOpen, TrendingUp, TrendingDown, Save, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function JournalPage() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const closed = getClosedTrades(trades)
  
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = closed.find(t => t.id === selectedId)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  // Form state
  const [notes, setNotes] = useState('')
  const [setupTag, setSetupTag] = useState('')
  const [emotionBefore, setEmotionBefore] = useState('')
  const [emotionAfter, setEmotionAfter] = useState('')
  const [rating, setRating] = useState<number>(0)

  // Load state when selecting trade
  const selectTrade = (id: string) => {
    setSelectedId(id)
    const t = closed.find(x => x.id === id)
    if (t) {
      setNotes(t.notes || '')
      setSetupTag(t.setup_tag || '')
      setEmotionBefore(t.emotion_before || '')
      setEmotionAfter(t.emotion_after || '')
      setRating(t.rating || 0)
      setSaved(false)
    }
  }

  const saveJournal = async () => {
    if (!selected) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('trades').update({
      notes,
      setup_tag: setupTag,
      emotion_before: emotionBefore,
      emotion_after: emotionAfter,
      rating
    }).eq('id', selected.id)
    
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <BookOpen className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Trade Journal</h1>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left: Trade List */}
        <div className="w-80 flex flex-col bg-[#12121a] border border-white/5 rounded-xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <h2 className="font-semibold text-sm">Closed Trades</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-[#64748B] text-sm">Loading...</div>
            ) : closed.length === 0 ? (
              <div className="p-8 text-center text-[#64748B] text-sm">No closed trades yet</div>
            ) : (
              <div className="divide-y divide-white/[0.02]">
                {closed.map(t => (
                  <button
                    key={t.id}
                    onClick={() => selectTrade(t.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors',
                      selectedId === t.id && 'bg-primary/5 border-l-2 border-primary'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{t.symbol}</span>
                      <span className={cn('text-xs font-bold tabular-nums', (t.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                        {fmt(t.net_profit ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                      <span>{t.close_time ? format(new Date(t.close_time), 'MMM dd, HH:mm') : '—'}</span>
                      <span className="flex items-center gap-1">
                        {t.direction === 'buy' ? <TrendingUp className="w-3 h-3 text-[#22C55E]" /> : <TrendingDown className="w-3 h-3 text-[#EF4444]" />}
                        {t.direction.toUpperCase()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Journal Editor */}
        <div className="flex-1 flex flex-col bg-[#12121a] border border-white/5 rounded-xl overflow-hidden min-h-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-[#64748B] text-sm flex-col gap-4">
              <BookOpen className="w-12 h-12 opacity-20" />
              <p>Select a trade to write your journal entry</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Trade Header */}
              <div className="flex items-center justify-between pb-6 border-b border-white/5">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-3">
                    {selected.symbol}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold', selected.direction === 'buy' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]')}>
                      {selected.direction.toUpperCase()}
                    </span>
                  </h2>
                  <p className="text-sm text-[#64748B] mt-1">
                    Closed: {selected.close_time ? format(new Date(selected.close_time), 'MMM dd, yyyy HH:mm') : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('text-3xl font-black tabular-nums', (selected.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                    {fmt(selected.net_profit ?? 0)}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    Entry: {selected.entry_price} → Exit: {selected.exit_price}
                  </p>
                </div>
              </div>

              {/* Journal Form */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left col */}
                <div className="space-y-5">
                  <div>
                    <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-1.5 block">Setup Tag / Strategy</label>
                    <input
                      value={setupTag}
                      onChange={e => setSetupTag(e.target.value)}
                      placeholder="e.g. Breakout, Pullback, Liquidity Sweep"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-1.5 block">Emotion Before Trade</label>
                    <input
                      value={emotionBefore}
                      onChange={e => setEmotionBefore(e.target.value)}
                      placeholder="e.g. Confident, Anxious, FOMO"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-1.5 block">Emotion After Trade</label>
                    <input
                      value={emotionAfter}
                      onChange={e => setEmotionAfter(e.target.value)}
                      placeholder="e.g. Relieved, Frustrated, Calm"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-1.5 block">Trade Rating (1-5)</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors',
                            rating >= star ? 'bg-[#F59E0B] text-black' : 'bg-white/5 text-[#64748B] hover:bg-white/10'
                          )}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right col */}
                <div className="flex flex-col h-full">
                  <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-1.5 block">Trade Notes / Lessons</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="What did you learn? Did you follow your rules? What could you have done better?"
                    className="flex-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end">
                <button
                  onClick={saveJournal}
                  disabled={saving}
                  className={cn(
                    'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    saved ? 'bg-[#22C55E] text-white' : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'
                  )}
                >
                  {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Entry</>}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
