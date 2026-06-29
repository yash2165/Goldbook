'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Trash2, Save, ArrowLeft, Settings, 
  Layers, CheckSquare, List, Table, Type, Check, RefreshCw,
  X, Sparkles, Info, HelpCircle, ChevronDown, CheckCircle2
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

  // State for in-context block option text inputs
  const [inlineOptionTexts, setInlineOptionTexts] = useState<Record<string, string>>({})

  // State for active table column editor
  const [activeTableColEdit, setActiveTableColEdit] = useState<{ blockId: string; colId: string } | null>(null)
  
  // State for new column configuration inputs
  const [editColName, setEditColName] = useState('')
  const [editColType, setEditColType] = useState<'text' | 'number' | 'dropdown' | 'checkbox'>('text')
  const [editColOptsText, setEditColOptsText] = useState('')

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
          loadPreset('technical')
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
        loadPreset('technical')
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

  // Delete custom template to revert back to default psychological prompts
  const revertToDefault = async () => {
    if (confirm("Are you sure you want to delete your custom template and revert to the default GoldBook prompts? This will not delete your past trade logs.")) {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        localStorage.removeItem('goldbook_custom_template')
        setSaving(false)
        router.push('/journal')
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({ custom_journal_template: null })
        .eq('id', user.id)

      if (error) {
        const { data: profile } = await supabase.from('profiles').select('trading_setups').eq('id', user.id).single()
        const setups = profile?.trading_setups || {}
        const newSetups = { ...setups }
        delete (newSetups as any).__custom_journal_template
        await supabase.from('profiles').update({ trading_setups: newSetups }).eq('id', user.id)
      }

      setSaving(false)
      router.push('/journal')
    }
  }

  // Pre-designed templates quick-loader
  const loadPreset = (type: 'technical' | 'psychology' | 'smc' | 'nse_options' | 'equity_swing') => {
    if (type === 'technical') {
      setTemplateName('Technical Strategy Journal')
      setBlocks([
        { id: 'b1', type: 'header', label: '1. Strategy & Technical Triggers' },
        { id: 'b2', type: 'confirmations', label: 'Technical Entry Confirmations', options: ['Fib Retracement', 'VWAP Bounds', 'EMA Crossover', 'Support/Resistance Bounce', 'Liquidity Sweep'] },
        { id: 'b3', type: 'dropdown', label: 'Setup Quality Rating', options: ['High Quality A+', 'Medium Quality B', 'Impulsive/Fringe C'] },
        { id: 'b4', type: 'header', label: '2. Session Notes & Tactical Metrics' },
        { id: 'b5', type: 'table', label: 'Multi-Timeframe Structural Grid', columns: [
          { id: 'col1', label: 'Timeframe', type: 'dropdown', options: ['M5', 'M15', 'H1', 'H4', 'D1'] },
          { id: 'col2', label: 'Market Bias', type: 'dropdown', options: ['Bullish', 'Bearish', 'Sideways'] },
          { id: 'col3', label: 'Key Level (price)', type: 'number' },
          { id: 'col4', label: 'Aligned with Daily Trend', type: 'checkbox' }
        ] }
      ])
    } else if (type === 'psychology') {
      setTemplateName('Trading Psychology Review')
      setBlocks([
        { id: 'b1', type: 'header', label: '1. Emotional Diagnostics' },
        { id: 'b2', type: 'dropdown', label: 'Pre-Session Mental State', options: ['Calm & Focused', 'Anxious / Rushed', 'Fatigued / Sleepy', 'Revengeful'] },
        { id: 'b3', type: 'dropdown', label: 'Session Rule Adherence', options: ['100% Rule Respected', 'Minor FOMO Slippage', 'Revenge Trading Breach'] },
        { id: 'b4', type: 'header', label: '2. Mindset Notes & Rule Assessment' },
        { id: 'b5', type: 'paragraph', label: 'Session Psychology Notes', placeholder: 'Describe your emotional state during trade execution...' },
        { id: 'b6', type: 'table', label: 'Discipline Scorecard', columns: [
          { id: 'col1', label: 'Trading Rule Enforced', type: 'text' },
          { id: 'col2', label: 'Emotion Triggered', type: 'dropdown', options: ['Fear', 'Greed', 'FOMO', 'Patience', 'None'] },
          { id: 'col3', label: 'Respected', type: 'checkbox' }
        ] }
      ])
    } else if (type === 'smc') {
      setTemplateName('SMC Execution Journal')
      setBlocks([
        { id: 'b1', type: 'header', label: '1. Smart Money Confirmations' },
        { id: 'b2', type: 'confirmations', label: 'SMC Setup Triggers', options: ['Market Structure Shift (MSS)', 'Change of Character (CHoCH)', 'Fair Value Gap (FVG) Tap', 'Order Block Mitigation', 'Liquidity Sweep (BSL/SSL)'] },
        { id: 'b3', type: 'header', label: '2. Trade Leg Details' },
        { id: 'b4', type: 'table', label: 'Execution Leg Diagnostics', columns: [
          { id: 'col1', label: 'POI Timeframe', type: 'dropdown', options: ['H4', 'H1', 'M15', 'M5', 'M1'] },
          { id: 'col2', label: 'Volume (contracts)', type: 'number' },
          { id: 'col3', label: 'Displacement (pips)', type: 'number' },
          { id: 'col4', label: 'Structure Respected', type: 'checkbox' }
        ] }
      ])
    } else if (type === 'nse_options') {
      setTemplateName('NSE Options Scalper')
      setBlocks([
        { id: 'b1', type: 'header', label: '1. Option Setup & Technical Triggers' },
        { id: 'b2', type: 'confirmations', label: 'Entry Confirmations', options: ['OI Buildup', 'PCR Shift', 'VIX Drop', 'S/R Breakout', 'EMA Crossover', 'Price Action Shift'] },
        { id: 'b3', type: 'dropdown', label: 'Option Trade Type', options: ['Naked Buy', 'Naked Sell', 'Bull Call Spread', 'Bear Put Spread', 'Straddle/Strangle', 'Iron Condor'] },
        { id: 'b4', type: 'header', label: '2. Execution Leg Diagnostics' },
        { id: 'b5', type: 'table', label: 'Leg Details Grid', columns: [
          { id: 'col1', label: 'Option (CE/PE)', type: 'dropdown', options: ['CE', 'PE'] },
          { id: 'col2', label: 'Strike Price', type: 'number' },
          { id: 'col3', label: 'Entry Premium', type: 'number' },
          { id: 'col4', label: 'Exit Premium', type: 'number' },
          { id: 'col5', label: 'Lots', type: 'number' }
        ] },
        { id: 'b6', type: 'header', label: '3. Risk & Discipline Audit' },
        { id: 'b7', type: 'dropdown', label: 'Stop Loss Outcome', options: ['SL Respected', 'SL Moved (Violated)', 'Target Hit', 'Manual Exit', 'Expired Worthless'] },
        { id: 'b8', type: 'paragraph', label: 'Trade Reflection Notes', placeholder: 'Why did you enter this strike/expiry, and what lessons were learned?' }
      ])
    } else if (type === 'equity_swing') {
      setTemplateName('Indian Equity Swing')
      setBlocks([
        { id: 'b1', type: 'header', label: '1. Stock Setup & sector Analysis' },
        { id: 'b2', type: 'confirmations', label: 'Entry Signals', options: ['Trend Breakout', 'Pullback to Support', 'Volume Spike', 'Sector Strength', 'Corporate Earnings', 'Delivery % High'] },
        { id: 'b3', type: 'dropdown', label: 'Holding Period Intent', options: ['Intraday / Scalp', 'BTST (Buy Today Sell Tomorrow)', 'Short-Term Swing (2-5 Days)', 'Positional (1-4 Weeks)', 'Investment'] },
        { id: 'b4', type: 'header', label: '2. Swing Trade Position Tracker' },
        { id: 'b5', type: 'table', label: 'Leg Breakdown', columns: [
          { id: 'col1', label: 'Stock Symbol', type: 'text' },
          { id: 'col2', label: 'Entry Price', type: 'number' },
          { id: 'col3', label: 'Target Price', type: 'number' },
          { id: 'col4', label: 'Stop Loss', type: 'number' },
          { id: 'col5', label: 'Quantity', type: 'number' },
          { id: 'col6', label: 'Status', type: 'dropdown', options: ['Open', 'Target Hit', 'SL Hit', 'Manual Exit'] }
        ] },
        { id: 'b6', type: 'paragraph', label: 'Sector Context & Target Reasoning', placeholder: 'Describe the structural tailwinds or fundamental thesis...' }
      ])
    }
    setActiveTableColEdit(null)
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
          { id: `c_${Date.now()}_2`, label: 'Value', type: 'number' },
          { id: `c_${Date.now()}_3`, label: 'Checklist Rule', type: 'checkbox' }
        ]
      }
    }
    
    setBlocks(prev => [...prev, newBlock])
  }

  const deleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
    if (activeTableColEdit?.blockId === id) setActiveTableColEdit(null)
  }

  const updateBlockLabel = (id: string, newLabel: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, label: newLabel } : b))
  }

  const updateBlockPlaceholder = (id: string, newPlaceholder: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, placeholder: newPlaceholder } : b))
  }

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= blocks.length) return
    const newBlocks = [...blocks]
    const temp = newBlocks[index]
    newBlocks[index] = newBlocks[nextIndex]
    newBlocks[nextIndex] = temp
    setBlocks(newBlocks)
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
  const addColumnToTable = (blockId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === blockId && b.type === 'table') {
        const cols = b.columns || []
        const newColId = `col_${Date.now()}`
        const newCol = { id: newColId, label: `Column ${cols.length + 1}`, type: 'text' as const }
        
        // Open edit drawer for this new column automatically
        setTimeout(() => {
          setEditColName(`Column ${cols.length + 1}`)
          setEditColType('text')
          setEditColOptsText('')
          setActiveTableColEdit({ blockId, colId: newColId })
        }, 50)
        
        return { ...b, columns: [...cols, newCol] }
      }
      return b
    }))
  }

  const selectColumnForEdit = (blockId: string, colId: string, col: any) => {
    setEditColName(col.label)
    setEditColType(col.type)
    setEditColOptsText((col.options || []).join(', '))
    setActiveTableColEdit({ blockId, colId })
  }

  const saveColumnSettings = (blockId: string, colId: string) => {
    if (!editColName.trim()) return
    
    const parsedOptions = editColOptsText
      ? editColOptsText.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    setBlocks(prev => prev.map(b => {
      if (b.id === blockId && b.type === 'table') {
        const updatedCols = (b.columns || []).map(c => {
          if (c.id === colId) {
            return {
              ...c,
              label: editColName.trim(),
              type: editColType,
              options: editColType === 'dropdown' ? (parsedOptions || ['Option A', 'Option B']) : undefined
            }
          }
          return c
        })
        return { ...b, columns: updatedCols }
      }
      return b
    }))
    setActiveTableColEdit(null)
  }

  const removeColumnFromTable = (blockId: string, colId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === blockId && b.type === 'table') {
        return { ...b, columns: (b.columns || []).filter(c => c.id !== colId) }
      }
      return b
    }))
    if (activeTableColEdit?.colId === colId) {
      setActiveTableColEdit(null)
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 min-h-screen">
      
      {/* Header navbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-4">
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
            <p className="text-xs text-[#64748B] mt-0.5">Design customized layouts inline and save them directly as your default template.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="bg-[#060A12] border border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 w-full sm:w-64 text-left sm:text-right"
            placeholder="Template name..."
          />
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={revertToDefault}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl text-xs font-bold transition-all cursor-pointer w-full sm:w-auto"
          >
            Revert to Default
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={saveTemplate}
            disabled={saving}
            className={cn(
              "flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg cursor-pointer w-full sm:w-auto",
              saved 
                ? "bg-emerald-500 text-white shadow-emerald-500/25" 
                : "bg-primary text-black shadow-primary/20 hover:bg-primary/95"
            )}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "✓ SAVED TO CLOUD" : "SAVE JOURNAL TEMPLATE"}
          </motion.button>
        </div>
      </div>

      {/* Preset loaders */}
      <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-black uppercase text-[#64748B]">Load Preset Layout:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'technical', label: 'Technical Setup Review', desc: 'Confirmations list & dynamic structure grid' },
            { id: 'psychology', label: 'Mindset & Psychology', desc: 'Emotion selectors & scorecard checklist' },
            { id: 'smc', label: 'SMC Execution', desc: 'MSS/CHoCH confirmations & POI statistics' },
            { id: 'nse_options', label: 'NSE Options Scalper', desc: 'OI, strike details & option trade log' },
            { id: 'equity_swing', label: 'Indian Equity Swing', desc: 'Sector bias, targets & position logger' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => loadPreset(p.id as any)}
              className="px-3.5 py-2 bg-[#060A12] hover:bg-white/5 border border-white/5 hover:border-primary/30 rounded-xl text-left transition-all cursor-pointer flex-1 min-w-[200px]"
            >
              <p className="text-xs font-bold text-white leading-none">{p.label}</p>
              <p className="text-[9px] text-[#64748B] mt-1">{p.desc}</p>
            </button>
          ))}
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Blocks selector sidebar (1 Col) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B]">Block Store catalog</h3>
              <p className="text-[10px] text-[#64748B] leading-normal">
                Click blocks to add them to your custom template. You can configure their columns and dropdown labels directly inside the cards!
              </p>
              
              <div className="grid grid-cols-1 gap-2">
                {[
                  { type: 'header', label: 'Section Header', icon: Layers, desc: 'Groups sections beautifully' },
                  { type: 'paragraph', label: 'Text Prompt', icon: Type, desc: 'For review notes and comments' },
                  { type: 'dropdown', label: 'Single Tag Selector', icon: List, desc: 'Dropdown to pick one tag' },
                  { type: 'confirmations', label: 'Multi-Checklist list', icon: CheckSquare, desc: 'Confirm rules or confirmations' },
                  { type: 'table', label: 'Notion Database Table', icon: Table, desc: 'Dynamic column grid with formulas' }
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
                      <p className="text-[9px] text-[#64748B] mt-1">{b.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="bg-[#060A12] border border-white/5 rounded-2xl p-4 flex gap-2.5 items-start">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] text-[#64748B] leading-relaxed">
                <strong>How to Edit:</strong> Every block on the canvas is interactive! Type titles, add dropdown labels, and configure spreadsheet columns directly inside the blocks on the right.
              </p>
            </div>
          </div>

          {/* Dynamic Canvas (3 Cols) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-[#0D1421] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
              
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span className="text-xs text-primary font-black uppercase tracking-widest">Dynamic Notion Canvas Preview</span>
                </div>
                <span className="text-[10px] text-[#64748B] font-semibold">Real-time design mode</span>
              </div>

              {blocks.length === 0 ? (
                <div className="py-28 text-center border-2 border-dashed border-white/10 rounded-2xl text-[#334155] text-xs flex flex-col items-center justify-center space-y-3">
                  <Layers className="w-10 h-10 opacity-30" />
                  <div>
                    <p className="font-bold text-white/90">Your custom journal canvas is empty.</p>
                    <p className="mt-1 text-[#64748B]">Click any block in the catalog store on the left to begin building.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {blocks.map((block, idx) => {
                    const blockOptVal = inlineOptionTexts[block.id] || ''
                    
                    return (
                      <motion.div
                        key={block.id}
                        layout
                        className="p-5 rounded-2xl bg-[#060A12]/40 border border-white/5 hover:border-white/10 transition-all relative group"
                      >
                        {/* Drag and Sort quick buttons */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => moveBlock(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 bg-white/5 rounded hover:bg-white/10 text-[#64748B] hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Block Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBlock(idx, 'down')}
                            disabled={idx === blocks.length - 1}
                            className="p-1.5 bg-white/5 rounded hover:bg-white/10 text-[#64748B] hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Block Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBlock(block.id)}
                            className="p-1.5 bg-red-500/15 border border-red-500/25 rounded hover:bg-red-500/30 text-red-400 cursor-pointer"
                            title="Delete Block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* ── 1. RENDER HEADER BLOCK ── */}
                        {block.type === 'header' && (
                          <div className="space-y-1 py-1 max-w-[85%]">
                            <input
                              type="text"
                              value={block.label}
                              onChange={e => updateBlockLabel(block.id, e.target.value)}
                              className="w-full bg-transparent border-b border-dashed border-white/10 focus:border-primary/50 text-sm font-black text-slate-100 uppercase tracking-wider focus:outline-none py-0.5"
                              placeholder="Header Title..."
                            />
                            <p className="text-[8px] text-[#64748B] font-mono tracking-widest uppercase">Header division block</p>
                          </div>
                        )}

                        {/* ── 2. RENDER TEXT FIELD BLOCK ── */}
                        {block.type === 'paragraph' && (
                          <div className="space-y-2.5">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={block.label}
                                onChange={e => updateBlockLabel(block.id, e.target.value)}
                                className="w-3/4 bg-transparent border-b border-dashed border-white/10 focus:border-primary/50 text-xs font-bold text-slate-200 focus:outline-none py-0.5"
                                placeholder="Text Prompt Label..."
                              />
                              <p className="text-[8px] text-[#64748B] font-mono tracking-widest uppercase">Text note block</p>
                            </div>
                            <textarea
                              disabled
                              rows={2}
                              placeholder="Text notes canvas (Traders will type here...)"
                              className="w-full bg-[#0D1421]/30 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-[#334155] placeholder-[#334155] cursor-not-allowed resize-none leading-relaxed"
                            />
                            <div className="flex gap-2 items-center">
                              <span className="text-[9px] text-[#64748B] font-mono uppercase">Placeholder:</span>
                              <input
                                type="text"
                                value={block.placeholder || ''}
                                onChange={e => updateBlockPlaceholder(block.id, e.target.value)}
                                className="bg-[#060A12] border border-white/10 rounded-lg px-2 py-0.5 text-[10px] text-[#64748B] focus:outline-none focus:border-primary/50 w-64"
                                placeholder="Change prompt placeholder..."
                              />
                            </div>
                          </div>
                        )}

                        {/* ── 3. RENDER DROPDOWN BLOCK ── */}
                        {block.type === 'dropdown' && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={block.label}
                                onChange={e => updateBlockLabel(block.id, e.target.value)}
                                className="w-3/4 bg-transparent border-b border-dashed border-white/10 focus:border-primary/50 text-xs font-bold text-slate-200 focus:outline-none py-0.5"
                                placeholder="Dropdown Selector Label..."
                              />
                              <p className="text-[8px] text-[#64748B] font-mono tracking-widest uppercase">Single Choice Dropdown</p>
                            </div>

                            <div className="bg-[#0D1421]/60 rounded-xl p-3.5 border border-white/5 space-y-3">
                              {/* inline list editor */}
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {(block.options || []).map(opt => (
                                  <span key={opt} className="text-[10px] px-2.5 py-1 rounded-lg border border-[#1E3A5F] bg-[#1E3A5F]/20 text-[#7DD3FC] flex items-center gap-1.5 font-bold">
                                    {opt}
                                    <button 
                                      type="button" 
                                      onClick={() => removeOptionFromBlock(block.id, opt)} 
                                      className="text-primary hover:text-red-400 font-bold text-xs"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                                {(block.options || []).length === 0 && (
                                  <span className="text-[10px] text-[#64748B] italic">No selector options defined. Add options below.</span>
                                )}
                              </div>

                              {/* inline addition form */}
                              <div className="flex gap-2 max-w-sm">
                                <input
                                  type="text"
                                  placeholder="New option name..."
                                  value={blockOptVal}
                                  onChange={e => setInlineOptionTexts(prev => ({ ...prev, [block.id]: e.target.value }))}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      addOptionToBlock(block.id, blockOptVal)
                                      setInlineOptionTexts(prev => ({ ...prev, [block.id]: '' }))
                                    }
                                  }}
                                  className="flex-1 bg-[#060A12] border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-white focus:outline-none focus:border-primary/50"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    addOptionToBlock(block.id, blockOptVal)
                                    setInlineOptionTexts(prev => ({ ...prev, [block.id]: '' }))
                                  }}
                                  className="px-2.5 py-1 bg-primary text-black rounded-lg text-[10px] font-bold cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                              <p className="text-[9px] text-[#64748B] italic">💡 Notion Tip: Type an option title above and click Add (or press Enter) to set options tags.</p>
                            </div>
                          </div>
                        )}

                        {/* ── 4. RENDER MULTI-SELECT CONFIRMATIONS ── */}
                        {block.type === 'confirmations' && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={block.label}
                                onChange={e => updateBlockLabel(block.id, e.target.value)}
                                className="w-3/4 bg-transparent border-b border-dashed border-white/10 focus:border-primary/50 text-xs font-bold text-slate-200 focus:outline-none py-0.5"
                                placeholder="Checklist Label..."
                              />
                              <p className="text-[8px] text-[#64748B] font-mono tracking-widest uppercase">Multi-Select confirmations checklist</p>
                            </div>

                            <div className="bg-[#0D1421]/60 rounded-xl p-3.5 border border-white/5 space-y-3">
                              {/* Checkbox preview list */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {(block.options || []).map(opt => (
                                  <div key={opt} className="flex items-center justify-between gap-2 px-3 py-1.5 border border-white/5 bg-[#060A12]/30 rounded-lg text-[11px] text-[#94A3B8] font-bold">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-3.5 h-3.5 rounded border border-white/10 bg-white/5 shrink-0" />
                                      <span className="truncate">{opt}</span>
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => removeOptionFromBlock(block.id, opt)}
                                      className="text-[#64748B] hover:text-red-400 font-bold shrink-0 pl-1"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                                {(block.options || []).length === 0 && (
                                  <span className="text-[10px] text-[#64748B] italic col-span-3">No confirmation items defined. Add items below.</span>
                                )}
                              </div>

                              {/* inline addition form */}
                              <div className="flex gap-2 max-w-sm">
                                <input
                                  type="text"
                                  placeholder="New entry criteria tag..."
                                  value={blockOptVal}
                                  onChange={e => setInlineOptionTexts(prev => ({ ...prev, [block.id]: e.target.value }))}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      addOptionToBlock(block.id, blockOptVal)
                                      setInlineOptionTexts(prev => ({ ...prev, [block.id]: '' }))
                                    }
                                  }}
                                  className="flex-1 bg-[#060A12] border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-white focus:outline-none focus:border-primary/50"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    addOptionToBlock(block.id, blockOptVal)
                                    setInlineOptionTexts(prev => ({ ...prev, [block.id]: '' }))
                                  }}
                                  className="px-2.5 py-1 bg-primary text-black rounded-lg text-[10px] font-bold cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                              <p className="text-[9px] text-[#64748B] italic">💡 Notion Tip: These items represent checkable execution rules that will render on your journal logs card.</p>
                            </div>
                          </div>
                        )}

                        {/* ── 5. RENDER NOTION DATABASE TABLE ── */}
                        {block.type === 'table' && (
                          <div className="space-y-3.5">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={block.label}
                                onChange={e => updateBlockLabel(block.id, e.target.value)}
                                className="w-3/4 bg-transparent border-b border-dashed border-white/10 focus:border-primary/50 text-xs font-bold text-slate-200 focus:outline-none py-0.5"
                                placeholder="Grid Table Label..."
                              />
                              <p className="text-[8px] text-[#64748B] font-mono tracking-widest uppercase">Tabular Grid database table</p>
                            </div>

                            {/* Spreadsheet Table formation */}
                            <div className="overflow-x-auto border border-white/5 bg-[#0D1421]/60 rounded-xl">
                              <table className="w-full text-left border-collapse text-[10px]">
                                <thead>
                                  <tr className="border-b border-white/5 bg-white/2 text-[8px] text-[#64748B] uppercase tracking-wider font-bold">
                                    {(block.columns || []).map(col => {
                                      const isBeingEdited = activeTableColEdit?.blockId === block.id && activeTableColEdit?.colId === col.id
                                      return (
                                        <th 
                                          key={col.id} 
                                          className={cn(
                                            "py-2.5 px-3 border-r border-white/5 cursor-pointer hover:bg-white/5 transition-all group/header",
                                            isBeingEdited && "bg-primary/5 text-primary"
                                          )}
                                          onClick={() => selectColumnForEdit(block.id, col.id, col)}
                                        >
                                          <div className="flex items-center justify-between gap-1.5">
                                            <div className="flex items-center gap-1">
                                              <span className="text-white group-hover/header:text-primary transition-colors">{col.label}</span>
                                              <span className="text-[7px] text-[#64748B] bg-white/5 px-1 rounded-sm tracking-normal">{col.type}</span>
                                            </div>
                                            <ChevronDown className="w-2.5 h-2.5 opacity-40 group-hover/header:opacity-100 transition-opacity" />
                                          </div>
                                        </th>
                                      )
                                    })}
                                    {/* clickable Plus column */}
                                    <th className="py-2 px-3 w-10 text-center bg-white/1">
                                      <button
                                        type="button"
                                        onClick={() => addColumnToTable(block.id)}
                                        className="w-5 h-5 mx-auto rounded bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-black flex items-center justify-center transition-all cursor-pointer"
                                        title="Add New Column Database Grid"
                                      >
                                        <Plus className="w-3 h-3 stroke-[2.5]" />
                                      </button>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Visual template row */}
                                  <tr className="text-slate-400 bg-[#060A12]/20 border-b border-white/4">
                                    {(block.columns || []).map(col => (
                                      <td key={col.id} className="py-3 px-3 border-r border-white/5">
                                        {col.type === 'checkbox' && (
                                          <div className="w-3.5 h-3.5 rounded border border-white/10 bg-white/5 mx-auto cursor-not-allowed" />
                                        )}
                                        {col.type === 'dropdown' && (
                                          <div className="px-2 py-0.5 rounded border border-white/5 bg-white/5 text-[8px] text-[#64748B] uppercase font-bold w-max max-w-full truncate">
                                            {col.options?.[0] || 'Select Option'}
                                          </div>
                                        )}
                                        {col.type === 'text' && (
                                          <span className="text-[#334155] italic">Row value text...</span>
                                        )}
                                        {col.type === 'number' && (
                                          <span className="text-[#334155] font-mono text-right block">0.00</span>
                                        )}
                                      </td>
                                    ))}
                                    <td className="bg-white/1" />
                                  </tr>
                                  {/* Empty state columns */}
                                  {(block.columns || []).length === 0 && (
                                    <tr>
                                      <td className="py-6 text-center text-[#64748B] italic text-[9px]">
                                        Grid Table has no columns. Tap the "+" button on the header to create a database column.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* ── INLINE COLUMN CONFIG DRAWER ── */}
                            <AnimatePresence>
                              {activeTableColEdit?.blockId === block.id && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="bg-[#0D1421] border border-primary/30 rounded-xl p-4 mt-2 space-y-3.5 shadow-xl relative overflow-hidden"
                                >
                                  <div className="flex items-center justify-between text-[9px] font-black uppercase text-[#64748B] border-b border-white/5 pb-2">
                                    <span className="flex items-center gap-1 text-primary">
                                      <Settings className="w-3 h-3" /> Column Properties Configurator
                                    </span>
                                    <button 
                                      type="button" 
                                      onClick={() => setActiveTableColEdit(null)} 
                                      className="text-[#64748B] hover:text-white font-bold text-xs"
                                    >
                                      ×
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#64748B] uppercase font-bold tracking-wider block">Column Name</label>
                                      <input
                                        type="text"
                                        value={editColName}
                                        onChange={e => setEditColName(e.target.value)}
                                        className="w-full bg-[#060A12] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-primary/50 font-bold"
                                        placeholder="Column header title..."
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#64748B] uppercase font-bold tracking-wider block">Data Field Type</label>
                                      <select
                                        value={editColType}
                                        onChange={e => setEditColType(e.target.value as any)}
                                        className="w-full bg-[#060A12] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none [color-scheme:dark] font-bold"
                                      >
                                        <option value="text">Text Column</option>
                                        <option value="number">Number Column</option>
                                        <option value="checkbox">Checkbox Check</option>
                                        <option value="dropdown">Dropdown Options</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] text-[#64748B] uppercase font-bold tracking-wider block">
                                        Dropdown Options {editColType === 'dropdown' ? '(*Required)' : '(Disabled)'}
                                      </label>
                                      <input
                                        type="text"
                                        value={editColOptsText}
                                        onChange={e => setEditColOptsText(e.target.value)}
                                        disabled={editColType !== 'dropdown'}
                                        className="w-full bg-[#060A12] disabled:opacity-30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-primary/50 placeholder:text-[#334155]"
                                        placeholder="e.g. Bullish, Bearish, Range"
                                      />
                                    </div>
                                  </div>

                                  {editColType === 'dropdown' && (
                                    <p className="text-[8px] text-[#64748B]">💡 Options Note: Separate multiple options with commas (e.g. M5, M15, H1).</p>
                                  )}

                                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                    <button
                                      type="button"
                                      onClick={() => removeColumnFromTable(block.id, activeTableColEdit.colId)}
                                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" /> Remove Column
                                    </button>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setActiveTableColEdit(null)}
                                        className="px-3 py-1.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => saveColumnSettings(block.id, activeTableColEdit.colId)}
                                        className="px-3.5 py-1.5 bg-primary text-black hover:bg-primary/95 rounded-lg text-[10px] font-black cursor-pointer"
                                      >
                                        Save Changes
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            
                            <p className="text-[9px] text-[#64748B] italic">
                              💡 Table Database Guide: Tap any column header cell (e.g., Column 1) to rename it, choose its type, or remove it. Tap the "+" column header on the right to append new headers.
                            </p>
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
