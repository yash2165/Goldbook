'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, CheckCircle2, Shield, Target, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TradingRule {
  id?: string
  rule_type: string
  label: string
  is_active: boolean
  value: number | null
}

const PRIMARY_RULES = [
  {
    type: 'max_risk_per_trade',
    label: 'Maximum Risk Per Trade',
    description: 'The highest percentage of your balance you are willing to risk on a single position.',
    icon: Target,
    color: 'text-primary',
    bg: 'bg-primary/10',
    min: 0.25, max: 10, step: 0.25,
    presets: [0.5, 1, 2, 3, 5],
    suffix: '%'
  },
  {
    type: 'daily_loss_limit',
    label: 'Daily Loss Limit',
    description: 'Stop trading for the day if your total losses reach this threshold.',
    icon: Shield,
    color: 'text-primary',
    bg: 'bg-primary/10',
    min: 1, max: 20, step: 1,
    presets: [3, 5, 10, 15],
    suffix: '%'
  },
  {
    type: 'max_trades_per_day',
    label: 'Max Trades Per Day',
    description: 'Avoid overtrading by setting a hard limit on total daily executions.',
    icon: BarChart2,
    color: 'text-primary',
    bg: 'bg-primary/10',
    min: 1, max: 50, step: 1,
    presets: [3, 5, 10, 15, 20],
    suffix: ' trades'
  }
]

export default function RulesPage() {
  const [rules, setRules] = useState<Record<string, TradingRule>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('trading_rules').select('*').eq('user_id', user.id)
      
      const loadedRules: Record<string, TradingRule> = {}
      data?.forEach(r => {
        loadedRules[r.rule_type] = r
      })

      PRIMARY_RULES.forEach(pr => {
        if (!loadedRules[pr.type]) {
          loadedRules[pr.type] = {
            rule_type: pr.type,
            label: pr.label,
            is_active: true,
            value: pr.presets[Math.floor(pr.presets.length / 2)]
          }
        }
      })

      setRules(loadedRules)
      setLoading(false)
    }
    load()
  }, [])

  const handleValueChange = (type: string, value: number) => {
    setRules(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        value
      }
    }))
  }

  const saveRules = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const rulesToUpsert = PRIMARY_RULES.map(pr => {
      const r = rules[pr.type]
      return {
        ...(r.id ? { id: r.id } : {}),
        user_id: user.id,
        rule_type: r.rule_type,
        label: r.label,
        is_active: true,
        value: r.value
      }
    })

    await supabase.from('trading_rules').upsert(rulesToUpsert, { onConflict: 'id' })
    
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return <div className="p-12 text-center text-[#64748B]">Loading your parameters...</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto h-[calc(100vh-64px)] flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="mb-12 max-w-xl">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary mb-4">
            <span className="w-8 h-[2px] bg-primary"></span>
            RISK MANAGEMENT
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Discipline Parameters</h1>
          <p className="text-[#94A3B8] text-sm leading-relaxed max-w-md">
            Set your non-negotiable boundaries. Nirikshan will track your compliance with these rules across all connected accounts.
          </p>
        </div>

        <div className="space-y-10">
          {PRIMARY_RULES.map(ruleDef => {
            const currentVal = rules[ruleDef.type]?.value || ruleDef.presets[0]
            const percentage = ((currentVal - ruleDef.min) / (ruleDef.max - ruleDef.min)) * 100

            return (
              <div key={ruleDef.type} className="bg-[#12121a] border border-white/5 rounded-2xl p-6 md:p-8">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div className="flex gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", ruleDef.bg)}>
                      <ruleDef.icon className={cn("w-6 h-6", ruleDef.color)} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{ruleDef.label}</h3>
                      <p className="text-sm text-[#64748B] mt-1">{ruleDef.description}</p>
                    </div>
                  </div>
                  
                  <div className="bg-[#0d1017] border border-white/10 rounded-xl px-6 py-3 flex items-center justify-center min-w-[120px]">
                    <span className="text-2xl font-black text-white tabular-nums">{currentVal}</span>
                    <span className="text-sm font-bold text-[#64748B] ml-1">{ruleDef.suffix.trim()}</span>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Slider Control */}
                  <div className="relative pt-4 pb-2">
                    <div className="h-2 w-full bg-[#1e293b] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-200 ease-out" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={ruleDef.min}
                      max={ruleDef.max}
                      step={ruleDef.step}
                      value={currentVal}
                      onChange={(e) => handleValueChange(ruleDef.type, parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-[4px] border-primary pointer-events-none transition-all duration-200 ease-out"
                      style={{ left: `calc(${percentage}% - 12px)` }} 
                    />
                  </div>

                  {/* Quick Select Presets */}
                  <div className="flex flex-wrap gap-3">
                    {ruleDef.presets.map(preset => (
                      <button
                        key={preset}
                        onClick={() => handleValueChange(ruleDef.type, preset)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all flex-1 md:flex-none",
                          currentVal === preset 
                            ? "bg-primary/20 text-primary border border-primary/50" 
                            : "bg-[#1e293b] text-[#94A3B8] hover:bg-[#334155] border border-transparent"
                        )}
                      >
                        {preset}{ruleDef.suffix.replace(' ', '')}
                      </button>
                    ))}
                  </div>
                </div>
                
              </div>
            )
          })}
        </div>
      </div>

      <div className="pt-6 border-t border-white/5 flex justify-end shrink-0 bg-[#0a0a0f] sticky bottom-0 z-10">
        <button
          onClick={saveRules}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition-all uppercase tracking-wider',
            saved ? 'bg-[#22C55E] text-white' : 'bg-primary hover:bg-primary/90 text-white'
          )}
        >
          {saved ? <><CheckCircle2 className="w-4 h-4" /> Rules Applied</> : saving ? 'Saving...' : 'Save Parameters'}
        </button>
      </div>
    </div>
  )
}
