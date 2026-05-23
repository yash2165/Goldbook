'use client'

import { useState, useEffect } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { getClosedTrades, fmt } from '@/lib/calculations'
import { format } from 'date-fns'
import { BookOpen, TrendingUp, TrendingDown, Save, CheckCircle2, Check, ChevronDown, ChevronUp, Camera, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import CountUp from 'react-countup'

function PnlBadge({ value }: { value: number }) {
  const isWin = value >= 0
  const [flash, setFlash] = useState(false)

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onAnimationComplete={() => setFlash(true)}
      className={cn(
        'px-3 py-1 rounded-full font-bold tabular-nums text-sm transition-colors duration-500',
        isWin 
          ? flash ? 'bg-[#22C55E] text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-[#22C55E]/10 text-[#22C55E]'
          : flash ? 'bg-[#EF4444] text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-[#EF4444]/10 text-[#EF4444]'
      )}
    >
      {isWin ? '+' : '-'}$
      <CountUp
        end={Math.abs(value)}
        decimals={2}
        duration={0.6}
        separator=","
        preserveValue
      />
    </motion.div>
  )
}

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

function TradeJournalCard({ 
  trade, 
  index, 
  expanded, 
  onToggle,
  profileChecklist,
  profileSetups
}: { 
  trade: any, 
  index: number, 
  expanded: boolean, 
  onToggle: () => void,
  profileChecklist: string[],
  profileSetups: {name: string, description: string}[]
}) {
  const isWin = (trade.net_profit ?? 0) >= 0
  const supabase = createClient()
  
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  const [notes, setNotes] = useState(trade.notes || '')
  const [setupTag, setSetupTag] = useState(trade.setup_tag || '')
  const [emotionBefore, setEmotionBefore] = useState(trade.emotion_before || '')
  const [emotionAfter, setEmotionAfter] = useState(trade.emotion_after || '')
  const [rating, setRating] = useState<number>(trade.rating || 0)
  const [tradeChecklist, setTradeChecklist] = useState<Record<string, boolean>>(trade.pre_trade_checklist || {})
  
  const [screenshotUrl, setScreenshotUrl] = useState(trade.screenshot_url || '')
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)

  // Clipboard paste CTRL+V handler for screenshots
  useEffect(() => {
    if (!expanded) return

    const handlePaste = async (e: ClipboardEvent) => {
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file.type.startsWith('image/')) {
          e.preventDefault()
          await uploadScreenshot(file)
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [expanded, trade.id])

  const uploadScreenshot = async (file: File) => {
    setUploadingScreenshot(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tradeId', trade.id)

    try {
      const res = await fetch('/api/trades/upload-screenshot', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok && data.screenshotUrl) {
        setScreenshotUrl(data.screenshotUrl)
      } else {
        alert(data.error || 'Failed to upload pasted screenshot.')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred during file upload.')
    } finally {
      setUploadingScreenshot(false)
    }
  }

  const deleteScreenshot = async () => {
    try {
      const { error } = await supabase
        .from('trades')
        .update({ screenshot_url: null })
        .eq('id', trade.id)

      if (error) throw error
      setScreenshotUrl('')
    } catch (err: any) {
      alert(err.message)
    }
  }

  const saveJournal = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving(true)
    await supabase.from('trades').update({
      notes, 
      setup_tag: setupTag, 
      emotion_before: emotionBefore, 
      emotion_after: emotionAfter, 
      rating, 
      pre_trade_checklist: tradeChecklist
    }).eq('id', trade.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.04, 
        ease: [0.25, 0.46, 0.45, 0.94],
        layout: { duration: 0.4, type: "spring", bounce: 0.15 }
      }}
      className={cn(
        "relative rounded-xl overflow-hidden bg-[#0F0F18] transition-all duration-300 border-y border-r border-[#1A1A2E]",
        isWin ? "border-l-2 border-l-[#22C55E]" : "border-l-2 border-l-[#EF4444]"
      )}
      style={{
        boxShadow: isWin ? '-2px 0 8px rgba(34,197,94,0.1)' : '-2px 0 8px rgba(239,68,68,0.1)'
      }}
      whileHover={!expanded ? { 
        y: -3, 
        boxShadow: isWin ? '-2px 0 12px rgba(34,197,94,0.4)' : '-2px 0 12px rgba(239,68,68,0.3)' 
      } : undefined}
    >
      <div 
        onClick={onToggle}
        className="flex items-center justify-between p-5 cursor-pointer group"
      >
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-lg font-black text-[#F1F5F9] tracking-tight">{trade.symbol}</span>
            <span className="text-[11px] text-[#64748B] font-medium mt-0.5">
              {trade.close_time ? format(new Date(trade.close_time), 'MMM dd, yyyy HH:mm') : '—'}
            </span>
          </div>
          
          <div className="hidden sm:flex items-center gap-2">
            <span className={cn('text-xs px-2 py-0.5 rounded-md font-bold uppercase tracking-widest', trade.direction === 'buy' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]')}>
              {trade.direction === 'buy' ? '↗ Long' : '↘ Short'}
            </span>
          </div>

          <div className="hidden md:flex flex-col text-xs text-[#64748B]">
            <span>Entry: {trade.entry_price}</span>
            <span>Exit: {trade.exit_price}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <PnlBadge value={trade.net_profit ?? 0} />
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#64748B] group-hover:text-white group-hover:bg-white/10"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.1 }}
            className="overflow-hidden border-t border-white/5 bg-[#0A0A0F]/50"
          >
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8" onClick={(e) => e.stopPropagation()}>
              
              {/* Left col */}
              <div className="space-y-6">
                <div>
                  <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-2 block">Setup Tag / Strategy</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {profileSetups.map(s => (
                      <button
                        key={s.name}
                        onClick={() => setSetupTag(s.name)}
                        title={s.description}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                          setupTag === s.name ? 'bg-[#F59E0B] text-black shadow-[0_0_10px_rgba(245,159,11,0.3)]' : 'bg-white/5 text-[#64748B] hover:text-white'
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                  <input
                    value={setupTag}
                    onChange={e => setSetupTag(e.target.value)}
                    placeholder="Or type a custom setup..."
                    className="w-full bg-[#12121A] border border-[#1A1A2E] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F59E0B]/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-2 block">Emotion Before Trade</label>
                    <div className="grid grid-cols-3 gap-2">
                      {BEFORE_EMOTIONS.map(em => {
                        const isSelected = emotionBefore === em.value
                        return (
                          <button
                            key={em.value}
                            type="button"
                            onClick={() => setEmotionBefore(em.value)}
                            className={cn(
                              'px-2 py-2.5 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300',
                              isSelected
                                ? em.activeClass
                                : 'bg-[#12121A]/50 border-white/5 text-[#64748B] hover:bg-white/5 hover:text-white hover:border-white/10'
                            )}
                          >
                            <span className="text-base">{em.icon}</span>
                            <span>{em.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-2 block">Emotion After Trade</label>
                    <div className="grid grid-cols-3 gap-2">
                      {AFTER_EMOTIONS.map(em => {
                        const isSelected = emotionAfter === em.value
                        return (
                          <button
                            key={em.value}
                            type="button"
                            onClick={() => setEmotionAfter(em.value)}
                            className={cn(
                              'px-2 py-2.5 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300',
                              isSelected
                                ? em.activeClass
                                : 'bg-[#12121A]/50 border-white/5 text-[#64748B] hover:bg-white/5 hover:text-white hover:border-white/10'
                            )}
                          >
                            <span className="text-base">{em.icon}</span>
                            <span>{em.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-2 block">Trade Rating (1-5)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <motion.button
                        key={star}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setRating(star)}
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all',
                          rating >= star ? 'bg-[#F59E0B] text-black shadow-[0_0_15px_rgba(245,159,11,0.4)]' : 'bg-[#12121A] border border-[#1A1A2E] text-[#64748B]'
                        )}
                      >
                        ★
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-2 block">TradingView Chart Screenshot</label>
                  {screenshotUrl ? (
                    <div className="relative group rounded-xl overflow-hidden border border-white/5 bg-[#09090e] shadow-lg max-w-md">
                      <img src={screenshotUrl} alt="Trade screenshot chart" className="w-full h-auto object-contain max-h-48" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                        <button
                          type="button"
                          onClick={deleteScreenshot}
                          className="px-3 py-1.5 bg-[#EF4444] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:scale-105 transition-transform shadow-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Screenshot
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-white/10 hover:border-[#F59E0B]/40 transition-colors rounded-xl p-4 text-center bg-[#09090e]/30 flex flex-col items-center justify-center space-y-2 max-w-md">
                      <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
                        <Camera className="w-4 h-4" />
                      </div>
                      {uploadingScreenshot ? (
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                          <Loader2 className="w-3.5 h-3.5 text-[#F59E0B] animate-spin" /> Uploading image...
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-white/90">Paste TradingView image (CTRL + V)</p>
                          <p className="text-[10px] text-[#64748B] mt-0.5">Or click to select an image from your device</p>
                          
                          <input 
                            type="file" 
                            id={`screenshot-input-${trade.id}`}
                            accept="image/*" 
                            className="hidden" 
                            onChange={e => {
                              const file = e.target.files?.[0]
                              if (file) uploadScreenshot(file)
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById(`screenshot-input-${trade.id}`)?.click()}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider text-white border border-white/10 mt-2 transition-all"
                          >
                            Select File
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right col */}
              <div className="flex flex-col space-y-6">
                <div className="flex-1 flex flex-col">
                  <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-2 block">Trade Notes / Lessons</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="What did you learn? Did you follow your rules? What could you have done better?"
                    className="flex-1 w-full bg-[#12121A] border border-[#1A1A2E] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/50 transition-colors resize-none min-h-[120px]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-2 block">Pre-Trade Checklist</label>
                  <div className="space-y-2 bg-[#12121A] p-4 rounded-xl border border-[#1A1A2E]">
                    {profileChecklist.length === 0 ? (
                      <p className="text-xs text-[#64748B]">No checklist items configured in Settings.</p>
                    ) : (
                      profileChecklist.map((item, idx) => {
                        const isChecked = tradeChecklist[item]
                        return (
                          <motion.button
                            key={idx}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setTradeChecklist(p => ({ ...p, [item]: !p[item] }))}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all',
                              isChecked
                                ? 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#F1F5F9]'
                                : 'border-[#1A1A2E] bg-[#0A0A0F] text-[#64748B] hover:bg-white/5'
                            )}
                          >
                            <div className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors', isChecked ? 'bg-[#22C55E]' : 'bg-white/5')}>
                              {isChecked && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-left flex-1">{item}</span>
                          </motion.button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-[#1A1A2E] bg-[#12121A] flex justify-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={saveJournal}
                disabled={saving}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
                  saved ? 'bg-[#22C55E] text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black shadow-lg shadow-[#F59E0B]/20'
                )}
              >
                {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved Successfully</> : saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Entry</>}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function JournalPage() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const closed = getClosedTrades(trades)
  const supabase = createClient()
  
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [profileChecklist, setProfileChecklist] = useState<string[]>([])
  const [profileSetups, setProfileSetups] = useState<{name: string, description: string}[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('pre_trade_checklist, trading_setups').eq('id', user.id).single()
      if (data?.pre_trade_checklist) setProfileChecklist(data.pre_trade_checklist)
      else setProfileChecklist(['Checked higher timeframe', 'Risk within limits', 'Fits my trading plan', 'Key levels identified'])
      
      if (data?.trading_setups) setProfileSetups(data.trading_setups)
    }
    load()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center border border-[#F59E0B]/20 shadow-[0_0_15px_rgba(245,159,11,0.2)]">
            <BookOpen className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trade Journal</h1>
            <p className="text-sm text-[#64748B]">Document and analyze your psychological edge.</p>
          </div>
        </div>
        <div className="bg-[#12121A] border border-[#1A1A2E] px-4 py-2 rounded-lg text-sm">
          <span className="text-[#64748B]">Total Entries: </span>
          <span className="font-bold text-[#F1F5F9]">{closed.length}</span>
        </div>
      </motion.div>

      <div className="space-y-4 pb-20">
        {loading ? (
          <div className="py-20 text-center text-[#64748B]">Loading journal entries...</div>
        ) : closed.length === 0 ? (
          <div className="py-20 text-center text-[#64748B] flex flex-col items-center">
            <BookOpen className="w-12 h-12 mb-4 opacity-20" />
            <p>No closed trades available to journal.</p>
          </div>
        ) : (
          <motion.div layout className="space-y-4">
            {closed.map((t, i) => (
              <TradeJournalCard 
                key={t.id} 
                trade={t} 
                index={i} 
                expanded={expandedId === t.id}
                onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
                profileChecklist={profileChecklist}
                profileSetups={profileSetups}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
