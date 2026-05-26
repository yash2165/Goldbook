'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Plus, Trash2, Save, ArrowLeft, Settings, 
  Layers, CheckSquare, List, Table, Type, Check, Play, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

// Block definition
interface TemplateBlock {
  id: string
  type: 'header' | 'paragraph' | 'dropdown' | 'confirmations' | 'table'
  label: string
  placeholder?: string
  options?: string[] // For dropdowns or confirmations
  columns?: { id: string; label: string; type: 'text' | 'number' | 'dropdown' | 'checkbox'; options?: string[] }[] // For tables
}

export default function CustomTemplatePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [templateName, setTemplateName] = useState('My Custom Journal Template')
  const [blocks, setBlocks] = useState<TemplateBlock[]>([])
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // State for block configurations
  const [activeBlockConfigId, setActiveBlockConfigId] = useState<string | null>(null)

  // Load existing template from database
  useEffect(() => {
    async function loadTemplate() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Load fallback mock layout from localStorage
        const local = localStorage.getItem('goldbook_custom_template')
        if (local) {
          const parsed = JSON.parse(local)
          setBlocks(parsed.blocks || [])
          setTemplateName(parsed.name || 'My Custom Journal Template')
        } else {
          // Default start blocks
          setBlocks([
            { id: 'b1', type: 'header', label: '1. Strategy & Technical Triggers' },
            { id: 'b2', type: 'confirmations', label: 'Technical Confirmations', options: ['Fib Retracement', 'VWAP Bounds', 'EMA Crossover', 'Support/Resistance Bounce', 'Liquidity Sweep'] },
            { id: 'b3', type: 'dropdown', label: 'Setup Quality rating', options: ['High Quality A+', 'Medium Quality B', 'Impulsive/Fringe C'] },
            { id: 'b4', type: 'header', label: '2. Session Notes & Tactical Metrics' },
            { id: 'b5', type: 'table', label: 'Multi-Timeframe Diagnostic Table', columns: [
              { id: 'col1', label: 'Timeframe', type: 'dropdown', options: ['M5', 'M15', 'H1', 'H4', 'D1'] },
              { id: 'col2', label: 'Market Structure', type: 'text' },
              { id: 'col3', label: 'Key Level (price)', type: 'number' },
              { id: 'col4', label: 'Aligned with Trend', type: 'checkbox' }
            ] }
          ])
        }
        setLoading(false)
        return
      }

      // Try fetching custom_journal_template
      const { data: profile } = await supabase
        .from('profiles')
        .select('custom_journal_template, trading_setups')
        .eq('id', user.id)
        .single()

      if (profile?.custom_journal_template) {
        const t = profile.custom_journal_template as any
        setBlocks(t.blocks || [])
        setTemplateName(t.name || 'My Custom Journal Template')
      } else if (profile?.trading_setups && (profile.trading_setups as any).__custom_journal_template) {
        const t = (profile.trading_setups as any).__custom_journal_template
        setBlocks(t.blocks || [])
        setTemplateName(t.name || 'My Custom Journal Template')
      } else {
        // Fallback default blocks
        setBlocks([
          { id: 'b1', type: 'header', label: '1. Strategy & Technical Triggers' },
          { id: 'b2', type: 'confirmations', label: 'Technical Confirmations', options: ['Fib Retracement', 'VWAP Bounds', 'EMA Crossover', 'Support/Resistance Bounce', 'Liquidity Sweep'] },
          { id: 'b3', type: 'dropdown', label: 'Setup Quality rating', options: ['High Quality A+', 'Medium Quality B', 'Impulsive/Fringe C'] },
          { id: 'b4', type: 'header', label: '2. Session Notes & Tactical Metrics' },
          { id: 'b5', type: 'table', label: 'Multi-Timeframe Diagnostic Table', columns: [
            { id: 'col1', label: 'Timeframe', type: 'dropdown', options: ['M5', 'M15', 'H1', 'H4', 'D1'] },
            { id: 'col2', label: 'Market Structure', type: 'text' },
            { id: 'col3', label: 'Key Level (price)', type: 'number' },
            { id: 'col4', label: 'Aligned with Trend', type: 'checkbox' }
          ] }
        ])
      }
      setLoading(false)
    }

    loadTemplate()
  }, [supabase])

  // Save template to database
  const saveTemplate = async () => {
    if (blocks.length === 0) {
      setErrorMsg('You must add at least one block to your journal template.')
      return
    }
    
    setSaving(true)
    setErrorMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    
    const payload = { name: templateName, blocks }

    if (!user) {
      localStorage.setItem('goldbook_custom_template', JSON.stringify(payload))
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      return
    }

    // Try directly updating custom_journal_template
    const { error } = await supabase
      .from('profiles')
      .update({ custom_journal_template: payload })
      .eq('id', user.id)

    if (error) {
      console.warn('Failed direct column write, trying setups fallback...', error)
      const { data: profile } = await supabase.from('profiles').select('trading_setups').eq('id', user.id).single()
      const setups = profile?.trading_setups || {}
      await supabase.from('profiles').update({
        trading_setups: { ...setups, __custom_journal_template: payload }
      }).eq('id', user.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Block management
  const addBlock = (type: TemplateBlock['type']) => {
    const id = `b_${Date.now()}`
    let newBlock: TemplateBlock
    
    if (type === 'header') {
      newBlock = { id, type, label: 'Section Header Title' }
    } else if (type === 'paragraph') {
      newBlock = { id, type, label: 'Paragraph Prompt Label', placeholder: 'Enter your thoughts here...' }
    } else if (type === 'dropdown') {
      newBlock = { id, type, label: 'Custom Dropdown Label', options: ['Option 1', 'Option 2'] }
    } else if (type === 'confirmations') {
      newBlock = { id, type, label: 'Trading Confirmations', options: ['EMA Align', 'Fib Rebound', 'Structure Break'] }
    } else {
      newBlock = {
        id,
        type,
        label: 'Custom Grid Database Table',
        columns: [
          { id: `c_${Date.now()}_1`, label: 'Item Name', type: 'text' },
          { id: `c_${Date.now()}_2`, label: 'Checklist Rule', type: 'checkbox' }
        ]
      }
    }
    
    setBlocks(prev => [...prev, newBlock])
    setActiveBlockConfigId(id)
  }

  const deleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
    if (activeBlockConfigId === id) setActiveBlockConfigId(null)
  }

  const updateBlockLabel = (id: string, newLabel: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, label: newLabel } : b))
  }

  // Dropdowns / Confirmations Options
  const addOptionToBlock = (id: string, text: string) => {
    if (!text.trim()) return
    setBlocks(prev => prev.map(b => {
      if (b.id === id) {
        const currentOpts = b.options || []
        if (currentOpts.includes(text.trim())) return b
        return { ...b, options: [...currentOpts, text.trim()] }
      }
      return b
    }))
  }

  const removeOptionFromBlock = (id: string, optionToDelete: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === id) {
        return { ...b, options: (b.options || []).filter(o => o !== optionToDelete) }
      }
      return b
    }))
  }

  // Custom Table Column Management
  const addColumnToTable = (blockId: string, label: string, type: 'text' | 'number' | 'dropdown' | 'checkbox') => {
    if (!label.trim()) return
    setBlocks(prev => prev.map(b => {
      if (b.id === blockId && b.type === 'table') {
        const cols = b.columns || []
        const newCol = { id: `col_${Date.now()}`, label: label.trim(), type, options: type === 'dropdown' ? ['Option A', 'Option B'] : undefined }
        return { ...b, columns: [...cols, newCol] }
      }
      return b
    }))
  }

  const removeColumnFromTable = (blockId: string, colId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === blockId && b.type === 'table') {
        return { ...b, columns: (b.columns || []).filter(c => c.id !== colId) }
      }
      return b
    }))
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 min-h-screen">
      
      {/* Header navbar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/journal">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-white/5 border border-white/10 text-[#64748B] hover:text-white rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Notion Journal Builder
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">Design a highly personalized trade journal layout matching your exact template.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="hidden md:block bg-[#060A12] border border-white/5 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary/50 w-64 text-right"
            placeholder="Template name..."
          />
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={saveTemplate}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg cursor-pointer",
              saved 
                ? "bg-emerald-500 text-white shadow-emerald-500/25" 
                : "bg-primary text-black shadow-primary/20 hover:bg-primary/95"
            )}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "SAVED SUCCESSFULLY" : "SAVE TEMPLATE"}
          </motion.button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="py-40 text-center text-[#64748B] flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
          Loading Builder Layout...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Blocks selector + configs sidebar (1 Col) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B]">Add Notion Blocks</h3>
              
              <div className="grid grid-cols-1 gap-2">
                {[
                  { type: 'header', label: 'Section Header', icon: Layers, desc: 'Creates clear categorizations' },
                  { type: 'paragraph', label: 'Text Field / Prompt', icon: Type, desc: 'For details, notes, or reviews' },
                  { type: 'dropdown', label: 'Dropdown Selector', icon: List, desc: 'Single select customizable tags' },
                  { type: 'confirmations', label: 'Multi-Confirmations', icon: CheckSquare, desc: 'Checkbox lists for strategies' },
                  { type: 'table', label: 'Custom Database Table', icon: Table, desc: 'Grids with Text, Numbers, Checkboxes' }
                ].map(b => (
                  <motion.button
                    key={b.type}
                    whileHover={{ scale: 1.01, x: 2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => addBlock(b.type as any)}
                    className="p-3 bg-[#060A12] border border-white/5 rounded-xl text-left hover:border-primary/30 transition-all flex items-start gap-3 group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#64748B] group-hover:text-primary transition-all shrink-0">
                      <b.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-none">{b.label}</p>
                      <p className="text-[10px] text-[#64748B] mt-1">{b.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Block Configurator settings */}
            <AnimatePresence mode="wait">
              {activeBlockConfigId && (
                <motion.div
                  key={activeBlockConfigId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl"
                >
                  {(() => {
                    const block = blocks.find(b => b.id === activeBlockConfigId)
                    if (!block) return null
                    
                    return (
                      <>
                        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                          <h3 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                            <Settings className="w-3.5 h-3.5" /> Block Settings
                          </h3>
                          <span className="text-[9px] font-black uppercase bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[#64748B]">
                            {block.type}
                          </span>
                        </div>

                        {/* Label Input */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">Prompt / Block Title</label>
                          <input
                            value={block.label}
                            onChange={e => updateBlockLabel(block.id, e.target.value)}
                            className="w-full bg-[#060A12] border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-primary/50"
                          />
                        </div>

                        {/* Options Config (For Dropdown & Confirmations) */}
                        {(block.type === 'dropdown' || block.type === 'confirmations') && (
                          <div className="space-y-3 pt-2">
                            <label className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider block">List Tag Options</label>
                            
                            <form onSubmit={e => {
                              e.preventDefault()
                              const fd = new FormData(e.currentTarget)
                              const opt = fd.get('optText') as string
                              if (opt) {
                                addOptionToBlock(block.id, opt)
                                e.currentTarget.reset()
                              }
                            }} className="flex gap-2">
                              <input
                                name="optText"
                                placeholder="Add option e.g. Breakout..."
                                className="flex-1 bg-[#060A12] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50"
                              />
                              <button type="submit" className="p-1.5 bg-primary text-black rounded-lg text-xs font-bold cursor-pointer">
                                <Plus className="w-4 h-4" />
                              </button>
                            </form>

                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {(block.options || []).map(o => (
                                <span key={o} className="text-[10px] px-2 py-0.5 rounded-lg border border-white/5 bg-white/5 text-slate-300 flex items-center gap-1.5">
                                  {o}
                                  <button type="button" onClick={() => removeOptionFromBlock(block.id, o)} className="text-[#64748B] hover:text-[#EF4444] font-black">
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Table Config (Columns Setup) */}
                        {block.type === 'table' && (
                          <div className="space-y-4 pt-2">
                            <label className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider block">Define Grid Columns</label>
                            
                            <form onSubmit={e => {
                              e.preventDefault()
                              const fd = new FormData(e.currentTarget)
                              const name = fd.get('colName') as string
                              const type = fd.get('colType') as any
                              if (name && type) {
                                addColumnToTable(block.id, name, type)
                                e.currentTarget.reset()
                              }
                            }} className="space-y-2 bg-[#060A12] p-3 rounded-xl border border-white/5">
                              <input
                                name="colName"
                                placeholder="Column Name e.g. SL Distance..."
                                className="w-full bg-[#0D1421] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50"
                              />
                              <div className="flex gap-2 items-center">
                                <select 
                                  name="colType"
                                  className="flex-1 bg-[#0D1421] border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]"
                                >
                                  <option value="text">Text Column</option>
                                  <option value="number">Number Column</option>
                                  <option value="checkbox">Checkbox Check</option>
                                  <option value="dropdown">Dropdown Tag</option>
                                </select>
                                <button type="submit" className="px-3 py-1.5 bg-primary text-black rounded-lg text-xs font-bold cursor-pointer">
                                  Add Col
                                </button>
                              </div>
                            </form>

                            <div className="space-y-1.5">
                              {(block.columns || []).map(col => (
                                <div key={col.id} className="p-2 bg-[#060A12] rounded-lg border border-white/5 flex items-center justify-between text-xs font-semibold">
                                  <div>
                                    <span className="text-white">{col.label}</span>
                                    <span className="text-[9px] text-[#64748B] ml-2 px-1 rounded bg-white/5 uppercase">{col.type}</span>
                                  </div>
                                  <button type="button" onClick={() => removeColumnFromTable(block.id, col.id)} className="text-[#64748B] hover:text-[#EF4444] cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="pt-2 border-t border-white/5 flex justify-end">
                          <button 
                            type="button"
                            onClick={() => deleteBlock(block.id)}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Block
                          </button>
                        </div>
                      </>
                    )
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Live Preview Canvas (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
              
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                  <span className="text-xs text-primary font-black uppercase tracking-widest">Interactive Canvas Preview</span>
                </div>
                <span className="text-[10px] text-[#64748B] font-semibold">Click elements to configure settings</span>
              </div>

              {/* Template blocks list */}
              {blocks.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-2xl text-[#334155] text-xs flex flex-col items-center justify-center space-y-3">
                  <Layers className="w-10 h-10 opacity-30" />
                  <div>
                    <p className="font-bold text-white/90">Your custom journal canvas is empty.</p>
                    <p className="mt-1">Add section headers, dropdowns, checklists, or grids from the left panel.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {blocks.map((block, idx) => {
                    const isConfiguring = activeBlockConfigId === block.id
                    
                    return (
                      <motion.div
                        key={block.id}
                        layout
                        onClick={() => setActiveBlockConfigId(block.id)}
                        className={cn(
                          "p-5 rounded-2xl border transition-all duration-300 relative group cursor-pointer",
                          isConfiguring 
                            ? "bg-[#060A12] border-primary/45 shadow-[0_0_15px_rgba(245,159,11,0.06)]"
                            : "bg-[#060A12]/40 border-white/5 hover:border-white/10"
                        )}
                      >
                        {/* Drag indicator / quick actions */}
                        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteBlock(block.id)
                            }}
                            className="p-1 bg-red-500/15 border border-red-500/25 rounded hover:bg-red-500/30 text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* RENDER HEADER BLOCK */}
                        {block.type === 'header' && (
                          <div className="py-1">
                            <h3 className="text-sm font-black text-slate-100 tracking-tight flex items-baseline gap-2">
                              <span className="text-[10px] text-primary font-mono">{idx + 1}.</span>
                              {block.label || "Header Title"}
                            </h3>
                          </div>
                        )}

                        {/* RENDER TEXT FIELD / PROMPT BLOCK */}
                        {block.type === 'paragraph' && (
                          <div className="space-y-2">
                            <label className="text-[11px] text-[#94A3B8] font-bold block flex items-center gap-2">
                              <span className="text-[9px] w-4 h-4 rounded-full bg-white/5 border border-white/10 text-[#64748B] flex items-center justify-center font-mono">{idx + 1}</span>
                              {block.label || "Prompt Label"}
                            </label>
                            <textarea
                              disabled
                              rows={3}
                              placeholder={block.placeholder || "Enter notes..."}
                              className="w-full bg-[#0D1421]/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-[#64748B] placeholder-[#334155] cursor-not-allowed resize-none leading-relaxed"
                            />
                          </div>
                        )}

                        {/* RENDER DROPDOWN SELECTOR BLOCK */}
                        {block.type === 'dropdown' && (
                          <div className="space-y-2">
                            <label className="text-[11px] text-[#94A3B8] font-bold block flex items-center gap-2">
                              <span className="text-[9px] w-4 h-4 rounded-full bg-white/5 border border-white/10 text-[#64748B] flex items-center justify-center font-mono">{idx + 1}</span>
                              {block.label || "Selector Tag"}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {(block.options || []).map(opt => (
                                <span key={opt} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/5 text-[#64748B]">
                                  {opt}
                                </span>
                              ))}
                              {(block.options || []).length === 0 && (
                                <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-lg font-bold">
                                  + Click block to add options in Sidebar
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* RENDER MULTI-SELECT CONFIRMATIONS BLOCK */}
                        {block.type === 'confirmations' && (
                          <div className="space-y-2">
                            <label className="text-[11px] text-[#94A3B8] font-bold block flex items-center gap-2">
                              <span className="text-[9px] w-4 h-4 rounded-full bg-white/5 border border-white/10 text-[#64748B] flex items-center justify-center font-mono">{idx + 1}</span>
                              {block.label || "Trading Confirmations"}
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {(block.options || []).map((opt, oIdx) => (
                                <div key={opt} className="flex items-center gap-2 px-3 py-2 border border-white/5 bg-[#0D1421]/60 rounded-xl text-xs text-[#64748B]">
                                  <div className="w-3.5 h-3.5 rounded border border-white/10 bg-white/5" />
                                  <span className="truncate">{opt}</span>
                                </div>
                              ))}
                              {(block.options || []).length === 0 && (
                                <span className="text-[10px] col-span-3 text-primary bg-primary/10 border border-primary/20 p-2 rounded-lg font-bold text-center">
                                  + Click block to add checkboxes in Sidebar
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* RENDER CUSTOM GRID TABLE BLOCK */}
                        {block.type === 'table' && (
                          <div className="space-y-2.5">
                            <label className="text-[11px] text-[#94A3B8] font-bold block flex items-center gap-2">
                              <span className="text-[9px] w-4 h-4 rounded-full bg-white/5 border border-white/10 text-[#64748B] flex items-center justify-center font-mono">{idx + 1}</span>
                              {block.label || "Database Grid Table"}
                            </label>
                            
                            <div className="overflow-x-auto border border-white/5 bg-[#0D1421]/40 rounded-xl">
                              <table className="w-full text-left border-collapse text-[11px]">
                                <thead>
                                  <tr className="border-b border-white/5 bg-white/2 text-[9px] text-[#64748B] uppercase tracking-wider font-bold">
                                    {(block.columns || []).map(col => (
                                      <th key={col.id} className="py-2.5 px-3">{col.label}</th>
                                    ))}
                                    {(block.columns || []).length === 0 && (
                                      <th className="py-2.5 px-3 text-primary">Add columns in sidebar settings</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="text-slate-400">
                                    {(block.columns || []).map(col => (
                                      <td key={col.id} className="py-3 px-3">
                                        {col.type === 'checkbox' && (
                                          <div className="w-4 h-4 rounded border border-white/10 bg-white/5 mx-auto" />
                                        )}
                                        {col.type === 'dropdown' && (
                                          <span className="px-2 py-0.5 rounded border border-white/5 bg-white/5 text-[9px] text-[#64748B] uppercase font-bold">
                                            Select option
                                          </span>
                                        )}
                                        {col.type === 'text' && (
                                          <span className="text-[#334155]">Double click row to type...</span>
                                        )}
                                        {col.type === 'number' && (
                                          <span className="text-[#334155]">0.00</span>
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}
      
    </div>
  )
}
