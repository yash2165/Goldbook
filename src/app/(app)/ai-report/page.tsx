'use client'

import { useState, useEffect } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { 
  Bot, Share2, RefreshCcw, CheckCircle2, XCircle, Eye, AlertTriangle, 
  Brain, Zap, Gauge, Timer, Sparkles, Scale, ChevronDown, ChevronUp, 
  Award, ShieldAlert, Heart, Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { flipCardVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/animations'
import { TypewriterText } from '@/components/TypewriterText'
import IntelligenceOrb from '@/components/IntelligenceOrb'
import confetti from 'canvas-confetti'
import { createClient } from '@/lib/supabase/client'

export default function AIReportPage() {
  const { activeAccount } = useAccounts()
  const { trades } = useTrades(activeAccount?.id)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [provider, setProvider] = useState<'gemini' | 'groq' | null>(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fetchingSaved, setFetchingSaved] = useState(true)
  const [expandedBias, setExpandedBias] = useState<string | null>(null)
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null)
  const [skipAnimation, setSkipAnimation] = useState(false)
  const [copied, setCopied] = useState(false)

  const messages = [
    'Running Deep Psychological Telemetry calculations...',
    'Analyzing Loss Aversion hold-time ratios...',
    'Detecting Revenge Trading position sizing multipliers...',
    'Calculating Overtrading & decision fatigue expectancy decay...',
    'Correlating pre-trade emotional states with checklist compliance...',
    'Activating Nirikshan Cognitive Trading Therapist engine...',
    'Structuring diagnostic schema and clinical exercises...',
  ]

  const handleShare = () => {
    if (!report) return
    const text = `GoldBook AI Psychological Behavior Diagnostic Audit:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Grade: ${report.grade}
Risk Score: ${report.risk_score}/10
Consistency Score: ${report.consistency_score}/10
Discipline Score: ${report.discipline_score}/10

Coaching Summary:
"${report.summary}"

Track your behavioral metrics for free on GoldBook! https://goldbook-roan.vercel.app`
    
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── 1. Fetch saved report on load/activeAccount change ───────────────────
  useEffect(() => {
    async function loadSavedReport() {
      if (!activeAccount?.id) {
        setReport(null)
        setFetchingSaved(false)
        return
      }
      setFetchingSaved(true)
      try {
        const supabase = createClient()
        const { data, error: dbErr } = await supabase
          .from('ai_reports')
          .select('*')
          .eq('account_id', activeAccount.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (dbErr) throw dbErr
        if (data && data.length > 0) {
          const dbRow = data[0]
          setReport({
            grade: dbRow.grade,
            grade_reason: dbRow.grade_reason,
            strengths: dbRow.strengths,
            weaknesses: dbRow.weaknesses,
            blind_spots: dbRow.blind_spots,
            revenge_trading_detected: dbRow.revenge_trading_detected,
            best_session: dbRow.best_session,
            worst_session: dbRow.worst_session,
            best_day: dbRow.best_day,
            worst_day: dbRow.worst_day,
            risk_score: dbRow.risk_score,
            consistency_score: dbRow.consistency_score,
            discipline_score: dbRow.discipline_score,
            action_plan: dbRow.action_plan,
            summary: dbRow.summary,
            trades_analyzed: dbRow.trades_analyzed,
            rules_compliance_score: dbRow.rules_compliance_score,
            rules_analysis: dbRow.rules_analysis?.observations ?? [],
            emotion_insights: dbRow.rules_analysis?.emotion_insights ?? [],
            cognitive_biases: dbRow.rules_analysis?.cognitive_biases ?? [],
            emotion_correlations: dbRow.rules_analysis?.emotion_correlations ?? [],
            discipline_breaches_correlation: dbRow.rules_analysis?.discipline_breaches_correlation ?? '',
          })
          setProvider(dbRow.provider ?? 'gemini')
        } else {
          setReport(null)
        }
      } catch (err: any) {
        console.error('Failed to load saved report:', err)
      } finally {
        setFetchingSaved(false)
      }
    }

    loadSavedReport()
  }, [activeAccount?.id])

  const generate = async () => {
    setLoading(true)
    setError(null)
    setReport(null)
    setSkipAnimation(false)

    let i = 0
    setLoadingMsg(messages[0])
    const interval = setInterval(() => {
      i = (i + 1) % messages.length
      setLoadingMsg(messages[i])
    }, 1800)

    try {
      const res = await fetch('/api/ai/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: activeAccount?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setReport({
        grade: data.report.grade,
        grade_reason: data.report.grade_reason,
        strengths: data.report.strengths,
        weaknesses: data.report.weaknesses,
        blind_spots: data.report.blind_spots,
        revenge_trading_detected: data.report.revenge_trading_detected,
        best_session: data.report.best_session,
        worst_session: data.report.worst_session,
        best_day: data.report.best_day,
        worst_day: data.report.worst_day,
        risk_score: data.report.risk_score,
        consistency_score: data.report.consistency_score,
        discipline_score: data.report.discipline_score,
        action_plan: data.report.action_plan,
        summary: data.report.summary,
        trades_analyzed: data.report.trades_analyzed,
        rules_compliance_score: data.report.rules_compliance_score,
        rules_analysis: data.report.rules_analysis ?? [],
        emotion_insights: data.report.emotion_insights ?? [],
        cognitive_biases: data.report.cognitive_biases ?? [],
        emotion_correlations: data.report.emotion_correlations ?? [],
        discipline_breaches_correlation: data.report.discipline_breaches_correlation ?? '',
      })
      setProvider(data.provider)
      
      if (data.report.grade.startsWith('A')) {
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.5 },
            colors: ['#F59E0B', '#22C55E', '#FFFFFF']
          })
        }, 1200)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      clearInterval(interval)
      setLoading(false)
    }
  }

  const gradeColor = (g: string) => {
    if (!g) return 'text-[#64748B]'
    if (g.startsWith('A')) return 'text-[#F59E0B]'
    if (g.startsWith('B')) return 'text-[#22C55E]'
    if (g.startsWith('C')) return 'text-yellow-400'
    if (g.startsWith('D')) return 'text-orange-400'
    return 'text-[#EF4444]'
  }

  const gradeGlow = (g: string) => {
    if (!g) return ''
    if (g.startsWith('A')) return 'drop-shadow-[0_0_30px_rgba(245,158,11,0.4)]'
    if (g.startsWith('B')) return 'drop-shadow-[0_0_30px_rgba(34,197,94,0.4)]'
    return 'drop-shadow-[0_0_30px_rgba(239,68,68,0.4)]'
  }

  const emotionColors = (emo: string) => {
    const e = emo.toLowerCase().trim()
    if (['confident', 'satisfied', 'proud'].includes(e)) return {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30 text-emerald-400',
      text: 'text-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
      bar: '#10B981',
      bgRaw: 'rgba(16,185,129,0.1)'
    }
    if (['excited', 'relieved'].includes(e)) return {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30 text-cyan-400',
      text: 'text-cyan-400',
      glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
      bar: '#06B6D4',
      bgRaw: 'rgba(6,182,212,0.1)'
    }
    if (['nervous', 'regret'].includes(e)) return {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30 text-purple-400',
      text: 'text-purple-400',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
      bar: '#A855F7',
      bgRaw: 'rgba(168,85,247,0.1)'
    }
    if (['fearful', 'frustrated'].includes(e)) return {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30 text-red-400',
      text: 'text-red-400',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
      bar: '#EF4444',
      bgRaw: 'rgba(239,68,68,0.1)'
    }
    if (['greedy'].includes(e)) return {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30 text-amber-400',
      text: 'text-amber-400',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      bar: '#F59E0B',
      bgRaw: 'rgba(245,158,11,0.1)'
    }
    return {
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30 text-slate-400',
      text: 'text-slate-400',
      glow: 'shadow-[0_0_15px_rgba(100,116,139,0.15)]',
      bar: '#64748B',
      bgRaw: 'rgba(100,116,139,0.1)'
    }
  }

  // Fallback / default biases if not present
  const activeBiases = (report?.cognitive_biases && report.cognitive_biases.length > 0) 
    ? report.cognitive_biases 
    : [
        {
          bias_name: "Loss Aversion",
          severity: "healthy",
          evidence: "Hold times are balanced. No abnormal losses held excessively.",
          description: "The cognitive bias where traders hold losing positions hoping they return to breakeven, while cutting winners too quickly.",
          psychological_exercise: "Implement a strict 'Time-Stop' rule: if a trade doesn't move in your favor within 20 minutes, close it immediately."
        },
        {
          bias_name: "Revenge Trading",
          severity: "healthy",
          evidence: "No significant lot-size spikes immediately after closed losses.",
          description: "Impulsive over-leveraging after taking a loss, fueled by anger and the urge to 'make the market pay you back'.",
          psychological_exercise: "Create a mandatory '15-Minute Screen Lock' physical cooldown rule immediately following any trade loss."
        },
        {
          bias_name: "Overconfidence/FOMO",
          severity: "healthy",
          evidence: "High checklist discipline is maintained consistently.",
          description: "Entering low-quality setups out of greed, or scaling into oversized trades after a winning streak.",
          psychological_exercise: "Perform 'Pre-Mortem Analysis': before entering any trade, document exactly how it could fail based on stats."
        },
        {
          bias_name: "Mental Fatigue",
          severity: "healthy",
          evidence: "Win rate holds steady. Good daily trade limit discipline.",
          description: "Cognitive exhaustion resulting in poor execution, rule breaches, and performance degradation after taking too many daily trades.",
          psychological_exercise: "Set a strict hard cap of maximum 4 trades per day, locking MT5 credentials after completion."
        }
      ]

  const biasSeverityIcon = (sev: string) => {
    const s = sev.toLowerCase()
    if (s === 'critical') return <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
    if (s === 'moderate') return <AlertTriangle className="w-5 h-5 text-amber-500" />
    return <CheckCircle2 className="w-5 h-5 text-emerald-500" />
  }

  const biasSeverityStyle = (sev: string) => {
    const s = sev.toLowerCase()
    if (s === 'critical') return {
      badge: 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]',
      border: 'border-red-500/30 hover:border-red-500/50',
      dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
    }
    if (s === 'moderate') return {
      badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
      border: 'border-amber-500/30 hover:border-amber-500/50',
      dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
    }
    return {
      badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
      border: 'border-emerald-500/10 hover:border-emerald-500/30',
      dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <IntelligenceOrb size={26} />
            </div>
            AI Performance & Bias Engine
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Elite Psychological Diagnostic Coaching powered by <strong className="text-foreground font-semibold">Nirikshan</strong>
          </p>
        </div>
        {report && (
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all cursor-pointer text-white/95"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Copied to clipboard!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-[#FFD700]" /> Share Report
              </>
            )}
          </button>
        )}
      </div>

      {fetchingSaved && (
        <div className="bg-[#0F0F18] border border-[#1A1A2E] rounded-2xl p-16 text-center space-y-6">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-[#64748B] text-sm font-medium animate-pulse">Loading saved psychological diagnostics...</p>
        </div>
      )}

      {/* Generate button */}
      {!fetchingSaved && !report && !loading && (
        <div className="bg-[#0A0A10]/70 border border-white/5 rounded-2xl p-12 text-center space-y-6 backdrop-blur-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5 opacity-50 pointer-events-none" />
          <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(59,130,246,0.15)] relative">
            <IntelligenceOrb size={64} />
          </div>
          <div>
            <h2 className="text-2xl font-black">Ready to diagnose your trading behavior?</h2>
            <p className="text-[#64748B] mt-2 max-w-md mx-auto leading-relaxed text-sm">
              Unlock a deep behavioral diagnostic audit. Nirikshan compiles Loss Aversion holding times, Revenge lot sizing multipliers, and computes specific clinical cognitive exercises to break trading bias cycles.
            </p>
          </div>
          {error && (
            <div className="p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm max-w-md mx-auto">
              {error}
            </div>
          )}
          <button
            onClick={generate}
            className="px-8 py-3.5 border-2 border-blue-500 bg-transparent hover:bg-blue-500/10 text-blue-400 font-extrabold text-base rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:scale-[1.02] cursor-pointer"
          >
            Generate Behavior Diagnostic Report
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-[#0A0A10]/70 border border-white/5 rounded-2xl p-16 text-center space-y-6 backdrop-blur-md">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full bg-blue-500/5 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <IntelligenceOrb size={44} />
            </div>
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <p className="text-xl font-black text-blue-400 animate-pulse">{loadingMsg}</p>
            <p className="text-[#64748B] text-xs">Compiling telemetry vectors & structuring diagnostic matrices. Please wait...</p>
          </div>
        </div>
      )}

      {/* Loaded Behavior Diagnostic Dashboard */}
      {report && !loading && !fetchingSaved && (
        <motion.div 
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Grade + Scores Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ perspective: 1000 }}>
            {/* 3D Grade Card */}
            <motion.div 
              variants={flipCardVariants}
              className="bg-[#0A0A10]/80 border border-[#1A1A2E] rounded-2xl p-8 text-center space-y-4 shadow-2xl relative backdrop-blur-md overflow-hidden group hover:border-[#333] transition-all"
            >
              <div className="absolute -top-12 -left-12 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
              <p className="text-xs text-[#64748B] uppercase tracking-widest font-black">Performance Grade</p>
              
              <motion.div 
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.1, 1.0] }}
                transition={{ delay: 0.5, type: 'spring', damping: 12, stiffness: 200 }}
                className={cn('text-9xl font-black leading-none tracking-tighter select-none', gradeColor(report.grade), gradeGlow(report.grade))}
              >
                {report.grade}
              </motion.div>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-sm text-[#94A3B8] font-medium leading-snug"
              >
                {report.grade_reason}
              </motion.p>

              <div className="pt-2">
                <button 
                  onClick={generate} 
                  className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold border border-blue-500 bg-transparent hover:bg-blue-500/10 text-blue-400 flex items-center gap-1.5 mx-auto transition-all shadow-[0_0_10px_rgba(59,130,246,0.1)] hover:scale-[1.01] cursor-pointer"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Re-Analyze Account
                </button>
              </div>
            </motion.div>

            {/* Core Score Circular Meters */}
            <motion.div variants={staggerItemVariants} className="lg:col-span-2 bg-[#0A0A10]/80 border border-[#1A1A2E] rounded-2xl p-6 shadow-2xl backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm tracking-wide text-[#94A3B8] uppercase">Core Discipline Scores</h3>
                  <div className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> Rules Compliance: {report.rules_compliance_score}/10
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 py-2">
                  {[
                    { label: 'Risk Control', value: report.risk_score, color: '#3B82F6', glow: 'rgba(59,130,246,0.3)' },
                    { label: 'Consistency', value: report.consistency_score, color: '#10B981', glow: 'rgba(16,185,129,0.3)' },
                    { label: 'Psychology', value: report.discipline_score, color: '#F59E0B', glow: 'rgba(245,158,11,0.3)' },
                  ].map((s, idx) => (
                    <div key={s.label} className="text-center space-y-2 group">
                      <div className="relative w-20 h-20 mx-auto">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="2.5" />
                          <motion.circle
                            cx="18" cy="18" r="15.9" fill="none"
                            stroke={s.color} strokeWidth="3"
                            strokeLinecap="round"
                            style={{ filter: `drop-shadow(0 0 8px ${s.glow})` }}
                            initial={{ strokeDasharray: `0 100` }}
                            animate={{ strokeDasharray: `${(s.value / 10) * 100} 100` }}
                            transition={{ delay: 0.6 + (idx * 0.15), duration: 1.5, type: 'spring', bounce: 0.1 }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-black" style={{ color: s.color }}>{s.value}</span>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-[#64748B] group-hover:text-foreground transition-colors">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best/Worst Sessions */}
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                <div className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Best Session</p>
                    <p className="font-bold text-sm text-emerald-400">{report.best_session}</p>
                  </div>
                </div>
                <div className="bg-red-500/[0.02] border border-red-500/10 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                    <Activity className="w-4 h-4 text-red-400 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Worst Session</p>
                    <p className="font-bold text-sm text-red-400">{report.worst_session}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Nirikshan's Diagnostic Assessment Board */}
          <motion.div variants={staggerItemVariants} className="bg-[#0A0A10]/80 border border-[#1A1A2E] rounded-2xl p-6 border-l-4 border-l-primary shadow-2xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-4 right-4 w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center border border-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-black text-[#F59E0B] tracking-wide text-sm uppercase">Nirikshan's Psychoanalytic Coaching Notes</h3>
              <button 
                onClick={() => setSkipAnimation(!skipAnimation)}
                className="text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 px-2 py-0.5 rounded text-[#64748B] hover:text-foreground transition-all ml-auto"
              >
                {skipAnimation ? 'Animate Text' : 'Show Instant'}
              </button>
            </div>
            <p className="text-[#F1F5F9] leading-relaxed italic text-sm md:text-base font-medium">
              {skipAnimation ? (
                report.summary
              ) : (
                <TypewriterText text={report.summary} speed={20} />
              )}
            </p>
          </motion.div>

          {/* Interactive Cognitive Bias Scanner Cards */}
          <motion.div variants={staggerItemVariants} className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg tracking-tight">Active Bias Scanner Diagnostics</h3>
              <span className="text-xs px-2 py-0.5 rounded-md bg-[#EF4444]/15 border border-[#EF4444]/20 text-[#EF4444] font-bold animate-pulse">Threat Scanner Active</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeBiases.map((bias: any, idx: number) => {
                const isExpanded = expandedBias === bias.bias_name
                const styles = biasSeverityStyle(bias.severity)
                const isThreat = bias.severity.toLowerCase() !== 'healthy'

                return (
                  <motion.div
                    key={bias.bias_name}
                    layout="position"
                    onClick={() => setExpandedBias(isExpanded ? null : bias.bias_name)}
                    className={cn(
                      "bg-[#0A0A10]/80 border rounded-2xl p-5 shadow-xl transition-all duration-300 relative cursor-pointer select-none backdrop-blur-md overflow-hidden hover:scale-[1.01] hover:shadow-2xl",
                      styles.border,
                      isExpanded ? "md:col-span-2 border-primary/30 shadow-primary/5 ring-1 ring-primary/20" : ""
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                          {bias.bias_name.includes('Aversion') && <Scale className="w-5 h-5 text-primary" />}
                          {bias.bias_name.includes('Revenge') && <Zap className="w-5 h-5 text-red-400" />}
                          {bias.bias_name.includes('FOMO') && <Timer className="w-5 h-5 text-cyan-400" />}
                          {bias.bias_name.includes('Fatigue') && <Gauge className="w-5 h-5 text-purple-400" />}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-base tracking-tight">{bias.bias_name}</h4>
                          <p className="text-xs text-[#64748B] mt-0.5 max-w-[280px] md:max-w-xs truncate">{bias.description}</p>
                        </div>
                      </div>
                      <div className={cn("px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase flex items-center gap-1.5", styles.badge)}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", styles.dot)} />
                        {bias.severity}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-primary">
                      <span className="text-[#64748B] font-medium text-[11px]">Evidence snippet: <strong className="text-[#F1F5F9] font-semibold">{bias.evidence.slice(0, 50)}...</strong></span>
                      <span className="flex items-center gap-0.5 text-xs text-primary/80 group-hover:text-primary">
                        {isExpanded ? "Collapse Diagnostic" : "Analyze Diagnostic"}
                        {isExpanded ? <ChevronUp className="w-4 h-4 ml-0.5" /> : <ChevronDown className="w-4 h-4 ml-0.5" />}
                      </span>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-5 pt-5 border-t border-white/5 space-y-4"
                        >
                          <div>
                            <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block mb-1.5">Cognitive mechanism description</span>
                            <p className="text-sm text-[#94A3B8] leading-relaxed italic">{bias.description}</p>
                          </div>

                          <div>
                            <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block mb-1.5">Behavioral telemetry evidence</span>
                            <div className="bg-[#050508] border border-white/5 rounded-xl p-3 text-xs font-mono text-primary/95 shadow-inner">
                              {bias.evidence}
                            </div>
                          </div>

                          <div className="bg-primary/[0.02] border border-primary/20 rounded-xl p-4 relative overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.03)]">
                            <div className="absolute top-2.5 right-2.5 text-primary/10">
                              <Sparkles className="w-8 h-8" />
                            </div>
                            <span className="text-xs text-primary font-black uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                              <Brain className="w-4 h-4" /> Nirikshan's Prescribed Cognitive Therapy Exercise
                            </span>
                            <p className="text-sm text-[#F1F5F9] leading-relaxed font-medium">{bias.psychological_exercise}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* Emotion Correlation heat matrix */}
          {report.emotion_correlations && report.emotion_correlations.length > 0 && (
            <motion.div variants={staggerItemVariants} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg tracking-tight">Emotion-to-Performance Correlation Grid</h3>
                <span className="text-xs text-[#64748B] font-medium">Click on an emotion pill to view advanced telemetry metrics</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {report.emotion_correlations.map((c: any) => {
                  const colors = emotionColors(c.emotion)
                  const isSelected = selectedEmotion === c.emotion

                  return (
                    <motion.div
                      key={c.emotion}
                      onClick={() => setSelectedEmotion(isSelected ? null : c.emotion)}
                      className={cn(
                        "p-3 rounded-xl border text-center transition-all cursor-pointer relative select-none",
                        colors.bg,
                        colors.border,
                        colors.glow,
                        isSelected ? "ring-2 ring-foreground/20 border-foreground/30 scale-105" : "hover:scale-[1.02]"
                      )}
                    >
                      <p className="text-xs font-black uppercase tracking-wider text-center">{c.emotion}</p>
                      <p className="text-xl font-black mt-1.5 leading-none">{c.win_rate.toFixed(0)}% <span className="text-[10px] text-[#64748B] font-normal">WR</span></p>
                      <p className={cn("text-[10px] font-bold mt-1", c.avg_pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {c.avg_pnl >= 0 ? '+' : ''}${c.avg_pnl.toFixed(0)} avg
                      </p>
                    </motion.div>
                  )
                })}
              </div>

              {/* Advanced selected emotion telemetry details */}
              <AnimatePresence mode="wait">
                {selectedEmotion && (
                  (() => {
                    const corr = report.emotion_correlations.find((x: any) => x.emotion === selectedEmotion)
                    if (!corr) return null
                    const colors = emotionColors(selectedEmotion)

                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn("bg-[#0A0A10]/80 border rounded-2xl p-5 shadow-2xl backdrop-blur-md border-l-4", colors.border)}
                        style={{ borderLeftColor: colors.bar }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className={cn("px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider", colors.bg, colors.border)}>
                              {selectedEmotion}
                            </span>
                            <span className="text-sm font-extrabold text-[#F1F5F9]">Advanced Behavioral Telemetry Detail</span>
                          </div>
                          <button onClick={() => setSelectedEmotion(null)} className="text-xs text-[#64748B] hover:text-foreground font-semibold">
                            Close Telemetry
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 space-y-1">
                            <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Total Sample trades</span>
                            <p className="text-2xl font-black text-[#F1F5F9]">{corr.total_trades} trade(s)</p>
                          </div>
                          
                          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 space-y-1">
                            <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Average net trade p&l</span>
                            <p className={cn("text-2xl font-black", corr.avg_pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                              {corr.avg_pnl >= 0 ? '+' : ''}${corr.avg_pnl.toFixed(2)}
                            </p>
                          </div>

                          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 space-y-1">
                            <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Win Rate Correlation</span>
                            <div className="flex items-center gap-3">
                              <p className="text-2xl font-black text-[#F1F5F9]">{corr.win_rate.toFixed(1)}%</p>
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden shrink mt-1">
                                <motion.div 
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: colors.bar }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${corr.win_rate}%` }}
                                  transition={{ duration: 0.8 }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 space-y-1">
                            <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-black block">Checklist Compliance</span>
                            <div className="flex items-center gap-3">
                              <p className="text-2xl font-black text-[#F1F5F9]">{corr.checklist_compliance_rate.toFixed(1)}%</p>
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden shrink mt-1">
                                <motion.div 
                                  className="h-full rounded-full bg-primary"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${corr.checklist_compliance_rate}%` }}
                                  transition={{ duration: 0.8 }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                          <div className="flex items-center gap-3 text-sm font-medium text-[#94A3B8]">
                            <Timer className="w-5 h-5 text-[#64748B] shrink-0" />
                            <span>Average holding time in this emotional state: <strong className="text-[#F1F5F9] font-bold">{Math.round(corr.avg_hold_time_seconds)}s</strong></span>
                          </div>
                          <div className="flex items-center gap-3 text-sm font-medium text-[#94A3B8]">
                            <Gauge className="w-5 h-5 text-[#64748B] shrink-0" />
                            <span>Average leveraged lot sizing utilized: <strong className="text-[#F1F5F9] font-bold">{corr.avg_lot_size.toFixed(2)} lots</strong></span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })()
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Discipline breach rules compliance alert banner */}
          {report.discipline_breaches_correlation && (
            <motion.div 
              variants={staggerItemVariants}
              className="p-5 rounded-2xl bg-amber-500/[0.02] border border-amber-500/25 flex items-start gap-4 shadow-xl shadow-amber-500/[0.01] backdrop-blur-md"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-[#F1F5F9] uppercase tracking-wide">Discipline & Rule Breach Correlation Analysis</h4>
                <p className="text-sm text-[#94A3B8] leading-relaxed font-medium">{report.discipline_breaches_correlation}</p>
              </div>
            </motion.div>
          )}

          {/* Strengths & Weaknesses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div variants={staggerItemVariants} className="bg-[#0A0A10]/80 border border-[#1A1A2E] rounded-2xl p-5 shadow-2xl backdrop-blur-md">
              <h3 className="font-bold flex items-center gap-2 mb-4 text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Behavioral Strengths
              </h3>
              <div className="space-y-3">
                {report.strengths.map((s: string, i: number) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + (i * 0.1) }}
                    className="flex gap-3 p-3 bg-emerald-500/[0.01] border border-emerald-500/10 rounded-xl hover:border-emerald-500/20 hover:bg-emerald-500/[0.02] transition-all"
                  >
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-[#94A3B8] font-medium leading-snug">{s}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={staggerItemVariants} className="bg-[#0A0A10]/80 border border-[#1A1A2E] rounded-2xl p-5 shadow-2xl backdrop-blur-md">
              <h3 className="font-bold flex items-center gap-2 mb-4 text-base">
                <XCircle className="w-5 h-5 text-red-400" /> Cognitive Vulnerabilities
              </h3>
              <div className="space-y-3">
                {report.weaknesses.map((w: string, i: number) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + (i * 0.1) }}
                    className="flex gap-3 p-3 bg-red-500/[0.01] border border-red-500/10 rounded-xl hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all"
                  >
                    <XCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-[#94A3B8] font-medium leading-snug">{w}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Action Plan */}
          <motion.div variants={staggerItemVariants} className="bg-[#0A0A10]/80 border border-[#1A1A2E] rounded-2xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <h3 className="font-black mb-4 flex items-center gap-2 text-base">
              <span className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-extrabold shadow-[0_0_10px_rgba(245,158,11,0.1)]">5</span>
              Steenbarger prescribed Behavioral Actions for Next Week
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.action_plan.map((a: string, i: number) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + (i * 0.15) }}
                  className="flex gap-4 p-4 bg-white/[0.01] border border-white/5 rounded-xl hover:bg-white/[0.03] hover:border-white/10 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 text-primary font-extrabold text-sm flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.05)]">
                    {i + 1}
                  </div>
                  <p className="text-sm font-medium text-[#94A3B8] leading-relaxed pt-0.5">{a}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
