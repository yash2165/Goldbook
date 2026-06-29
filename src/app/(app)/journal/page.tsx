'use client'

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { getClosedTrades, fmt } from '@/lib/calculations'
import { format } from 'date-fns'
import { BookOpen, Save, CheckCircle2, Check, ChevronDown, Camera, Loader2, Settings, Sparkles, X, LayoutTemplate } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import CountUp from 'react-countup'
import Link from 'next/link'

function PnlBadge({ value, symbol = '$' }: { value: number, symbol?: string }) {
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
      {isWin ? '+' : '-'}{symbol}
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
  profileSetups,
  customTemplate
}: { 
  trade: any, 
  index: number, 
  expanded: boolean, 
  onToggle: () => void,
  profileChecklist: string[],
  profileSetups: {name: string, description: string}[],
  customTemplate: any | null
}) {
  const isWin = (trade.net_profit ?? 0) >= 0
  const supabase = createClient()
  
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [p3, setP3] = useState('')
  const [p4, setP4] = useState('')

  // Default confirmations section
  const [confirmations, setConfirmations] = useState<string[]>([])
  const [confirmationsPool, setConfirmationsPool] = useState<string[]>([
    'Fib Retracement', 'VWAP Bounds', 'EMA Crossover', 'Support/Resistance Bounce', 'Liquidity Sweep'
  ])
  const [newConfirmText, setNewConfirmText] = useState('')

  // Custom template values
  const [customValues, setCustomValues] = useState<Record<string, any>>({})

  const parsedNotes = useMemo(() => {
    if (!trade.notes) return { p1: '', p2: '', p3: '', p4: '', isCustom: false, values: {} }
    try {
      const parsed = JSON.parse(trade.notes)
      if (parsed && typeof parsed === 'object') {
        if (parsed.isCustom) {
          return {
            p1: '', p2: '', p3: '', p4: '',
            isCustom: true,
            values: parsed.values || {}
          }
        }
        return {
          p1: parsed.p1 || '',
          p2: parsed.p2 || '',
          p3: parsed.p3 || '',
          p4: parsed.p4 || '',
          confirmations: parsed.confirmations || [],
          isCustom: false,
          values: {}
        }
      }
    } catch (e) {
      return { p1: trade.notes, p2: '', p3: '', p4: '', isCustom: false, values: {} }
    }
    return { p1: '', p2: '', p3: '', p4: '', isCustom: false, values: {} }
  }, [trade.notes])

  const shouldRenderCustom = useMemo(() => {
    // 1. If this specific trade was already saved as custom, render custom
    if (parsedNotes.isCustom) return true
    
    // 2. If this trade has default notes filled out, preserve default template so past notes aren't lost
    const hasDefaultNotes = !!(
      parsedNotes.p1?.trim() || 
      parsedNotes.p2?.trim() || 
      parsedNotes.p3?.trim() || 
      parsedNotes.p4?.trim() || 
      (parsedNotes.confirmations && parsedNotes.confirmations.length > 0)
    )
    if (hasDefaultNotes) return false

    // 3. Otherwise, if the user has an active custom template, use it exclusively (removing default prompts)
    return !!customTemplate
  }, [parsedNotes, customTemplate])

  useEffect(() => {
    if (parsedNotes.isCustom) {
      setCustomValues(parsedNotes.values || {})
    } else {
      setP1(parsedNotes.p1 || '')
      setP2(parsedNotes.p2 || '')
      setP3(parsedNotes.p3 || '')
      setP4(parsedNotes.p4 || '')
      setConfirmations(parsedNotes.confirmations || [])
      
      // Merge unique confirmations from DB into pool
      if (parsedNotes.confirmations && parsedNotes.confirmations.length > 0) {
        setConfirmationsPool(prev => {
          const combined = [...prev]
          parsedNotes.confirmations.forEach((c: string) => {
            if (!combined.includes(c)) combined.push(c)
          })
          return combined
        })
      }
    }
  }, [parsedNotes])

  const answeredCount = useMemo(() => {
    if (parsedNotes.isCustom) {
      return Object.values(customValues).filter(val => {
        if (Array.isArray(val)) return val.length > 0
        if (typeof val === 'string') return val.trim().length > 0
        return val !== undefined && val !== null
      }).length
    }
    return [p1, p2, p3, p4].filter(p => p.trim().length > 0).length
  }, [p1, p2, p3, p4, parsedNotes.isCustom, customValues])

  const isUnjournaled = useMemo(() => {
    if (!trade.notes) return true
    try {
      const parsed = JSON.parse(trade.notes)
      if (parsed && typeof parsed === 'object') {
        if (parsed.isCustom) {
          return Object.keys(parsed.values || {}).length === 0
        }
        return !(parsed.p1?.trim() || parsed.p2?.trim() || parsed.p3?.trim() || parsed.p4?.trim())
      }
    } catch (e) {
      return !trade.notes.trim()
    }
    return !trade.notes.trim()
  }, [trade.notes])

  const isOldEmpty = useMemo(() => {
    if (!isUnjournaled || !trade.close_time) return false
    const closeDate = new Date(trade.close_time)
    const hoursSinceClose = (Date.now() - closeDate.getTime()) / (1000 * 60 * 60)
    return hoursSinceClose > 2
  }, [isUnjournaled, trade.close_time])

  const [setupTag, setSetupTag] = useState(trade.setup_tag || '')
  
  // Custom emotions checking
  const isCustomBefore = trade.emotion_before && !BEFORE_EMOTIONS.some(e => e.value === trade.emotion_before)
  const [emotionBefore, setEmotionBefore] = useState(trade.emotion_before || '')
  const [customEmotionBefore, setCustomEmotionBefore] = useState(isCustomBefore ? trade.emotion_before : '')
  const [showCustomBefore, setShowCustomBefore] = useState(!!isCustomBefore)

  const isCustomAfter = trade.emotion_after && !AFTER_EMOTIONS.some(e => e.value === trade.emotion_after)
  const [emotionAfter, setEmotionAfter] = useState(trade.emotion_after || '')
  const [customEmotionAfter, setCustomEmotionAfter] = useState(isCustomAfter ? trade.emotion_after : '')
  const [showCustomAfter, setShowCustomAfter] = useState(!!isCustomAfter)

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
    
    // Save template values or standard prompts based on choice
    const notesJsonString = shouldRenderCustom
      ? JSON.stringify({ isCustom: true, values: customValues })
      : JSON.stringify({ p1, p2, p3, p4, confirmations })

    // In custom mode, skip overwriting emotion/setup/rating/checklist — they aren't visible
    // so saving them as blank would erase any existing data from a previous default-mode session.
    const updatePayload: Record<string, any> = { notes: notesJsonString }
    if (!shouldRenderCustom) {
      updatePayload.setup_tag = setupTag
      updatePayload.emotion_before = emotionBefore
      updatePayload.emotion_after = emotionAfter
      updatePayload.rating = rating
      updatePayload.pre_trade_checklist = tradeChecklist
    }

    await supabase.from('trades').update(updatePayload).eq('id', trade.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addConfirmToPool = (e: React.FormEvent) => {
    e.preventDefault()
    if (newConfirmText.trim() && !confirmationsPool.includes(newConfirmText.trim())) {
      setConfirmationsPool(prev => [...prev, newConfirmText.trim()])
      setNewConfirmText('')
    }
  }

  // Render custom blocks helper
  const renderCustomBlock = (block: any) => {
    if (block.type === 'header') {
      return (
        <div key={block.id} className="pt-2 border-b border-white/5 pb-1">
          <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider text-primary">{block.label}</h4>
        </div>
      )
    }

    if (block.type === 'paragraph') {
      const dbVal = customValues[block.id]
      const val = typeof dbVal === 'string' ? dbVal : ''
      return (
        <div key={block.id} className="space-y-1">
          <label className="text-[10px] text-[#94A3B8] font-bold block leading-tight">{block.label}</label>
          <textarea
            value={val}
            onChange={e => setCustomValues(prev => ({ ...prev, [block.id]: e.target.value }))}
            placeholder={block.placeholder || "Enter notes..."}
            rows={3}
            className="w-full bg-[#0D1421] border border-[#1A1A2E] focus:border-primary/45 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none transition-all resize-none leading-relaxed"
          />
        </div>
      )
    }

    if (block.type === 'dropdown') {
      const dbVal = customValues[block.id]
      const val = typeof dbVal === 'string' ? dbVal : ''
      return (
        <div key={block.id} className="space-y-1">
          <label className="text-[10px] text-[#94A3B8] font-bold block leading-tight">{block.label}</label>
          <div className="flex flex-wrap gap-1">
            {(block.options || []).map((opt: string) => {
              const isSelected = val === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCustomValues(prev => ({ ...prev, [block.id]: opt }))}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer",
                    isSelected
                      ? "bg-primary border-primary text-black shadow-md shadow-primary/20"
                      : "bg-[#0D1421] border-[#1A1A2E] text-[#64748B] hover:text-white"
                  )}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    if (block.type === 'confirmations') {
      const dbVal = customValues[block.id]
      const val = Array.isArray(dbVal) ? dbVal : []
      return (
        <div key={block.id} className="space-y-1">
          <label className="text-[10px] text-[#94A3B8] font-bold block leading-tight">{block.label}</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {(block.options || []).map((opt: string) => {
              const isChecked = val.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const newArr = isChecked ? val.filter((v: string) => v !== opt) : [...val, opt]
                    setCustomValues(prev => ({ ...prev, [block.id]: newArr }))
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-[10px] transition-all cursor-pointer",
                    isChecked
                      ? "border-primary bg-primary/10 text-white"
                      : "border-[#1A1A2E] bg-[#0D1421] text-[#64748B] hover:bg-white/5"
                  )}
                >
                  <div className={cn("w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0", isChecked ? "bg-primary border-primary text-black" : "border-white/10 bg-white/5")}>
                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className="truncate">{opt}</span>
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    if (block.type === 'table') {
      const dbVal = customValues[block.id]
      const val = Array.isArray(dbVal) ? dbVal : []
      const cols = block.columns || []
      
      const addRow = () => {
        const newRow = { id: `row_${Date.now()}` }
        setCustomValues(prev => ({ ...prev, [block.id]: [...val, newRow] }))
      }

      const removeRow = (rId: string) => {
        setCustomValues(prev => ({ ...prev, [block.id]: val.filter((r: any) => r.id !== rId) }))
      }

      const updateCell = (rId: string, colId: string, cellVal: any) => {
        setCustomValues(prev => {
          const rows = val.map((row: any) => row.id === rId ? { ...row, [colId]: cellVal } : row)
          return { ...prev, [block.id]: rows }
        })
      }

      const computeFormula = (col: any) => {
        if (col.type !== 'number') return null
        const numbers = val.map((row: any) => Number(row[col.id])).filter((n: any) => !isNaN(n))
        if (numbers.length === 0) return '-'
        
        const lowerLabel = col.label.toLowerCase()
        const isSum = lowerLabel.includes('pip') || lowerLabel.includes('profit') || lowerLabel.includes('risk') || lowerLabel.includes('loss') || lowerLabel.includes('cash') || lowerLabel.includes('dollar')
        
        if (isSum) {
          const sum = numbers.reduce((a: number, b: number) => a + b, 0)
          return `Sum: ${sum.toFixed(2)}`
        } else {
          const avg = numbers.reduce((a: number, b: number) => a + b, 0) / numbers.length
          return `Avg: ${avg.toFixed(2)}`
        }
      }

      return (
        <div key={block.id} className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[#94A3B8] font-bold block leading-tight">{block.label}</label>
            <button
              type="button"
              onClick={addRow}
              className="px-2 py-0.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-[9px] font-bold rounded transition-all cursor-pointer"
            >
              + Add Row
            </button>
          </div>

          <div className="overflow-x-auto border border-[#1A1A2E] bg-[#09090E]/60 rounded-xl">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1A1A2E] bg-white/2 text-[8px] text-[#64748B] uppercase tracking-wider font-bold">
                  {cols.map((col: any) => (
                    <th key={col.id} className="py-2 px-2.5">{col.label}</th>
                  ))}
                  <th className="py-2 px-2 text-center w-8">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A2E]/50">
                {val.map((row: any) => (
                  <tr key={row.id} className="hover:bg-white/[0.01]">
                    {cols.map((col: any) => {
                      const cellVal = row[col.id]
                      
                      return (
                        <td key={col.id} className="py-1.5 px-2.5">
                          {col.type === 'checkbox' && (
                            <button
                              type="button"
                              onClick={() => updateCell(row.id, col.id, !cellVal)}
                              className={cn(
                                "w-4 h-4 mx-auto rounded flex items-center justify-center border transition-all cursor-pointer",
                                cellVal ? "bg-primary border-primary text-black" : "border-white/10 bg-white/5 text-transparent"
                              )}
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </button>
                          )}

                          {col.type === 'dropdown' && (
                            <select
                              value={cellVal || ''}
                              onChange={e => updateCell(row.id, col.id, e.target.value)}
                              className="bg-[#0D1421] border border-[#1A1A2E] rounded px-1 py-0.5 text-[9px] text-white focus:outline-none focus:border-primary/50 [color-scheme:dark]"
                            >
                              <option value="">...</option>
                              {(col.options || []).map((o: string) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          )}

                          {col.type === 'text' && (
                            <input
                              type="text"
                              value={cellVal || ''}
                              onChange={e => updateCell(row.id, col.id, e.target.value)}
                              className="w-full bg-[#0D1421] border border-[#1A1A2E] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-primary/50"
                              placeholder="..."
                            />
                          )}

                          {col.type === 'number' && (
                            <input
                              type="number"
                              step="any"
                              value={cellVal === undefined ? '' : cellVal}
                              onChange={e => updateCell(row.id, col.id, e.target.value === '' ? undefined : Number(e.target.value))}
                              className="w-16 bg-[#0D1421] border border-[#1A1A2E] rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-primary/50 text-right font-mono"
                              placeholder="0.0"
                            />
                          )}
                        </td>
                      )
                    })}
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-[#334155] hover:text-[#EF4444] transition-colors cursor-pointer text-xs"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {val.length === 0 && (
                  <tr>
                    <td colSpan={cols.length + 1} className="py-4 text-center text-[#64748B] italic text-[9px]">
                      No rows added. Click "+ Add Row" above.
                    </td>
                  </tr>
                )}
                {val.length > 0 && cols.some((c: any) => c.type === 'number') && (
                  <tr className="bg-white/[0.01] border-t border-[#1A1A2E] text-[8px] text-[#64748B] font-bold font-mono">
                    {cols.map((col: any) => (
                      <td key={col.id} className="py-1.5 px-2.5 text-right">
                        {computeFormula(col)}
                      </td>
                    ))}
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <motion.div
      id={`trade-card-${trade.id}`}
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
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-[#F1F5F9] tracking-tight">{trade.symbol}</span>
              {trade.instrument_type === 'options' && (
                <span className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded font-black',
                  trade.option_type === 'CE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-red-500/10 text-red-400 border border-red-500/15'
                )}>
                  {trade.strike_price}{trade.option_type}
                </span>
              )}
              {isOldEmpty && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold uppercase tracking-wider animate-pulse shrink-0 flex items-center gap-1">
                  <span>⚠</span> Unjournaled
                </span>
              )}
            </div>
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
          <PnlBadge value={trade.net_profit ?? 0} symbol={trade.currency === 'INR' ? '₹' : '$'} />
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
            className="overflow-hidden border-t border-white/5 bg-[#060A12]/50"
          >
            <div className={cn(
              "p-6 gap-8",
              shouldRenderCustom
                ? "grid grid-cols-1"  // Custom template: full-width single column
                : "grid grid-cols-1 lg:grid-cols-2"  // Default: two columns
            )} onClick={(e) => e.stopPropagation()}>
              
              {/* Left col — HIDDEN in custom template mode */}
              {!shouldRenderCustom && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-2 block">Setup Tag / Strategy</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(Array.isArray(profileSetups) ? profileSetups : []).map(s => (
                      <button
                        key={s.name}
                        onClick={() => setSetupTag(s.name)}
                        title={s.description}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
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
                    className="w-full bg-[#0D1421] border border-[#1A1A2E] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F59E0B]/50 transition-colors"
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
                            onClick={() => { setEmotionBefore(em.value); setShowCustomBefore(false) }}
                            className={cn(
                              'px-2 py-2.5 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer',
                              isSelected && !showCustomBefore
                                ? em.activeClass
                                : 'bg-[#0D1421]/50 border-white/5 text-[#64748B] hover:bg-white/5 hover:text-white hover:border-white/10'
                            )}
                          >
                            <span className="text-base">{em.icon}</span>
                            <span>{em.label}</span>
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => { setShowCustomBefore(true); setEmotionBefore(customEmotionBefore) }}
                        className={cn(
                          'px-2 py-2.5 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer',
                          showCustomBefore
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            : 'bg-[#0D1421]/50 border-white/5 text-[#64748B] hover:bg-white/5 hover:text-white hover:border-white/10'
                        )}
                      >
                        <span className="text-base">💭</span>
                        <span>{customEmotionBefore ? 'Other: ' + customEmotionBefore : 'Other...'}</span>
                      </button>
                    </div>
                    {showCustomBefore && (
                      <input
                        value={customEmotionBefore}
                        onChange={e => { setCustomEmotionBefore(e.target.value); setEmotionBefore(e.target.value) }}
                        placeholder="Type custom emotion..."
                        className="w-full bg-[#0D1421] border border-[#1A1A2E] rounded-lg px-3 py-2 mt-2 text-xs focus:outline-none focus:border-[#F59E0B]/50 transition-colors text-white"
                      />
                    )}
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
                            onClick={() => { setEmotionAfter(em.value); setShowCustomAfter(false) }}
                            className={cn(
                              'px-2 py-2.5 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer',
                              isSelected && !showCustomAfter
                                ? em.activeClass
                                : 'bg-[#0D1421]/50 border-white/5 text-[#64748B] hover:bg-white/5 hover:text-white hover:border-white/10'
                            )}
                          >
                            <span className="text-base">{em.icon}</span>
                            <span>{em.label}</span>
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => { setShowCustomAfter(true); setEmotionAfter(customEmotionAfter) }}
                        className={cn(
                          'px-2 py-2.5 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer',
                          showCustomAfter
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            : 'bg-[#0D1421]/50 border-white/5 text-[#64748B] hover:bg-white/5 hover:text-white hover:border-white/10'
                        )}
                      >
                        <span className="text-base">💭</span>
                        <span>{customEmotionAfter ? 'Other: ' + customEmotionAfter : 'Other...'}</span>
                      </button>
                    </div>
                    {showCustomAfter && (
                      <input
                        value={customEmotionAfter}
                        onChange={e => { setCustomEmotionAfter(e.target.value); setEmotionAfter(e.target.value) }}
                        placeholder="Type custom emotion..."
                        className="w-full bg-[#0D1421] border border-[#1A1A2E] rounded-lg px-3 py-2 mt-2 text-xs focus:outline-none focus:border-[#F59E0B]/50 transition-colors text-white"
                      />
                    )}
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
                          'w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all cursor-pointer',
                          rating >= star ? 'bg-[#F59E0B] text-black shadow-[0_0_15px_rgba(245,159,11,0.4)]' : 'bg-[#0D1421] border border-[#1A1A2E] text-[#64748B]'
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
                    <div className="space-y-3 max-w-md animate-in fade-in duration-200">
                      <div className="relative rounded-xl overflow-hidden border border-white/5 bg-[#09090e] shadow-lg flex items-center justify-center">
                        <img 
                          src={screenshotUrl} 
                          alt="Trade screenshot chart" 
                          className="w-full h-auto object-contain max-h-64 p-1" 
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 text-center py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all"
                        >
                          🔍 View Full Image
                        </a>
                        <button
                          type="button"
                          onClick={deleteScreenshot}
                          className="px-3 py-2 bg-[#EF4444]/10 hover:bg-[#EF4444]/25 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                        >
                          🗑️ Delete Screenshot
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
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider text-white border border-white/10 mt-2 transition-all cursor-pointer"
                          >
                            Select File
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )} {/* end !shouldRenderCustom left col */}

              {/* Right col — or full-width canvas in custom mode */}
              <div className="flex flex-col space-y-6">
                
                {shouldRenderCustom ? (
                  /* RENDER CUSTOM NOTION TEMPLATE — full width, no left column */
                  <div className="flex-1 flex flex-col space-y-5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" /> {customTemplate.name || "Custom Journal Template"}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] px-2.5 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-full font-black uppercase tracking-widest">
                          Custom Layout
                        </span>
                        <Link href="/journal/custom-template" onClick={e => e.stopPropagation()} className="text-[9px] text-[#64748B] hover:text-primary transition-colors font-bold flex items-center gap-0.5">
                          <Settings className="w-2.5 h-2.5" /> Edit
                        </Link>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(Array.isArray(customTemplate.blocks) ? customTemplate.blocks : []).map((block: any) => (
                        <div key={block.id} className={cn(block.type === 'table' || block.type === 'header' ? 'md:col-span-2' : '')}>
                          {renderCustomBlock(block)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* RENDER DEFAULT JOURNAL TEMPLATE */
                  <div className="flex-1 flex flex-col space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-primary" /> Psychological Prompts
                      </label>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest transition-all",
                        answeredCount === 4 
                          ? "bg-emerald-500/10 border border-emerald-500/25 text-[#22C55E]" 
                          : answeredCount > 0 
                            ? "bg-amber-500/10 border border-amber-500/25 text-[#F59E0B]" 
                            : "bg-white/5 border border-white/10 text-slate-500"
                      )}>
                        {answeredCount}/4 Prompts
                      </span>
                    </div>

                    <div className="space-y-4">
                      {[
                        { key: 'p1', label: 'I entered this trade because...', placeholder: 'Detail your setup triggers, market structure, or checklist alignment...' },
                        { key: 'p2', label: 'When price moved against me, I felt...', placeholder: 'Identify any urges to move stops, add to losers, or exit early in fear...' },
                        { key: 'p3', label: 'If I could redo this trade, I would...', placeholder: 'Note any tactical optimization, execution errors, or mental state improvements...' },
                        { key: 'p4', label: 'This trade proves that I am...', placeholder: 'Extract a pattern-level lesson about your current discipline or risk rules...' }
                      ].map((p, idx) => {
                        const val = p.key === 'p1' ? p1 : p.key === 'p2' ? p2 : p.key === 'p3' ? p3 : p4
                        const setVal = p.key === 'p1' ? setP1 : p.key === 'p2' ? setP2 : p.key === 'p3' ? setP3 : setP4
                        return (
                          <div key={p.key} className="space-y-1.5">
                            <label className="text-[11px] text-[#94A3B8] font-bold block flex items-center gap-1.5 leading-tight">
                              <span className="text-[9px] w-4 h-4 rounded-full bg-white/5 border border-white/10 text-[#64748B] flex items-center justify-center font-mono shrink-0">{idx + 1}</span>
                              {p.label}
                            </label>
                            <textarea
                              value={val}
                              onChange={e => setVal(e.target.value)}
                              placeholder={p.placeholder}
                              rows={3}
                              className="w-full bg-[#0D1421] border border-[#1A1A2E] focus:border-primary/45 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-[#64748B] focus:outline-none transition-colors resize-none leading-relaxed"
                            />
                          </div>
                        )
                      })}
                    </div>

                    {/* Customizable confirmations in default template */}
                    <div className="space-y-3 pt-3 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Trade Confirmations</label>
                        <form onSubmit={addConfirmToPool} className="flex gap-1.5">
                          <input
                            type="text"
                            value={newConfirmText}
                            onChange={e => setNewConfirmText(e.target.value)}
                            placeholder="Add tag..."
                            className="bg-[#060A12] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none placeholder:text-[#334155] w-24"
                          />
                          <button type="submit" className="px-2 py-1 bg-primary text-black rounded-lg text-[10px] font-bold cursor-pointer">
                            +
                          </button>
                        </form>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {confirmationsPool.map(c => {
                          const isChecked = confirmations.includes(c)
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setConfirmations(prev =>
                                  prev.includes(c) ? prev.filter(v => v !== c) : [...prev, c]
                                )
                              }}
                              className={cn(
                                "flex items-center gap-1.5 px-2 py-1.5 border rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                                isChecked
                                  ? "border-primary bg-primary/10 text-white"
                                  : "border-white/5 bg-[#060A12] text-[#64748B] hover:text-white"
                              )}
                            >
                              <div className={cn("w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0", isChecked ? "bg-primary border-primary text-black" : "border-white/10 bg-white/5")}>
                                {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className="truncate">{c}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pre-Trade Checklist — only shown in default template mode */}
                {!shouldRenderCustom && (
                <div>
                  <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium mb-2 block">Pre-Trade Checklist</label>
                  <div className="space-y-2 bg-[#0D1421] p-4 rounded-xl border border-[#1A1A2E]">
                    {(() => {
                      const checklistArr = Array.isArray(profileChecklist) ? profileChecklist : []
                      if (checklistArr.length === 0) {
                        return <p className="text-xs text-[#64748B]">No checklist items configured in Settings.</p>
                      }
                      return checklistArr.map((item, idx) => {
                        const isChecked = tradeChecklist[item]
                        return (
                          <motion.button
                            key={idx}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setTradeChecklist(p => ({ ...p, [item]: !p[item] }))}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all cursor-pointer',
                              isChecked
                                ? 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#F1F5F9]'
                                : 'border-[#1A1A2E] bg-[#060A12] text-[#64748B] hover:bg-white/5'
                            )}
                          >
                            <div className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors', isChecked ? 'bg-[#22C55E]' : 'bg-white/5')}>
                              {isChecked && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-left flex-1">{item}</span>
                          </motion.button>
                        )
                      })
                    })()}
                  </div>
                </div>
                )}
              </div>

            </div>

            <div className="p-4 border-t border-[#1A1A2E] bg-[#0D1421] flex justify-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={saveJournal}
                disabled={saving}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer',
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

function JournalPageContent() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const closed = getClosedTrades(trades)
  const supabase = createClient()
  
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [profileChecklist, setProfileChecklist] = useState<string[]>([])
  const [profileSetups, setProfileSetups] = useState<{name: string, description: string}[]>([])
  const [profileTemplate, setProfileTemplate] = useState<any | null>(null)

  // Template mode: 'custom' uses saved template, 'default' forces default prompts
  const [templateMode, setTemplateMode] = useState<'custom' | 'default'>('custom')
  // Whether to show the first-use banner
  const [showBanner, setShowBanner] = useState(false)

  const searchParams = useSearchParams()
  const tradeId = searchParams.get('tradeId')

  // Auto-expand & scroll trade card if tradeId is in query parameters
  useEffect(() => {
    if (tradeId && closed.length > 0) {
      const match = closed.some(t => t.id === tradeId)
      if (match) {
        setExpandedId(tradeId)
        
        // Let expanding animation start and scroll card into view
        setTimeout(() => {
          const el = document.getElementById(`trade-card-${tradeId}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 400)
      }
    }
  }, [tradeId, closed])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data } = await supabase.from('profiles').select('pre_trade_checklist, trading_setups, custom_journal_template').eq('id', user.id).single()
      
      if (data?.pre_trade_checklist) {
        setProfileChecklist(Array.isArray(data.pre_trade_checklist) ? data.pre_trade_checklist : [])
      } else {
        setProfileChecklist(['Checked higher timeframe', 'Risk within limits', 'Fits my trading plan', 'Key levels identified'])
      }
      
      if (data?.trading_setups) {
        if (Array.isArray(data.trading_setups)) {
          setProfileSetups(data.trading_setups)
        } else if (typeof data.trading_setups === 'object' && data.trading_setups !== null) {
          const parsedSetups: any[] = []
          Object.entries(data.trading_setups).forEach(([key, val]) => {
            if (key !== '__custom_journal_template' && val && typeof val === 'object' && 'name' in val) {
              parsedSetups.push(val)
            }
          })
          setProfileSetups(parsedSetups)
        }
      }
      
      if (data?.custom_journal_template) {
        setProfileTemplate(data.custom_journal_template)
      } else if (data?.trading_setups && (data.trading_setups as any).__custom_journal_template) {
        setProfileTemplate((data.trading_setups as any).__custom_journal_template)
      } else {
        const local = localStorage.getItem('goldbook_custom_template')
        if (local) setProfileTemplate(JSON.parse(local))
      }

      // Restore saved template mode preference, and show first-use banner if needed
      const savedMode = localStorage.getItem('goldbook_template_mode') as 'custom' | 'default' | null
      const hasTemplate = !!data?.custom_journal_template ||
        !!((data?.trading_setups as any)?.__custom_journal_template) ||
        !!localStorage.getItem('goldbook_custom_template')

      if (savedMode) {
        setTemplateMode(savedMode)
      } else if (hasTemplate) {
        // First time with a custom template — show banner
        setShowBanner(true)
        setTemplateMode('custom')
      }
    }
    load()
  }, [])

  const unjournaledCount = useMemo(() => {
    return closed.filter(t => {
      let isUnj = false
      if (!t.notes) {
        isUnj = true
      } else {
        try {
          const parsed = JSON.parse(t.notes)
          if (parsed && typeof parsed === 'object') {
            if (parsed.isCustom) {
              return Object.keys(parsed.values || {}).length === 0
            }
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
  }, [closed])

  // The effective custom template — null when mode is 'default' (forces default prompts on new trades)
  const effectiveTemplate = templateMode === 'custom' ? profileTemplate : null

  const switchMode = (mode: 'custom' | 'default') => {
    setTemplateMode(mode)
    setShowBanner(false)
    localStorage.setItem('goldbook_template_mode', mode)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen">
      
      {/* Dynamic Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(245,159,11,0.15)]">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <span>Trade Journal</span>
              {unjournaledCount > 0 && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-500 font-bold uppercase tracking-wider animate-pulse shrink-0">
                  {unjournaledCount} Pending
                </span>
              )}
            </h1>
            <p className="text-sm text-[#64748B]">Document and analyze your psychological edge.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto self-stretch md:self-auto justify-end">
          {/* Template mode switcher pills */}
          <div className="flex items-center bg-[#0D1421] border border-white/5 rounded-xl p-1 gap-1">
            <button
              onClick={() => switchMode('default')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5',
                templateMode === 'default'
                  ? 'bg-[#F59E0B] text-black shadow-md'
                  : 'text-[#64748B] hover:text-white'
              )}
            >
              <BookOpen className="w-3 h-3" /> Default
            </button>
            <button
              onClick={() => profileTemplate ? switchMode('custom') : undefined}
              title={!profileTemplate ? 'No custom template saved yet' : 'Switch to your custom template'}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5',
                profileTemplate
                  ? 'cursor-pointer ' + (templateMode === 'custom' ? 'bg-primary text-black shadow-md' : 'text-[#64748B] hover:text-white')
                  : 'opacity-40 cursor-not-allowed text-[#64748B]'
              )}
            >
              <Sparkles className="w-3 h-3" /> My Template
            </button>
          </div>
          <Link href="/journal/custom-template">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-4 py-2 bg-primary/10 hover:bg-primary/25 border border-primary/30 text-primary font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(56,189,248,0.1)] shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-primary" /> {profileTemplate ? 'Edit Template' : 'Create Template'}
            </motion.button>
          </Link>
          <div className="bg-[#0D1421] border border-white/5 px-4 py-2 rounded-xl text-sm shrink-0">
            <span className="text-[#64748B]">Total Entries: </span>
            <span className="font-bold text-[#F1F5F9]">{closed.length}</span>
          </div>
        </div>
      </motion.div>

      {/* First-use custom template banner */}
      <AnimatePresence>
        {showBanner && profileTemplate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="mb-4 p-4 rounded-xl border border-primary/25 bg-primary/5 flex items-start gap-3"
          >
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-white block text-sm">Your custom template is active!</span>
              <span className="text-xs text-[#94A3B8] mt-0.5 block">New trades will use <strong className="text-white">{profileTemplate.name || 'your custom layout'}</strong>. You can switch back to Default Template anytime using the pills above.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => switchMode('default')}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[#94A3B8] text-[10px] font-bold rounded-lg transition-all cursor-pointer"
              >
                Use Default
              </button>
              <button
                onClick={() => { setShowBanner(false); localStorage.setItem('goldbook_template_mode', 'custom') }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-[#64748B] hover:text-white transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {unjournaledCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs leading-relaxed flex items-start gap-3 shadow-md"
        >
          <span className="text-lg leading-none shrink-0">⚠</span>
          <div>
            <span className="font-bold text-white uppercase tracking-wider block mb-0.5">Reflective Action Required</span>
            You have <strong className="text-white">{unjournaledCount}</strong> trade{unjournaledCount > 1 ? 's' : ''} closed more than 2 hours ago that haven't been journaled. An empty journal is the first step toward blind revenge cycles. Take a moment to record your emotional telemetry.
          </div>
        </motion.div>
      )}

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
                customTemplate={effectiveTemplate}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function JournalPage() {
  return (
    <Suspense fallback={
      <div className="py-20 text-center text-[#64748B]">Loading journal entries...</div>
    }>
      <JournalPageContent />
    </Suspense>
  )
}
