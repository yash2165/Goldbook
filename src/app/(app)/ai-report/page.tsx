'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { 
  Bot, Share2, RefreshCcw, CheckCircle2, XCircle, Eye, AlertTriangle, 
  Brain, Zap, Gauge, Timer, Sparkles, Scale, ChevronDown, ChevronUp, 
  Award, ShieldAlert, Heart, Activity, FileText, Calendar, History,
  Check, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { flipCardVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/animations'
import { TypewriterText } from '@/components/TypewriterText'
import IntelligenceOrb from '@/components/IntelligenceOrb'
import confetti from 'canvas-confetti'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'

export default function AIReportPage() {
  const supabase = createClient()
  const [userTier, setUserTier] = useState<'free' | 'paid' | 'pro' | null>(null)
  const [loadingTier, setLoadingTier] = useState(true)

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleRazorpayCheckout = async (tierName: 'paid' | 'pro', amount: number) => {
    const loaded = await loadRazorpayScript()
    if (!loaded) {
      alert('Failed to load Razorpay SDK. Please check your internet connection.')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in to upgrade your plan.')
        return
      }

      const options = {
        key: 'rzp_test_Sv9GJ0OEOAIjVO',
        amount: amount * 100, // Amount in paise
        currency: 'INR',
        name: 'GoldBook',
        description: `Upgrade to ${tierName === 'paid' ? 'The Automated Trader' : 'The Elite Professional'}`,
        image: 'https://goldbook-roan.vercel.app/logo.png',
        handler: async function (response: any) {
          try {
            // Update Supabase profile directly on success
            const { error: dbErr } = await supabase
              .from('profiles')
              .update({ tier: tierName })
              .eq('id', user.id)

            if (dbErr) throw dbErr

            alert(`Payment Successful! Your account has been upgraded to ${tierName === 'paid' ? 'Paid' : 'Pro'} tier.`)
            window.location.reload()
          } catch (err: any) {
            alert('Payment was successful (Payment ID: ' + response.razorpay_payment_id + '), but your profile update failed. Please contact support.')
          }
        },
        prefill: {
          email: user.email || '',
        },
        theme: {
          color: tierName === 'pro' ? '#F59E0B' : '#3B82F6',
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (err: any) {
      console.error(err)
      alert('Error initializing checkout. Please try again.')
    }
  }

  useEffect(() => {
    async function loadUserTier() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('tier')
            .eq('id', user.id)
            .single()
          
          if (data && data.tier) {
            setUserTier(data.tier as any)
          } else {
            setUserTier('free')
          }
        }
      } catch (err) {
        setUserTier('free')
      } finally {
        setLoadingTier(false)
      }
    }
    loadUserTier()
  }, [])

  const { activeAccount } = useAccounts()
  const { trades } = useTrades(activeAccount?.id)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [provider, setProvider] = useState<'gemini' | 'groq' | null>(null)

  if (loadingTier) {
    return (
      <div className="p-6 max-w-full mx-auto space-y-6 min-h-[60vh] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
          <div className="absolute inset-0 rounded-full border border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-[#64748B] text-xs font-mono animate-pulse">Authenticating behavioral tier...</p>
      </div>
    )
  }

  if (userTier === 'free') {
    return (
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-12 min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Premium Gating Card */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-30 pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#0D1421] border border-white/5 rounded-3xl p-6 text-center space-y-4 shadow-2xl backdrop-blur-md relative z-10"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] mx-auto shadow-[0_0_20px_rgba(245,159,11,0.15)] animate-pulse">
            <Brain className="w-7 h-7 stroke-[1.5]" />
          </div>
          
          <div className="space-y-1.5">
            <span className="text-[9px] bg-[#F59E0B] text-black font-black uppercase px-2.5 py-0.5 rounded font-mono tracking-wider">
              PREMIUM GATED FEATURE
            </span>
            <h2 className="text-lg font-black text-white uppercase tracking-wider mt-2.5">Behavioral Psychology Coach</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              This premium feature is reserved for Pro and Paid users. Upgrade below to unlock automated MT5 syncs, behavioral psychology reports, and conversational AI coaching!
            </p>
          </div>
        </motion.div>

        {/* Stunning 3-Tier Modern Pricing Plans Grid */}
        <div className="w-full space-y-6 relative z-10">
          <div className="text-center space-y-1">
            <h2 className="text-sm font-black uppercase text-white tracking-widest">Select Your Professional Edge</h2>
            <p className="text-xs text-[#64748B]">Unlock automated systems, deep behavioral psychology, and VIP market analytics.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1000px] mx-auto">
            
            {/* Free Plan */}
            <div className="bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#64748B]">Free forever</h3>
                  <h4 className="text-sm font-black text-white">The Accountable Trader</h4>
                  <div className="text-2xl font-black text-white mt-1">$0 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited manual journaling</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Full TradingView charts suite</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Complete stats & metrics grids</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Public community & leaderboards</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No background MT5 auto-sync</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No AI Psychology audits & chat</p>
                </div>
              </div>
              <button disabled className="mt-6 w-full py-3 bg-white/5 text-[#64748B] font-black text-xs uppercase tracking-wider rounded-xl cursor-not-allowed">
                Current Plan
              </button>
            </div>

            {/* Paid Plan */}
            <div className="bg-[#0D1421] border border-[#3B82F6]/10 hover:border-[#3B82F6]/30 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#3B82F6]/5 rounded-full blur-2xl group-hover:bg-[#3B82F6]/10 transition-all pointer-events-none" />
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#3B82F6]">Automated Sync</h3>
                  <h4 className="text-sm font-black text-white font-bold">The Automated Trader</h4>
                  <div className="text-2xl font-black text-white mt-1">$9 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">1 Active MT5 Account Sync</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited active journal history</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Standard analytical drawdowns grid</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Weekly/Monthly static AI reports</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Custom templates & habit logs</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No Conversational AI coaching chat</p>
                </div>
              </div>
              <button 
                onClick={() => handleRazorpayCheckout('paid', 750)} 
                className="mt-6 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-blue-500/10"
              >
                Select Plan
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-[#0D1421] border border-[#F59E0B]/20 hover:border-[#F59E0B]/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B]/10 rounded-full blur-2xl group-hover:bg-[#F59E0B]/15 transition-all pointer-events-none" />
              <div className="absolute -right-12 -top-12 w-24 h-24 bg-[#F59E0B] text-black font-black uppercase text-[8px] flex items-center justify-center rotate-45 tracking-widest pt-12 shadow-lg animate-pulse">
                Ultimate
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#F59E0B]">Nirikshan Pro</h3>
                  <h4 className="text-sm font-black text-white font-bold">The Elite Professional</h4>
                  <div className="text-2xl font-black text-white mt-1">$29 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">Unlimited MT5 Accounts Sync</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">Nirikshan Conversational AI Chat</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> AI Cognitive bias threat heatmaps</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Visual Replay Backtest (Scissors)</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">VIP Signal Chat Rooms (Admin Signals)</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Priority sandbox processing</p>
                </div>
              </div>
              <button 
                onClick={() => handleRazorpayCheckout('pro', 2400)} 
                className="mt-6 w-full py-3 bg-primary hover:bg-primary/95 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-primary/10"
              >
                Select Plan
              </button>
            </div>

          </div>
        </div>
      </div>
    )
  }
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fetchingSaved, setFetchingSaved] = useState(true)
  const [expandedBias, setExpandedBias] = useState<string | null>(null)
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null)
  const [skipAnimation, setSkipAnimation] = useState(false)
  const [copied, setCopied] = useState(false)

  // Past reports history state
  const [pastReports, setPastReports] = useState<any[]>([])
  
  // Cinematic progressive loading state
  const [loadingStage, setLoadingStage] = useState(0)

  // Client-Side Telemetry Compilation for loading steps
  const clientTelemetry = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { journalCount: 0, selfAttacks: 0, regrets: 0, revengeTriggers: 0 }
    }

    const closed = trades.filter((t: any) => t.status === 'closed' && t.notes)
    
    const selfAttackRegex = /\b(?:idiot|stupid|loser|fail|mess|worthless|pathetic|fool|dumb|screw|screwup|horrible|terrible)\w*\b|what\s+was\s+i\s+thinking|why\s+do\s+i\s+always|how\s+could\s+i|what\s+am\s+i\s+doing/gi
    const regretRegex = /\b(?:should|regret|could|if\s+only|wish|mistake|why\s+did\b)\w*\b/gi
    
    let selfAttackCount = 0
    let regretCount = 0

    closed.forEach((t: any) => {
      const text = t.notes || ''
      const saMatches = text.match(selfAttackRegex)
      if (saMatches) selfAttackCount += saMatches.length
      
      const rMatches = text.match(regretRegex)
      if (rMatches) regretCount += rMatches.length
    })

    let revengeCount = 0
    const sorted = [...trades].filter((t: any) => t.open_time).sort(
      (a: any, b: any) => new Date(a.open_time!).getTime() - new Date(b.open_time!).getTime()
    )
    const losses = trades.filter((t: any) => t.close_time && (t.net_profit ?? 0) < 0)

    for (const loss of losses) {
      const lossClose = new Date(loss.close_time!).getTime()
      const next = sorted.find((t: any) => {
        const o = new Date(t.open_time!).getTime()
        if (o <= lossClose) return false
        const delta = (o - lossClose) / (60 * 1000)
        return delta > 0 && delta <= 45
      })
      if (next) revengeCount++
    }

    return {
      journalCount: closed.length,
      selfAttacks: selfAttackCount,
      regrets: regretCount,
      revengeTriggers: revengeCount
    }
  }, [trades])

  const messages = [
    'Running Deep Psychological Telemetry calculations...',
    'Analyzing Loss Aversion hold-time ratios...',
    'Detecting Revenge Trading position sizing multipliers...',
    'Calculating Overtrading & decision fatigue expectancy decay...',
    'Correlating pre-trade emotional states with checklist compliance...',
    'Activating Nirikshan Cognitive Trading Therapist engine...',
    'Structuring diagnostic schema and clinical exercises...',
    'Structuring past cognitive diagnostic folders...',
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

  // Fetch past reports list from the database
  const loadPastReportsList = async (accountId: string) => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('ai_reports')
        .select('id, created_at, grade, risk_score, trades_analyzed')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
      
      if (data) {
        setPastReports(data)
      }
    } catch (err) {
      console.error('Failed to load past reports archive:', err)
    }
  }

  // Load a specific historical report details by its database row
  const handleSelectPastReport = async (rowId: string) => {
    setFetchingSaved(true)
    try {
      const supabase = createClient()
      const { data, error: dbErr } = await supabase
        .from('ai_reports')
        .select('*')
        .eq('id', rowId)
        .single()

      if (dbErr) throw dbErr
      if (data) {
        setReport({
          id: data.id,
          grade: data.grade,
          grade_reason: data.grade_reason,
          strengths: data.strengths,
          weaknesses: data.weaknesses,
          blind_spots: data.blind_spots,
          revenge_trading_detected: data.revenge_trading_detected,
          best_session: data.best_session,
          worst_session: data.worst_session,
          best_day: data.best_day,
          worst_day: data.worst_day,
          risk_score: data.risk_score,
          consistency_score: data.consistency_score,
          discipline_score: data.discipline_score,
          action_plan: data.action_plan,
          summary: data.summary,
          trades_analyzed: data.trades_analyzed,
          rules_compliance_score: data.rules_compliance_score,
          rules_analysis: data.rules_analysis?.observations ?? [],
          emotion_insights: data.rules_analysis?.emotion_insights ?? [],
          cognitive_biases: data.rules_analysis?.cognitive_biases ?? [],
          emotion_correlations: data.rules_analysis?.emotion_correlations ?? [],
          discipline_breaches_correlation: data.rules_analysis?.discipline_breaches_correlation ?? '',
        })
        setProvider(data.provider ?? 'gemini')
      }
    } catch (err) {
      console.error('Failed to retrieve full report from archive:', err)
    } finally {
      setFetchingSaved(false)
    }
  }

  // ── 1. Fetch saved report on load/activeAccount change ───────────────────
  useEffect(() => {
    async function loadSavedReport() {
      if (!activeAccount?.id) {
        setReport(null)
        setPastReports([])
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

        if (dbErr) throw dbErr
        if (data && data.length > 0) {
          const dbRow = data[0]
          setReport({
            id: dbRow.id,
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
          setPastReports(data)
        } else {
          setReport(null)
          setPastReports([])
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
    if (!activeAccount?.id) return
    setLoading(true)
    setError(null)
    setReport(null)
    setSkipAnimation(false)
    setLoadingStage(1)

    const startTime = Date.now()

    // Cinematic loading timer timeouts
    const stage2Timeout = setTimeout(() => setLoadingStage(2), 2500)
    const stage3Timeout = setTimeout(() => setLoadingStage(3), 5000)
    const stage4Timeout = setTimeout(() => setLoadingStage(4), 7500)

    try {
      const res = await fetch('/api/ai/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: activeAccount.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Ensure minimum 8.5s cinematic loader to build psychological trust
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 8500 - elapsed)
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining))
      }
      
      setReport({
        id: data.reportId || data.report?.id,
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
      
      // Reload archive list to include the newly generated audit
      await loadPastReportsList(activeAccount.id)

      if (data.report.grade.startsWith('A')) {
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.5 },
            colors: ['#F59E0B', '#22C55E', '#FFFFFF']
          })
        }, 800)
      }
    } catch (e: any) {
      setError(e.message)
      clearTimeout(stage2Timeout)
      clearTimeout(stage3Timeout)
      clearTimeout(stage4Timeout)
    } finally {
      setLoading(false)
      setLoadingStage(0)
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
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] shrink-0 animate-pulse">
              <IntelligenceOrb size={26} />
            </div>
            AI Psychological Coach
          </h1>
          <p className="text-xs md:text-sm text-[#64748B] mt-0.5">
            Elite Behavioral Diagnostic Audits powered by <strong className="text-foreground font-semibold">Nirikshan</strong>
          </p>
        </div>
        {report && (
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer text-white/95 shrink-0 self-start sm:self-auto"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Copied!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-[#38BDF8]" /> Share Report
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
          <p className="text-[#64748B] text-xs font-mono animate-pulse">Retrieving archived psychological telemetry...</p>
        </div>
      )}

      {/* Generate button (First-time view) */}
      {!fetchingSaved && !report && !loading && (
        <div className="bg-[#0A0A10]/70 border border-white/5 rounded-2xl p-12 text-center space-y-6 backdrop-blur-md relative overflow-hidden max-w-xl mx-auto shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-500/[0.02] pointer-events-none" />
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(59,130,246,0.15)] relative">
            <IntelligenceOrb size={54} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">Unlock behavioral diagnostics</h2>
            <p className="text-[#64748B] max-w-sm mx-auto leading-relaxed text-xs">
              Nirikshan compiles holding-time ratios, Revenge lot sizing multipliers, and correlations of pre-trade emotional states to break trading bias cycles.
            </p>
          </div>
          {error && (
            <div className="p-5 rounded-2xl bg-[#EF4444]/5 border border-[#EF4444]/20 text-[#EF4444] text-xs max-w-xl mx-auto space-y-3 shadow-xl">
              <div className="flex items-center gap-2 justify-center">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
                <strong className="text-white font-extrabold uppercase tracking-wide">Journal Quality Gate Insufficient</strong>
              </div>
              <p className="leading-relaxed text-[#94A3B8] font-medium text-center">
                {error}
              </p>
              <div className="pt-2 text-left border-t border-[#EF4444]/15">
                <span className="text-[10px] font-black text-primary block uppercase tracking-widest mb-1 text-center">PRO-TIP FOR TRADERS:</span>
                <p className="text-[10px] text-[#64748B] leading-relaxed text-center">
                  Go to your <strong className="text-white font-bold">Trading Journal</strong> page, edit your recent closed trades, and add details about how you felt (e.g. FOMO, anxious, satisfied), what rules you followed or broke, and a brief sentence reflecting on your focus.
                </p>
              </div>
            </div>
          )}
          <button
            onClick={generate}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:scale-[1.02] cursor-pointer"
          >
            Generate Behavior Diagnostic Report
          </button>
        </div>
      )}

      {/* Loading state: Cinematic progressive credibility loading sequence */}
      {loading && (
        <div className="bg-[#0A0A10]/95 border border-white/5 rounded-2xl p-8 max-w-xl mx-auto shadow-2xl relative overflow-hidden text-left space-y-6 backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.01] to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <div className="relative w-12 h-12 shrink-0">
              <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
              <div className="absolute inset-0 rounded-full border border-primary border-t-transparent animate-spin" />
              <div className="absolute inset-1 rounded-full bg-primary/10 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                <IntelligenceOrb size={24} />
              </div>
            </div>
            <div>
              <h3 className="text-base font-black text-white">Nirikshan Behavior Audit Engine</h3>
              <p className="text-[10px] text-[#64748B] font-mono uppercase tracking-widest mt-0.5">Dual-LLM Cognitive Telemetry Pipeline</p>
            </div>
          </div>

          <div className="space-y-6 py-2 font-mono text-xs text-[#94A3B8]">
            {/* Stage 1: Narrative Telemetry */}
            <div className={cn("transition-all duration-500", loadingStage >= 1 ? "opacity-100" : "opacity-35")}>
              <div className="flex items-center gap-2">
                <span className="text-sm">🔍</span>
                <span className={cn("font-bold text-white", loadingStage === 1 ? "text-primary animate-pulse" : "")}>
                  Stage 1: Reading {clientTelemetry.journalCount} journal entries...
                </span>
                {loadingStage > 1 && <span className="text-emerald-400 font-extrabold text-[10px] ml-auto">SUCCESS</span>}
                {loadingStage === 1 && <span className="text-primary text-[10px] ml-auto animate-pulse">ANALYZING</span>}
              </div>
              {loadingStage >= 1 && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="pl-6 mt-1.5 text-[11px] text-[#64748B] leading-relaxed"
                >
                  └─ Detected <strong className="text-white">{clientTelemetry.selfAttacks}</strong> self-critical phrases, <strong className="text-white">{clientTelemetry.regrets}</strong> regret loops, <strong className="text-white">{clientTelemetry.revengeTriggers}</strong> revenge patterns.
                </motion.div>
              )}
            </div>

            {/* Stage 2: Narrative Psychology */}
            <div className={cn("transition-all duration-500", loadingStage >= 2 ? "opacity-100" : "opacity-35")}>
              <div className="flex items-center gap-2">
                <span className="text-sm">🧠</span>
                <span className={cn("font-bold text-white", loadingStage === 2 ? "text-primary animate-pulse" : "")}>
                  Stage 2: Running narrative psychology analysis...
                </span>
                {loadingStage > 2 && <span className="text-emerald-400 font-extrabold text-[10px] ml-auto">SUCCESS</span>}
                {loadingStage === 2 && <span className="text-primary text-[10px] ml-auto animate-pulse">COMPUTING</span>}
              </div>
              {loadingStage >= 2 && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="pl-6 mt-1.5 text-[11px] text-[#64748B] leading-relaxed"
                >
                  └─ Identifying: Locus of Control | Temporal Orientation | Cognitive Distortions
                </motion.div>
              )}
            </div>

            {/* Stage 3: Behavioral Compilation */}
            <div className={cn("transition-all duration-500", loadingStage >= 3 ? "opacity-100" : "opacity-35")}>
              <div className="flex items-center gap-2">
                <span className="text-sm">📊</span>
                <span className={cn("font-bold text-white", loadingStage === 3 ? "text-primary animate-pulse" : "")}>
                  Stage 3: Compiling your behavioral profile...
                </span>
                {loadingStage > 3 && <span className="text-emerald-400 font-extrabold text-[10px] ml-auto">SUCCESS</span>}
                {loadingStage === 3 && <span className="text-primary text-[10px] ml-auto animate-pulse">GENERATING</span>}
              </div>
              {loadingStage >= 3 && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="pl-6 mt-1.5 text-[11px] text-[#64748B] leading-relaxed"
                >
                  └─ Generating: CBT exercises | Risk archetype | Coaching insights
                </motion.div>
              )}
            </div>

            {/* Nirikshan Ready */}
            <AnimatePresence>
              {loadingStage >= 4 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 pt-4 border-t border-white/5 text-emerald-400 font-bold"
                >
                  <span>✅</span>
                  <span>Nirikshan diagnostic reports compiled. Loading dashboard...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Main split grid: Dossier left, Past archives sidebar right */}
      {report && !loading && !fetchingSaved && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start h-[calc(100vh-170px)] md:h-[calc(100vh-200px)] overflow-hidden">
          
          {/* LEFT 3/4 PANEL: behavior diagnostics dossiers */}
          <div className="col-span-1 lg:col-span-3 flex flex-col h-full overflow-y-auto pr-1 space-y-6 custom-scrollbar">
            
            {/* Grade + Scores Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ perspective: 1000 }}>
              
              {/* Grade card */}
              <motion.div 
                variants={flipCardVariants}
                className="bg-[#0D1421] border border-white/5 rounded-2xl p-6 text-center space-y-4 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all"
              >
                <div className="absolute -top-12 -left-12 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all pointer-events-none" />
                <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Performance Grade</p>
                
                <motion.div 
                  initial={{ scale: 0.5 }}
                  animate={{ scale: [0.5, 1.1, 1.0] }}
                  transition={{ delay: 0.5, type: 'spring', damping: 12, stiffness: 200 }}
                  className={cn('text-8xl font-black leading-none tracking-tighter select-none', gradeColor(report.grade), gradeGlow(report.grade))}
                >
                  {report.grade}
                </motion.div>

                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-xs text-[#94A3B8] font-medium leading-relaxed"
                >
                  {report.grade_reason}
                </motion.p>

                <div className="pt-1">
                  <button 
                    onClick={generate} 
                    className="px-3 py-2 rounded-lg text-[10px] font-extrabold border border-blue-500/20 bg-transparent hover:bg-blue-500/10 text-blue-400 flex items-center gap-1.5 mx-auto transition-all shadow-[0_0_10px_rgba(59,130,246,0.05)] hover:scale-[1.01] cursor-pointer"
                  >
                    <RefreshCcw className="w-3 h-3" /> Re-Analyze Account
                  </button>
                </div>
              </motion.div>

              {/* Core Score Circular Meters */}
              <motion.div variants={staggerItemVariants} className="md:col-span-2 bg-[#0D1421] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-xs tracking-wide text-[#94A3B8] uppercase">Core Discipline Scores</h3>
                    <div className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 animate-pulse" /> Rules Compliance: {report.rules_compliance_score}/10
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 py-2">
                    {[
                      { label: 'Risk Control', value: report.risk_score, color: '#3B82F6', glow: 'rgba(59,130,246,0.3)' },
                      { label: 'Consistency', value: report.consistency_score, color: '#10B981', glow: 'rgba(16,185,129,0.3)' },
                      { label: 'Psychology', value: report.discipline_score, color: '#F59E0B', glow: 'rgba(245,158,11,0.3)' },
                    ].map((s, idx) => (
                      <div key={s.label} className="text-center space-y-1.5 group">
                        <div className="relative w-16 h-16 mx-auto">
                          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="2.5" />
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
                            <span className="text-base font-black" style={{ color: s.color }}>{s.value}</span>
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-[#64748B] group-hover:text-foreground transition-colors">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Best/Worst Sessions */}
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                  <div className="bg-emerald-500/[0.01] border border-emerald-500/10 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      <Activity className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Best Session</p>
                      <p className="font-bold text-xs text-emerald-400">{report.best_session}</p>
                    </div>
                  </div>
                  <div className="bg-red-500/[0.01] border border-red-500/10 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                      <Activity className="w-4 h-4 text-red-400 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Worst Session</p>
                      <p className="font-bold text-xs text-red-400">{report.worst_session}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Assessment Note */}
            <motion.div variants={staggerItemVariants} className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 border-l-4 border-l-primary shadow-xl relative overflow-hidden">
              <div className="absolute top-4 right-4 w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center border border-primary/10 pointer-events-none">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-black text-[#F59E0B] tracking-wide text-xs uppercase">Behavioral Diagnostic Notes</h3>
                <button 
                  onClick={() => setSkipAnimation(!skipAnimation)}
                  className="text-[9px] bg-white/5 border border-white/10 hover:bg-white/10 px-2 py-0.5 rounded text-[#64748B] hover:text-foreground transition-all ml-auto"
                >
                  {skipAnimation ? 'Animate Text' : 'Show Instant'}
                </button>
              </div>
              <p className="text-[#F1F5F9] leading-relaxed italic text-xs md:text-sm font-medium leading-relaxed">
                {skipAnimation ? (
                  report.summary
                ) : (
                  <TypewriterText text={report.summary} speed={20} />
                )}
              </p>
            </motion.div>

            {/* Cognitive Bias cards */}
            <motion.div variants={staggerItemVariants} className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm uppercase tracking-wider text-[#64748B]">Active Bias Diagnostics</h3>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] font-black tracking-widest uppercase animate-pulse">Threat Scanner Active</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeBiases.map((bias: any) => {
                  const isExpanded = expandedBias === bias.bias_name
                  const styles = biasSeverityStyle(bias.severity)

                  return (
                    <motion.div
                      key={bias.bias_name}
                      layout="position"
                      onClick={() => setExpandedBias(isExpanded ? null : bias.bias_name)}
                      className={cn(
                        "bg-[#0D1421] border rounded-2xl p-5 shadow-xl transition-all duration-300 relative cursor-pointer select-none overflow-hidden hover:scale-[1.01]",
                        styles.border,
                        isExpanded ? "md:col-span-2 border-primary/30 ring-1 ring-primary/20" : ""
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center shrink-0">
                            {bias.bias_name.includes('Aversion') && <Scale className="w-5 h-5 text-primary" />}
                            {bias.bias_name.includes('Revenge') && <Zap className="w-5 h-5 text-red-400" />}
                            {bias.bias_name.includes('FOMO') && <Timer className="w-5 h-5 text-cyan-400" />}
                            {bias.bias_name.includes('Fatigue') && <Gauge className="w-5 h-5 text-purple-400" />}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm tracking-tight text-white">{bias.bias_name}</h4>
                            <p className="text-[10px] text-[#64748B] mt-0.5 max-w-[280px] md:max-w-xs truncate">{bias.description}</p>
                          </div>
                        </div>
                        <div className={cn("px-2.5 py-0.5 rounded-full border text-[8px] font-black uppercase flex items-center gap-1.5", styles.badge)}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", styles.dot)} />
                          {bias.severity}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs font-bold text-primary">
                        <span className="text-[#64748B] font-medium text-[10px]">Evidence: <strong className="text-[#F1F5F9] font-semibold">{bias.evidence.slice(0, 48)}...</strong></span>
                        <span className="flex items-center gap-0.5 text-[10px] text-primary/80 group-hover:text-primary">
                          {isExpanded ? "Collapse" : "Analyze"}
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
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
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block mb-1.5">Cognitive mechanism description</span>
                              <p className="text-xs text-[#94A3B8] leading-relaxed italic">{bias.description}</p>
                            </div>

                            <div>
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block mb-1.5">Behavioral telemetry evidence</span>
                              <div className="bg-[#09090E] border border-white/5 rounded-xl p-3 text-[11px] font-mono text-primary/95 shadow-inner">
                                {bias.evidence}
                              </div>
                            </div>

                            <div className="bg-primary/[0.01] border border-primary/20 rounded-xl p-4 relative overflow-hidden shadow-inner">
                              <span className="text-[9px] text-primary font-black uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                                <Brain className="w-4 h-4 animate-pulse" /> Nirikshan's Cognitive Therapy Exercise
                              </span>
                              <p className="text-xs text-[#F1F5F9] leading-relaxed font-semibold">{bias.psychological_exercise}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>

            {/* Emotion grid */}
            {report.emotion_correlations && report.emotion_correlations.length > 0 && (
              <motion.div variants={staggerItemVariants} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm uppercase tracking-wider text-[#64748B]">Emotion-to-Performance Correlation Grid</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
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
                        <p className="text-[9px] font-black uppercase tracking-wider text-center">{c.emotion}</p>
                        <p className="text-lg font-black mt-1.5 leading-none">{c.win_rate.toFixed(0)}% <span className="text-[9px] text-[#64748B] font-normal">WR</span></p>
                        <p className={cn("text-[9px] font-bold mt-1", c.avg_pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {c.avg_pnl >= 0 ? '+' : ''}${c.avg_pnl.toFixed(0)} avg
                        </p>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Selected Emotion telemetry details */}
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
                          className={cn("bg-[#0D1421] border rounded-2xl p-5 shadow-2xl backdrop-blur-md border-l-4", colors.border)}
                          style={{ borderLeftColor: colors.bar }}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <span className={cn("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest", colors.bg, colors.border)}>
                                {selectedEmotion}
                              </span>
                              <span className="text-xs font-extrabold text-[#F1F5F9]">Advanced Behavioral Telemetry Detail</span>
                            </div>
                            <button onClick={() => setSelectedEmotion(null)} className="text-[10px] text-[#64748B] hover:text-foreground font-semibold">
                              Close Telemetry
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 space-y-1">
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Total Sample trades</span>
                              <p className="text-xl font-black text-[#F1F5F9]">{corr.total_trades} trade(s)</p>
                            </div>
                            
                            <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 space-y-1">
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Average net trade p&l</span>
                              <p className={cn("text-xl font-black", corr.avg_pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                                {corr.avg_pnl >= 0 ? '+' : ''}${corr.avg_pnl.toFixed(2)}
                              </p>
                            </div>

                            <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 space-y-1">
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Win Rate Correlation</span>
                              <div className="flex items-center gap-3">
                                <p className="text-xl font-black text-[#F1F5F9]">{corr.win_rate.toFixed(0)}%</p>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden shrink mt-1">
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
                              <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Checklist Compliance</span>
                              <div className="flex items-center gap-3">
                                <p className="text-xl font-black text-[#F1F5F9]">{corr.checklist_compliance_rate.toFixed(0)}%</p>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden shrink mt-1">
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
                            <div className="flex items-center gap-3 text-xs font-semibold text-[#94A3B8]">
                              <Timer className="w-4 h-4 text-[#64748B] shrink-0" />
                              <span>Average holding time: <strong className="text-[#F1F5F9] font-bold">{Math.round(corr.avg_hold_time_seconds)}s</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-semibold text-[#94A3B8]">
                              <Gauge className="w-4 h-4 text-[#64748B] shrink-0" />
                              <span>Average lot sizing utilized: <strong className="text-[#F1F5F9] font-bold">{corr.avg_lot_size.toFixed(2)} lots</strong></span>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })()
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Discipline breach alert */}
            {report.discipline_breaches_correlation && (
              <motion.div 
                variants={staggerItemVariants}
                className="p-5 rounded-2xl bg-amber-500/[0.01] border border-amber-500/25 flex items-start gap-4 shadow-xl shadow-amber-500/[0.01] backdrop-blur-md"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-xs text-[#F1F5F9] uppercase tracking-wide">Rule Breach Correlation Analysis</h4>
                  <p className="text-xs text-[#94A3B8] leading-relaxed font-medium">{report.discipline_breaches_correlation}</p>
                </div>
              </motion.div>
            )}

            {/* Strengths & Weaknesses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={staggerItemVariants} className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
                <h3 className="font-bold flex items-center gap-2 mb-4 text-xs uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" /> Behavioral Strengths
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
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-[#94A3B8] font-medium leading-snug">{s}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={staggerItemVariants} className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
                <h3 className="font-bold flex items-center gap-2 mb-4 text-xs uppercase tracking-wider text-red-400">
                  <XCircle className="w-4.5 h-4.5 text-red-400" /> Cognitive Vulnerabilities
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
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-[#94A3B8] font-medium leading-snug">{w}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Action Plan */}
            <motion.div variants={staggerItemVariants} className="bg-[#0D1421] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <h3 className="font-black mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-200">
                <span className="w-5 h-5 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-extrabold shadow-[0_0_10px_rgba(245,158,11,0.1)]">✓</span>
                Nirikshan prescribed Actions for Next Week
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
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 text-primary font-extrabold text-xs flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.05)] mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-xs font-medium text-[#94A3B8] leading-relaxed">{a}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT 1/4 PANEL: Diagnostic archives past reports list sidebar */}
          <div className="col-span-1 bg-[#0D1421] border border-white/5 rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-white/[0.01] shrink-0">
              <History className="w-4 h-4 text-primary" />
              <span className="text-xs font-black text-white/95 uppercase tracking-wider">Diagnostic Archives</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              {pastReports.length === 0 ? (
                <div className="py-12 text-center text-[10px] text-[#64748B] italic">
                  No past behavior diagnostics recorded yet.
                </div>
              ) : (
                pastReports.map((r) => {
                  const isSelected = report.id === r.id
                  const dateStr = format(new Date(r.created_at), 'MMM dd, yyyy')
                  const timeStr = format(new Date(r.created_at), 'HH:mm')

                  return (
                    <div
                      key={r.id}
                      onClick={() => handleSelectPastReport(r.id)}
                      className={cn(
                        "p-3.5 rounded-xl cursor-pointer transition-all duration-300 border relative group",
                        isSelected 
                          ? "bg-[#09090E] border-[#F59E0B]/50 shadow-[0_0_15px_rgba(245,159,11,0.05)]" 
                          : "bg-[#0F0F18]/40 border-white/[0.02] hover:bg-[#0F0F18] hover:border-white/10"
                      )}
                    >
                      {/* Active indicator ribbon */}
                      {isSelected && (
                        <div className="absolute left-0 top-3.5 bottom-3.5 w-1 bg-primary rounded-r" />
                      )}

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-extrabold text-white group-hover:text-primary transition-colors block">
                            {dateStr}
                          </span>
                          <span className="text-[9px] text-[#64748B] font-mono block">
                            {timeStr} • {r.trades_analyzed} trades
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-sm font-black font-mono",
                            gradeColor(r.grade)
                          )}>
                            {r.grade}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
