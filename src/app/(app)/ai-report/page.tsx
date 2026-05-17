'use client'

import { useState } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { Bot, Share2, RefreshCcw, CheckCircle2, XCircle, Eye, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { flipCardVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/animations'
import { TypewriterText } from '@/components/TypewriterText'
import confetti from 'canvas-confetti'

export default function AIReportPage() {
  const { activeAccount } = useAccounts()
  const { trades } = useTrades(activeAccount?.id)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [provider, setProvider] = useState<'gemini' | 'groq' | null>(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState<string | null>(null)

  const messages = [
    'Analyzing your trade patterns...',
    'Detecting emotional biases...',
    'Calculating consistency score...',
    'Identifying blind spots...',
    'Building your action plan...',
  ]

  const generate = async () => {
    setLoading(true)
    setError(null)
    setReport(null)

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
      setReport(data.report)
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            AI Performance Report
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Powered by Nirikshan
          </p>
        </div>
        {report && (
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg text-sm font-medium transition-colors">
            <Share2 className="w-4 h-4" /> Share
          </button>
        )}
      </div>

      {/* Generate button */}
      {!report && !loading && (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-12 text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto animate-pulse">
            <Bot className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Ready to analyze your performance?</h2>
            <p className="text-[#64748B] mt-2 max-w-md mx-auto">
              Our AI will analyze all your trades, detect patterns, identify blind spots, and give you a personalized coaching report.
            </p>
          </div>
          {error && (
            <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm">
              {error}
            </div>
          )}
          <button
            onClick={generate}
            className="px-8 py-3 bg-primary hover:bg-primary/90 rounded-xl font-semibold text-lg shadow-xl shadow-primary/20 transition-all hover:scale-105"
          >
            Generate My Report
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-[#12121a] border border-white/5 rounded-2xl p-16 text-center space-y-6 animate-in fade-in">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-xl font-bold text-[#F59E0B] animate-pulse">{loadingMsg}</p>
            <p className="text-[#64748B] text-sm mt-2">This takes about 10-15 seconds</p>
          </div>
        </div>
      )}

      {/* Report */}
      {report && !loading && (
        <motion.div 
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Grade + Scores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ perspective: 1000 }}>
            {/* 3D Flipping Grade Card */}
            <motion.div 
              variants={flipCardVariants}
              className="bg-[#0F0F18] border border-[#1A1A2E] rounded-2xl p-8 text-center space-y-4 shadow-2xl relative"
            >
              <p className="text-xs text-[#64748B] uppercase tracking-widest font-bold">Overall Grade</p>
              
              <motion.div 
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.1, 1.0] }}
                transition={{ delay: 0.5, type: 'spring', damping: 12, stiffness: 200 }}
                className={cn('text-9xl font-black leading-none', gradeColor(report.grade), gradeGlow(report.grade))}
              >
                {report.grade}
              </motion.div>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-sm text-[#94A3B8] italic"
              >
                {report.grade_reason}
              </motion.p>

              <button onClick={generate} className="text-xs text-[#64748B] hover:text-foreground flex items-center gap-1 mx-auto mt-4 transition-colors">
                <RefreshCcw className="w-3 h-3" /> Regenerate
              </button>
            </motion.div>

            {/* Core Scores */}
            <motion.div variants={staggerItemVariants} className="lg:col-span-2 bg-[#0F0F18] border border-[#1A1A2E] rounded-2xl p-6 shadow-xl">
              <h3 className="font-semibold mb-5">Core Scores</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Risk Mgmt', value: report.risk_score, color: '#3B82F6' },
                  { label: 'Consistency', value: report.consistency_score, color: '#22C55E' },
                  { label: 'Discipline', value: report.discipline_score, color: '#F59E0B' },
                ].map((s, idx) => (
                  <div key={s.label} className="text-center space-y-3">
                    <div className="relative w-20 h-20 mx-auto">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                        <motion.circle
                          cx="18" cy="18" r="15.9" fill="none"
                          stroke={s.color} strokeWidth="2.5"
                          strokeLinecap="round"
                          initial={{ strokeDasharray: `0 100` }}
                          animate={{ strokeDasharray: `${(s.value / 10) * 100} 100` }}
                          transition={{ delay: 0.8 + (idx * 0.15), duration: 1.5, type: 'spring', bounce: 0.1 }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-black" style={{ color: s.color }}>{s.value}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] text-center">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Best/Worst summary */}
              <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-white/5">
                <div className="bg-[#22C55E]/5 border border-[#22C55E]/10 rounded-lg p-3">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Best Session</p>
                  <p className="font-bold text-[#22C55E] mt-0.5">{report.best_session}</p>
                </div>
                <div className="bg-[#EF4444]/5 border border-[#EF4444]/10 rounded-lg p-3">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Worst Session</p>
                  <p className="font-bold text-[#EF4444] mt-0.5">{report.worst_session}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Summary (Typewriter) */}
          <motion.div variants={staggerItemVariants} className="bg-[#0F0F18] border border-[#1A1A2E] rounded-2xl p-6 border-l-4 border-l-[#F59E0B]">
            <p className="text-[#F1F5F9] leading-relaxed italic">
              <TypewriterText text={report.summary} speed={40} />
            </p>
          </motion.div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div variants={staggerItemVariants} className="bg-[#0F0F18] border border-[#1A1A2E] rounded-2xl p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E]" /> Strengths
              </h3>
              <div className="space-y-3">
                {report.strengths.map((s: string, i: number) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.5 + (i * 0.1) }}
                    className="flex gap-3 p-3 bg-[#22C55E]/5 border border-[#22C55E]/10 rounded-xl"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                    <span className="text-sm">{s}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            <motion.div variants={staggerItemVariants} className="bg-[#0F0F18] border border-[#1A1A2E] rounded-2xl p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-[#EF4444]" /> Weaknesses
              </h3>
              <div className="space-y-3">
                {report.weaknesses.map((w: string, i: number) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.5 + (i * 0.1) }}
                    className="flex gap-3 p-3 bg-[#EF4444]/5 border border-[#EF4444]/10 rounded-xl"
                  >
                    <XCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                    <span className="text-sm">{w}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Action Plan */}
          <motion.div variants={staggerItemVariants} className="bg-[#0F0F18] border border-[#1A1A2E] rounded-2xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center text-xs font-bold">5</span>
              Your Action Plan for Next Week
            </h3>
            <div className="space-y-3 overflow-hidden">
              {report.action_plan.map((a: string, i: number) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2 + (i * 0.3), duration: 0.5, type: 'spring', bounce: 0.2 }}
                  className="flex gap-4 p-4 bg-white/2 border border-white/5 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 2.2 + (i * 0.3), type: 'spring' }}
                    className="w-7 h-7 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] font-bold text-sm flex items-center justify-center shrink-0"
                  >
                    {i + 1}
                  </motion.div>
                  <p className="text-sm pt-0.5">{a}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
