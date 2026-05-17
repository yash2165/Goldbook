'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Plus, Trash2, Toggle, CheckCircle2, AlertTriangle,
  TrendingDown, Clock, Target, Zap, Ban, BarChart2, Pencil, X, Save
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Rule type definitions ──────────────────────────────────────────────────────
const RULE_TEMPLATES = [
  {
    rule_type: 'daily_loss_limit',
    label: 'Daily Loss Limit',
    description: 'Stop trading if total losses for the day exceed this amount ($)',
    icon: TrendingDown,
    color: 'text-[#EF4444]',
    bg: 'bg-[#EF4444]/10',
    border: 'border-[#EF4444]/20',
    needsValue: true,
    valuePlaceholder: '100',
    valuePrefix: '$',
    valueSuffix: '',
  },
  {
    rule_type: 'max_trades_per_day',
    label: 'Max Trades Per Day',
    description: 'Do not take more than this many trades in a single day',
    icon: BarChart2,
    color: 'text-[#F59E0B]',
    bg: 'bg-[#F59E0B]/10',
    border: 'border-[#F59E0B]/20',
    needsValue: true,
    valuePlaceholder: '3',
    valuePrefix: '',
    valueSuffix: ' trades',
  },
  {
    rule_type: 'min_rr_ratio',
    label: 'Minimum R:R Ratio',
    description: 'Only take trades with a risk-to-reward ratio of at least this value',
    icon: Target,
    color: 'text-[#22C55E]',
    bg: 'bg-[#22C55E]/10',
    border: 'border-[#22C55E]/20',
    needsValue: true,
    valuePlaceholder: '1.5',
    valuePrefix: '1:',
    valueSuffix: '',
  },
  {
    rule_type: 'max_lot_size',
    label: 'Maximum Lot Size',
    description: 'Never risk more than this lot size on a single trade',
    icon: Shield,
    color: 'text-[#3B82F6]',
    bg: 'bg-[#3B82F6]/10',
    border: 'border-[#3B82F6]/20',
    needsValue: true,
    valuePlaceholder: '0.5',
    valuePrefix: '',
    valueSuffix: ' lots',
  },
  {
    rule_type: 'no_revenge_trade',
    label: 'No Revenge Trading',
    description: 'Do not open a new trade within 15 minutes of a losing trade',
    icon: Ban,
    color: 'text-[#8B5CF6]',
    bg: 'bg-[#8B5CF6]/10',
    border: 'border-[#8B5CF6]/20',
    needsValue: false,
    valuePlaceholder: '',
    valuePrefix: '',
    valueSuffix: '',
  },
  {
    rule_type: 'only_trade_session',
    label: 'Trade Specific Session Only',
    description: 'Only take trades during your best-performing market session',
    icon: Clock,
    color: 'text-[#06B6D4]',
    bg: 'bg-[#06B6D4]/10',
    border: 'border-[#06B6D4]/20',
    needsValue: false,
    needsStrValue: true,
    valueStrOptions: ['Asian', 'London', 'New York'],
    valuePlaceholder: '',
    valuePrefix: '',
    valueSuffix: '',
  },
  {
    rule_type: 'no_trade_after_loss',
    label: 'Stop After Consecutive Losses',
    description: 'Stop trading for the day after this many consecutive losses',
    icon: Zap,
    color: 'text-[#F97316]',
    bg: 'bg-[#F97316]/10',
    border: 'border-[#F97316]/20',
    needsValue: true,
    valuePlaceholder: '2',
    valuePrefix: '',
    valueSuffix: ' losses in a row',
  },
] as const

type RuleTemplate = typeof RULE_TEMPLATES[number]

interface TradingRule {
  id: string
  rule_type: string
  label: string
  description: string | null
  is_active: boolean
  value: number | null
  value_str: string | null
  created_at: string
}

// ── Add Rule Modal ────────────────────────────────────────────────────────────
function AddRuleModal({
  onClose,
  onSaved,
}: { onClose: () => void; onSaved: () => void }) {
  const [selected, setSelected] = useState<RuleTemplate | null>(null)
  const [value, setValue] = useState('')
  const [valueStr, setValueStr] = useState('London')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const save = async () => {
    if (!selected) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('trading_rules').insert({
      user_id: user.id,
      rule_type: selected.rule_type,
      label: selected.label,
      description: selected.description,
      is_active: true,
      value: selected.needsValue && value ? parseFloat(value) : null,
      value_str: (selected as any).needsStrValue ? valueStr : null,
    })

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="bg-[#12121a] border border-white/10 rounded-2xl p-6 w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Add Trading Rule</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-white/5 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {RULE_TEMPLATES.map(t => {
            const Icon = t.icon
            const isSelected = selected?.rule_type === t.rule_type
            return (
              <button
                key={t.rule_type}
                onClick={() => setSelected(t as any)}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                  isSelected
                    ? `${t.bg} ${t.border} border-2`
                    : 'bg-white/2 border-white/5 hover:bg-white/5'
                )}
              >
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', t.bg)}>
                  <Icon className={cn('w-4 h-4', t.color)} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{t.label}</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">{t.description}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Value input */}
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            {selected.needsValue && (
              <div>
                <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-2 block">
                  Set Threshold
                </label>
                <div className="flex items-center gap-2">
                  {selected.valuePrefix && (
                    <span className="text-[#64748B] font-mono text-sm">{selected.valuePrefix}</span>
                  )}
                  <input
                    type="number"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder={selected.valuePlaceholder}
                    className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  {selected.valueSuffix && (
                    <span className="text-[#64748B] text-sm">{selected.valueSuffix}</span>
                  )}
                </div>
              </div>
            )}
            {(selected as any).needsStrValue && (
              <div>
                <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-2 block">
                  Select Session
                </label>
                <div className="flex gap-2">
                  {(selected as any).valueStrOptions.map((opt: string) => (
                    <button
                      key={opt}
                      onClick={() => setValueStr(opt)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                        valueStr === opt
                          ? 'bg-[#06B6D4]/15 border-[#06B6D4]/30 text-[#06B6D4]'
                          : 'bg-white/5 border-white/5 text-[#64748B] hover:text-white'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#64748B] hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!selected || saving || (selected.needsValue && !value)}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/20"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Add Rule'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Rule Card ─────────────────────────────────────────────────────────────────
function RuleCard({
  rule,
  onToggle,
  onDelete,
  index,
}: {
  rule: TradingRule
  onToggle: (id: string, val: boolean) => void
  onDelete: (id: string) => void
  index: number
}) {
  const template = RULE_TEMPLATES.find(t => t.rule_type === rule.rule_type)
  const Icon = template?.icon ?? Shield

  const valueDisplay = (() => {
    if (rule.value_str) return rule.value_str
    if (rule.value === null) return null
    const t = template as any
    return `${t?.valuePrefix ?? ''}${rule.value}${t?.valueSuffix ?? ''}`
  })()

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex items-center gap-4 p-4 rounded-2xl border transition-all group',
        rule.is_active
          ? 'bg-[#12121a] border-white/5 hover:border-white/10'
          : 'bg-[#0d0d14] border-white/3 opacity-50'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
        template?.bg ?? 'bg-white/5'
      )}>
        <Icon className={cn('w-5 h-5', template?.color ?? 'text-white')} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm">{rule.label}</p>
          {valueDisplay && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-md font-mono font-bold',
              template?.bg ?? 'bg-white/5',
              template?.color ?? 'text-white'
            )}>
              {valueDisplay}
            </span>
          )}
        </div>
        <p className="text-xs text-[#64748B] mt-0.5 truncate">{rule.description}</p>
      </div>

      {/* Toggle */}
      <button
        onClick={() => onToggle(rule.id, !rule.is_active)}
        className={cn(
          'relative w-11 h-6 rounded-full border transition-all shrink-0',
          rule.is_active
            ? 'bg-primary border-primary'
            : 'bg-white/5 border-white/10'
        )}
      >
        <motion.div
          animate={{ x: rule.is_active ? 20 : 2 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
        />
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete(rule.id)}
        className="p-1.5 rounded-lg text-[#334155] hover:text-[#EF4444] hover:bg-[#EF4444]/5 transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RulesPage() {
  const [rules, setRules] = useState<TradingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const supabase = createClient()

  const loadRules = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('trading_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setRules((data as TradingRule[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadRules() }, [])

  const toggleRule = async (id: string, val: boolean) => {
    setRules(r => r.map(x => x.id === id ? { ...x, is_active: val } : x))
    await supabase.from('trading_rules').update({ is_active: val }).eq('id', id)
  }

  const deleteRule = async (id: string) => {
    setRules(r => r.filter(x => x.id !== id))
    await supabase.from('trading_rules').delete().eq('id', id)
  }

  const activeCount = rules.filter(r => r.is_active).length

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trading Rules</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Your personal rulebook. The AI coach monitors these and flags violations in every report.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Rule
        </motion.button>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-4"
      >
        {[
          { label: 'Total Rules', value: rules.length, color: 'text-white' },
          { label: 'Active', value: activeCount, color: 'text-[#22C55E]' },
          { label: 'Inactive', value: rules.length - activeCount, color: 'text-[#64748B]' },
        ].map(s => (
          <div key={s.label} className="bg-[#12121a] border border-white/5 rounded-2xl p-4 text-center">
            <p className={cn('text-2xl font-black tabular-nums', s.color)}>{s.value}</p>
            <p className="text-[11px] text-[#64748B] uppercase tracking-wider mt-1 font-semibold">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Info banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/15 rounded-2xl"
      >
        <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary">How Rules Work</p>
          <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
            Only <strong className="text-white">active</strong> rules are enforced. When you generate an AI Report,
            the coach will check every trade against your active rules, calculate your compliance score,
            and call out specific violations with timestamps.
          </p>
        </div>
      </motion.div>

      {/* Rules list */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-[#12121a] border border-white/5 rounded-2xl animate-pulse" />
          ))
        ) : rules.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 text-center"
          >
            <div className="w-16 h-16 bg-white/3 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-[#334155]" />
            </div>
            <p className="text-[#64748B] font-medium">No rules yet</p>
            <p className="text-sm text-[#334155] mt-1">Add your first rule to start tracking discipline</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-sm font-semibold transition-colors"
            >
              + Add Your First Rule
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {rules.map((rule, i) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                index={i}
                onToggle={toggleRule}
                onDelete={deleteRule}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && (
          <AddRuleModal
            onClose={() => setShowAdd(false)}
            onSaved={loadRules}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
