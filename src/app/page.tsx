'use client'

import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion'
import { 
  ArrowRight, 
  Bot, 
  Shield, 
  Zap, 
  BarChart2, 
  BookOpen, 
  Activity, 
  ChevronRight, 
  CheckCircle2, 
  Volume2, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Lock, 
  Clock, 
  Plus, 
  Check, 
  DollarSign, 
  Play, 
  X,
  FileText
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { InteractiveBackground } from '@/components/InteractiveBackground'
import FloatingLines from '@/components/FloatingLines'
import GoldBookLogo from '@/components/GoldBookLogo'

// Reusable animated container variant
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] as any },
})

const STATIC_LINES_GRADIENT = ['#FFD700', '#F59E0B', '#B8860B', '#996515']
const STATIC_ENABLED_WAVES: ('top' | 'middle' | 'bottom')[] = ['top', 'bottom', 'middle']
const STATIC_LINE_DISTANCE = [6, 5, 4]


export default function LandingPage() {
  const { scrollY } = useScroll()
  
  // Spring configurations for smoothing scroll jittering
  const yHero = useTransform(scrollY, [0, 600], [0, -90])
  const opacityHero = useTransform(scrollY, [0, 450], [1, 0])
  const yShowcase = useTransform(scrollY, [0, 900], [40, -40])
  const scaleShowcase = useTransform(scrollY, [0, 900], [0.96, 1.03])
  const yBgGlow = useTransform(scrollY, [0, 1200], [0, 250])
  
  const smoothYHero = useSpring(yHero, { stiffness: 90, damping: 25 })
  const smoothOpacityHero = useSpring(opacityHero, { stiffness: 90, damping: 25 })
  const smoothYShowcase = useSpring(yShowcase, { stiffness: 90, damping: 25 })
  const smoothScaleShowcase = useSpring(scaleShowcase, { stiffness: 90, damping: 25 })
  const smoothYBgGlow = useSpring(yBgGlow, { stiffness: 90, damping: 25 })

  // Navigation active states
  const [activeFeature, setActiveFeature] = useState<number>(0)

  // State for Mockup 1: Live MT5 Ticker
  const [xauusdPrice, setXauusdPrice] = useState(2348.50)
  const [trades, setTrades] = useState([
    { id: 1, pair: 'XAUUSD', type: 'BUY', size: 1.00, entry: 2345.20, current: 2348.50, profit: 330.00, status: 'ticking' },
    { id: 2, pair: 'EURUSD', type: 'SELL', size: 2.00, entry: 1.08250, current: 1.08180, profit: 140.00, status: 'ticking' },
    { id: 3, pair: 'GBPUSD', type: 'BUY', size: 1.50, entry: 1.26420, current: 1.26460, profit: 60.00, status: 'ticking' }
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      // Tick gold price randomly
      const change = (Math.random() - 0.5) * 0.4
      setXauusdPrice(prev => {
        const next = Number((prev + change).toFixed(2))
        // Update trades array
        setTrades(prevTrades => 
          prevTrades.map(t => {
            if (t.pair === 'XAUUSD') {
              const current = next
              const profit = Number(((current - t.entry) * 100 * t.size).toFixed(2))
              return { ...t, current, profit }
            }
            if (t.pair === 'EURUSD') {
              const tick = (Math.random() - 0.5) * 0.00010
              const current = Number((t.current + tick).toFixed(5))
              const profit = Number(((t.entry - current) * 100000 * t.size).toFixed(2))
              return { ...t, current, profit }
            }
            if (t.pair === 'GBPUSD') {
              const tick = (Math.random() - 0.5) * 0.00008
              const current = Number((t.current + tick).toFixed(5))
              const profit = Number(((current - t.entry) * 100000 * t.size).toFixed(2))
              return { ...t, current, profit }
            }
            return t
          })
        )
        return next
      })
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  // State for Mockup 2: Nirikshan AI Coach
  const [aiScenario, setAiScenario] = useState<'revenge' | 'fomo' | 'greed' | 'perfect'>('revenge')
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'ai' | 'user', text: string }>>([])
  const [isTyping, setIsTyping] = useState(false)

  const scenarios = {
    revenge: {
      user: "I just lost $250 on gold and re-entered immediately. Can you analyze my state?",
      ai: "⚠️ RED ALERT: Revenge Trading sequence initiated. Your MT5 log shows 3 gold long positions opened within 8 minutes of a stopped out trade. Statistically, in this high-frustration state, your win rate collapses to 14% and average loss size swells by 240%. Intervening: close the terminal immediately, step away for 30 minutes, and complete your discipline checklist."
    },
    fomo: {
      user: "Gold is pumping hard! I entered BUY at the absolute top without confirmation. What should I do?",
      ai: "📢 FOMO DETECTED: You have entered a high-velocity momentum trade with no technical or checklist alignment. Entering without validation is a chronic discipline leak. I recommend trimming 50% of the position size to manage downside and placing a hard stop-loss. Remember: missing a move is free; chasing one is expensive."
    },
    greed: {
      user: "I am up 1:4 Risk-Reward on EURUSD but I want to hold it for a larger run. Should I?",
      ai: "⚖️ GREED ASSESSMENT: Your plan specified a Take Profit at key H4 liquidity (1:3 RR). Historically, when you deviate from target levels and hold, 64% of your trades reverse to breakeven or losses. Take partial profits here (e.g. 70%), set stop to breakeven, and let the remaining run. Never let market euphoria dictate your rules."
    },
    perfect: {
      user: "I waited 2 hours for my London session key level. Entered with 1% risk. Stopped out for -$100.",
      ai: "🏆 EXCELLENT EXECUTION: Congratulations on flawless discipline. You respected your time block, followed your checklist, and locked in a capped 1% risk profile. Losing trades are an inevitable cost of trading; sticking to your rules is your only true edge. Your execution grade for this trade is A+."
    }
  }

  const triggerScenario = (type: 'revenge' | 'fomo' | 'greed' | 'perfect') => {
    setAiScenario(type)
    setIsTyping(true)
    setChatMessages([
      { sender: 'user', text: scenarios[type].user }
    ])

    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        { sender: 'ai', text: scenarios[type].ai }
      ])
      setIsTyping(false)
    }, 1200)
  }

  useEffect(() => {
    triggerScenario('revenge')
  }, [])

  // State for Mockup 3: Discipline Rule Engine
  const [ruleDailyLimit, setRuleDailyLimit] = useState(500)
  const [simulatedLoss, setSimulatedLoss] = useState(420)
  const [maxLots, setMaxLots] = useState(2.0)
  const [simulatedLots, setSimulatedLots] = useState(3.5)

  // State for Mockup 4: High-Fidelity Analytics
  const [analyticsTab, setAnalyticsTab] = useState<'equity' | 'calendar' | 'stats'>('equity')
  const [selectedDay, setSelectedDay] = useState<number>(21)
  const mockCalendarDays = [
    { day: 10, profit: 450, win: true },
    { day: 11, profit: 820, win: true },
    { day: 12, profit: -310, win: false },
    { day: 13, profit: 0, win: null },
    { day: 14, profit: 640, win: true },
    { day: 17, profit: -150, win: false },
    { day: 18, profit: 1250, win: true },
    { day: 19, profit: -220, win: false },
    { day: 20, profit: -480, win: false },
    { day: 21, profit: 1540, win: true }
  ]

  // State for Mockup 5: Collaborative Voice Hub
  const [isJoined, setIsJoined] = useState(false)
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([])
  const [joinedRoom, setJoinedRoom] = useState('XAUUSD Live Scalpers')

  useEffect(() => {
    if (!isJoined) return
    const interval = setInterval(() => {
      const users = ['Yash21', 'Nirav_Fx', 'Sara_Trader', 'You']
      const active = users.filter(() => Math.random() > 0.6)
      setActiveSpeakers(active)
    }, 2000)
    return () => clearInterval(interval)
  }, [isJoined])

  return (
    <div className="min-h-screen bg-transparent text-[#F1F5F9] overflow-x-hidden selection:bg-[#F59E0B]/30 relative font-sans isolate">
      {/* Cinematic Glowing Backdrop */}
      <InteractiveBackground />

      {/* Dynamic Animated Line Waves Backdrop */}
      <div className="fixed inset-0 pointer-events-none h-screen w-screen opacity-50" style={{ zIndex: 1 }}>
        <FloatingLines
          linesGradient={STATIC_LINES_GRADIENT}
          enabledWaves={STATIC_ENABLED_WAVES}
          lineCount={12}
          lineDistance={STATIC_LINE_DISTANCE}
          bendRadius={7.0}
          bendStrength={-0.35}
          interactive={true}
          parallax={true}
          animationSpeed={1.5}
        />
      </div>

      <div className="relative z-10">
        {/* Floating Lights with smooth parallax scroll */}
        <motion.div style={{ y: smoothYBgGlow }} className="fixed top-[-10%] left-[-10%] w-[45vw] h-[45vw] bg-[#F59E0B]/8 blur-[180px] rounded-full pointer-events-none mix-blend-screen" />
        <motion.div style={{ y: smoothYBgGlow }} className="fixed bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] bg-[#B8860B]/6 blur-[200px] rounded-full pointer-events-none mix-blend-screen" />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#050508]/75 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 font-black text-xl tracking-tight">
            <GoldBookLogo size={30} className="shadow-[0_0_15px_rgba(255,215,0,0.2)]" />
            <span className="font-extrabold text-lg tracking-wider">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#F59E0B] to-[#D4AF37]">GOLD</span>
              <span className="text-white/90 font-light">BOOK</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold tracking-wide text-white/60">
            <a href="#telemetry" className="hover:text-[#FFD700] transition-colors">Telemetry</a>
            <a href="#ai-coach" className="hover:text-[#FFD700] transition-colors">AI Coaching</a>
            <a href="#discipline" className="hover:text-[#FFD700] transition-colors">Discipline</a>
            <a href="#analytics" className="hover:text-[#FFD700] transition-colors">Analytics</a>
            <a href="#community" className="hover:text-[#FFD700] transition-colors">Community</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/auth" className="text-sm font-bold text-white/70 hover:text-white transition-colors hidden sm:block">
              Sign In
            </Link>
            <Link href="/auth">
              <button className="relative group px-6 py-2.5 bg-gradient-to-r from-[#FFD700] via-[#F59E0B] to-[#D4AF37] text-black font-bold text-xs uppercase tracking-widest rounded-lg transition-transform hover:scale-105 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
                <span className="relative z-10 flex items-center gap-2">
                  Launch Terminal <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        {/* Decorative Grid Mesh Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] opacity-25 pointer-events-none" />

        <motion.div style={{ y: smoothYHero, opacity: smoothOpacityHero }} className="max-w-6xl mx-auto text-center space-y-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#FFD700]/20 bg-[#FFD700]/5 text-xs font-semibold text-[#FFD700] tracking-wider uppercase backdrop-blur-lg"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD700] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFD700]" />
            </span>
            Real-Time MT5 Telemetry & AI Behavioral Assessment
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-8xl font-black tracking-tight leading-[1.05] uppercase"
          >
            Master Your Discipline. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#FFE066] to-[#D4AF37] drop-shadow-[0_0_20px_rgba(255,215,0,0.15)]">
              Own Your Edge.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-[#94A3B8] max-w-3xl mx-auto leading-relaxed"
          >
            Connect MT5 instantly. Stream trade telemetry. Let Nirikshan AI dissect your psychology, block revenge trading, and enforce concrete discipline metrics.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link href="/auth">
              <button className="group relative px-8 py-4 bg-white text-black hover:bg-neutral-100 rounded-lg text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 shadow-[0_5px_30px_rgba(255,255,255,0.15)]">
                <span className="relative z-10 flex items-center gap-3">
                  Start Trading Free
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </Link>
            <a href="#telemetry" className="px-7 py-4 text-[#94A3B8] hover:text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2 group">
              <Activity className="w-4 h-4 group-hover:text-[#FFD700]" /> Explore Features
            </a>
          </motion.div>
        </motion.div>

        {/* Cinematic Dashboard Showcase Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 80, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ y: smoothYShowcase, scale: smoothScaleShowcase }}
          className="mt-20 max-w-5xl mx-auto relative z-20"
        >
          <div className="absolute -inset-2 bg-gradient-to-b from-[#F59E0B]/10 to-transparent blur-2xl -z-10 rounded-[2.5rem]" />

          <div className="bg-[#0c0c14]/90 border border-white/10 rounded-2xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.8)] backdrop-blur-2xl flex flex-col h-[480px]">
            {/* Window control header */}
            <div className="h-11 border-b border-white/5 flex items-center justify-between px-4 bg-white/[0.01]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white/10" />
                <div className="w-3 h-3 rounded-full bg-white/10" />
                <div className="w-3 h-3 rounded-full bg-white/10" />
              </div>
              <div className="text-[10px] font-mono text-[#64748B] uppercase tracking-widest px-4 py-1 rounded bg-white/5 border border-white/5">
                GOLDBOOK TERMINAL — VERIFIED ENGINE
              </div>
              <div className="w-12" />
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Mock Sidebar */}
              <div className="w-48 border-r border-white/5 bg-[#07070b]/60 p-3 hidden md:flex flex-col gap-1.5">
                {[
                  { icon: Activity, label: 'Dashboard', active: true },
                  { icon: BarChart2, label: 'Trade Analytics', active: false },
                  { icon: Bot, label: 'Nirikshan AI Coach', active: false },
                  { icon: Shield, label: 'Discipline Rules', active: false },
                  { icon: Users, label: 'Trading Rooms', active: false },
                ].map(item => (
                  <div key={item.label} className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer text-xs font-semibold", 
                    item.active ? "bg-[#FFD700]/10 text-[#FFD700]" : "text-[#64748B] hover:text-white/80"
                  )}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="tracking-wide">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Mock Main Console Panel */}
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-white">Console Overview</h3>
                    <p className="text-[#64748B] text-xs">Live Telemetry Link established via MT5.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold bg-[#22C55E]/10 text-[#22C55E] px-3.5 py-1.5 rounded-full border border-[#22C55E]/20">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                    MT5_CONNECTED
                  </div>
                </div>

                {/* Key Metric Blocks */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Account Balance', val: '$24,850.50', color: 'text-white' },
                    { label: 'Today\'s P&L', val: '+$530.00', color: 'text-[#22C55E]' },
                    { label: 'Rule Violations', val: '0 STRIKES', color: 'text-[#22C55E]' },
                    { label: 'Discipline Grade', val: 'A (EXCELLENT)', color: 'text-[#FFD700]' },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#10101a] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                      <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">{s.label}</p>
                      <p className={cn("text-base font-extrabold mt-1.5", s.color)}>{s.val}</p>
                    </div>
                  ))}
                </div>

                {/* Live Trade Ticker Widget inside the Hero Terminal */}
                <div className="bg-[#10101a] border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Active Telemetry Stream</p>
                    <span className="text-[10px] font-mono text-[#64748B] bg-white/5 px-2 py-0.5 rounded">Latency: 14ms</span>
                  </div>
                  <div className="space-y-2">
                    {trades.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/[0.03] rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded font-black tracking-wide",
                            t.type === 'BUY' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                          )}>{t.type}</span>
                          <span className="text-xs font-bold text-white/90">{t.pair}</span>
                          <span className="text-[10px] text-[#64748B]">{t.size.toFixed(2)} Lots</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-[10px] text-[#64748B] block">Entry Level</span>
                            <span className="text-xs font-mono font-semibold text-white/80">{t.entry.toFixed(2)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[#64748B] block">Live Price</span>
                            <span className="text-xs font-mono font-semibold text-white/80 animate-pulse">{t.current.toFixed(2)}</span>
                          </div>
                          <div className="w-20 text-right">
                            <span className={cn(
                              "text-xs font-bold font-mono",
                              t.profit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                            )}>
                              {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature Narrative Intro Header */}
      <div className="max-w-4xl mx-auto text-center mt-20 mb-10 px-6">
        <h2 className="text-xs font-bold text-[#FFD700] uppercase tracking-widest">Platform Breakdown</h2>
        <p className="text-3xl md:text-5xl font-black tracking-tight uppercase mt-2">Engineered For Psychological Edge</p>
        <p className="text-[#94A3B8] text-sm mt-3">A sequential, comprehensive walk-through of the GoldBook tracking & assistance suite.</p>
      </div>

      {/* alternating sequential features blocks */}

      {/* SECTION 1: Live MT5 Telemetry Stream */}
      <section id="telemetry" className="py-24 border-t border-white/5 relative bg-[#050508]/40">
        <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
          <motion.div {...fadeUp(0)} className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FFD700]/10 border border-[#FFD700]/20 text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">
              <Zap className="w-3 h-3" /> Live Synchronization
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-none text-white">
              Zero Manual Entry. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#F59E0B]">
                Immediate Telemetry.
              </span>
            </h2>
            <p className="text-[#94A3B8] leading-relaxed text-sm">
              Stop messing with spreadsheets or manual logs. Simply connect your MT5 investor password. GoldBook securely logs in with read-only authorization and streams every execution directly, evaluating your metrics instantly without interrupting your trading desk.
            </p>
            <div className="space-y-3.5">
              {[
                { title: "Universal MT5 Connection", desc: "Connect Exness, IC Markets, Pepperstone, or any MT5 broker server globally." },
                { title: "Read-Only Security Guarantee", desc: "Secure credentials architecture. Your principal capital remains completely untouched." },
                { title: "Sub-Second Live Syncing", desc: "Open positions are tracked, evaluated, and synced with 15ms resolution." }
              ].map(item => (
                <div key={item.title} className="flex gap-3">
                  <Check className="w-4 h-4 text-[#FFD700] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-xs font-bold text-white hover:text-[#FFD700] uppercase tracking-wider transition-colors">
                  Setup Live Sync Account <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Interactive Mockup 1: Live MT5 Ticker Panel */}
          <motion.div {...fadeUp(0.2)} className="flex-1 w-full">
            <div className="bg-[#0c0c14]/80 border border-white/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl relative">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[9px] font-mono text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping" />
                LIVE STREAMING
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">MT5 Telemetry Feed</h3>
              <p className="text-[#64748B] text-[11px] mb-4">Simulating ticking prices from your MT5 terminal.</p>

              <div className="space-y-3">
                {trades.map(t => (
                  <div key={t.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider",
                          t.type === 'BUY' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                        )}>{t.type}</span>
                        <span className="text-sm font-bold text-white">{t.pair}</span>
                        <span className="text-[10px] text-[#64748B]">{t.size.toFixed(2)} Lots</span>
                      </div>
                      <div className="flex gap-4 mt-2">
                        <span className="text-[10px] text-[#64748B]">Entry: <span className="font-mono text-white/80">{t.entry.toFixed(2)}</span></span>
                        <span className="text-[10px] text-[#64748B]">Current: <span className="font-mono text-white/80 animate-pulse">{t.current.toFixed(2)}</span></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#64748B] block uppercase tracking-wider font-bold">Unrealized P&L</span>
                      <span className={cn(
                        "text-sm font-extrabold font-mono",
                        t.profit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                      )}>
                        {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[10px] text-[#64748B]">
                <span>Total Trades Active: 3</span>
                <span className="flex items-center gap-1.5 font-bold text-white">
                  Net Open P&L: 
                  <span className="text-[#22C55E] font-mono text-xs">
                    +${trades.reduce((acc, curr) => acc + curr.profit, 0).toFixed(2)}
                  </span>
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2: Nirikshan AI Coach */}
      <section id="ai-coach" className="py-24 border-t border-white/5 relative bg-[#050508]/10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row-reverse items-center gap-16">
          <motion.div {...fadeUp(0)} className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FFD700]/10 border border-[#FFD700]/20 text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">
              <Bot className="w-3 h-3" /> Cognitive Assistant
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-none text-white">
              Nirikshan AI. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#F59E0B]">
                Your Psychological Shield.
              </span>
            </h2>
            <p className="text-[#94A3B8] leading-relaxed text-sm">
              Most traders don't lack strategies—they lack emotional discipline. Nirikshan AI is a cognitive trading model trained to recognize revenge trading cycles, FOMO entry signals, greed holds, and exhaustion. It grades your execution quality on every execution, delivering behavioral diagnostics when you need them.
            </p>
            <div className="space-y-3.5">
              {[
                { title: "Revenge trading lockout warning", desc: "Flags frequent re-entries within 15 minutes of a loss to prevent drawdowns." },
                { title: "Psychological profile matrix", desc: "Constructs a personalized profile map based on your logged emotion tags." },
                { title: "Behavioral edge reports", desc: "Pinpoints exactly which emotions lead to profitable executions and which destroy your P&L." }
              ].map(item => (
                <div key={item.title} className="flex gap-3">
                  <Check className="w-4 h-4 text-[#FFD700] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-xs font-bold text-white hover:text-[#FFD700] uppercase tracking-wider transition-colors">
                  Consult Nirikshan AI <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Interactive Mockup 2: Nirikshan AI Chat Interface */}
          <motion.div {...fadeUp(0.2)} className="flex-1 w-full">
            <div className="bg-[#0c0c14]/80 border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl flex flex-col h-[400px]">
              {/* Chat Header */}
              <div className="p-4 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-[#FFD700]" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">Nirikshan AI Coach</span>
                    <span className="text-[10px] text-[#22C55E] flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                      Active Analysis Engine
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat Log Body */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto font-sans text-xs">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-3", msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.sender === 'ai' && (
                      <div className="w-6 h-6 rounded-full bg-[#FFD700]/10 flex items-center justify-center shrink-0 border border-[#FFD700]/20">
                        <Bot className="w-3 h-3 text-[#FFD700]" />
                      </div>
                    )}
                    <div className={cn(
                      "p-3 rounded-xl max-w-[80%] leading-relaxed",
                      msg.sender === 'user' 
                        ? 'bg-white/5 border border-white/10 text-white' 
                        : 'bg-[#FFD700]/5 border border-[#FFD700]/10 text-white/90'
                    )}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-1 text-[#FFD700] text-[10px] font-bold">
                    <span className="w-1 h-1 rounded-full bg-[#FFD700] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 rounded-full bg-[#FFD700] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 rounded-full bg-[#FFD700] animate-bounce" />
                    <span>Nirikshan typing...</span>
                  </div>
                )}
              </div>

              {/* Chat Quick Action Trigger Controls */}
              <div className="p-3 border-t border-white/5 bg-white/[0.01] flex flex-wrap gap-2 justify-center">
                <button 
                  onClick={() => triggerScenario('revenge')} 
                  className={cn("px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded border transition-colors",
                    aiScenario === 'revenge' ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]' : 'bg-white/5 border-white/5 text-[#64748B] hover:text-white'
                  )}
                >
                  Revenge Trade
                </button>
                <button 
                  onClick={() => triggerScenario('fomo')} 
                  className={cn("px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded border transition-colors",
                    aiScenario === 'fomo' ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B]' : 'bg-white/5 border-white/5 text-[#64748B] hover:text-white'
                  )}
                >
                  FOMO BUY
                </button>
                <button 
                  onClick={() => triggerScenario('greed')} 
                  className={cn("px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded border transition-colors",
                    aiScenario === 'greed' ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-[#3B82F6]' : 'bg-white/5 border-white/5 text-[#64748B] hover:text-white'
                  )}
                >
                  Greed Hold
                </button>
                <button 
                  onClick={() => triggerScenario('perfect')} 
                  className={cn("px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded border transition-colors",
                    aiScenario === 'perfect' ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]' : 'bg-white/5 border-white/5 text-[#64748B] hover:text-white'
                  )}
                >
                  Flawless Win
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 3: Discipline Rule Engine */}
      <section id="discipline" className="py-24 border-t border-white/5 relative bg-[#050508]/40">
        <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
          <motion.div {...fadeUp(0)} className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FFD700]/10 border border-[#FFD700]/20 text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">
              <Shield className="w-3 h-3" /> Hard Safeguards
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-none text-white">
              Strict Rule Framework. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#F59E0B]">
                Enforce Your Limits.
              </span>
            </h2>
            <p className="text-[#94A3B8] leading-relaxed text-sm">
              Define your custom parameters for maximum daily loss, maximum lot size limits, risk-reward ratios, and session restraints. GoldBook continuously calculates risk constraints against your active balance, flashing immediate warnings and logging violations to keep you transparent.
            </p>
            <div className="space-y-3.5">
              {[
                { title: "Dynamic balance-based % calculations", desc: "Daily drawdown bounds recalculate automatically relative to your high water mark." },
                { title: "Permanent violation logging system", desc: "Infractions are permanently logged to enforce accountability and remove rule fatigue." },
                { title: "Automated restraint warnings", desc: "Flags aggressive trade executions happening in too short of a timeline." }
              ].map(item => (
                <div key={item.title} className="flex gap-3">
                  <Check className="w-4 h-4 text-[#FFD700] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-xs font-bold text-white hover:text-[#FFD700] uppercase tracking-wider transition-colors">
                  Establish Discipline Board <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Interactive Mockup 3: Rule Compliance Board */}
          <motion.div {...fadeUp(0.2)} className="flex-1 w-full">
            <div className="bg-[#0c0c14]/80 border border-white/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl relative space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Discipline Dashboard</h3>
                  <p className="text-[#64748B] text-[10px]">Real-time balance-linked parameter engine.</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#64748B] block uppercase font-bold">Rule Score</span>
                  <span className={cn(
                    "text-sm font-black",
                    simulatedLots > maxLots || simulatedLoss > ruleDailyLimit ? "text-[#EF4444]" : "text-[#22C55E]"
                  )}>
                    {simulatedLots > maxLots || simulatedLoss > ruleDailyLimit ? "32% CRITICAL" : "96% SECURE"}
                  </span>
                </div>
              </div>

              {/* Rule Card 1: Daily Drawdown (Interactive Slider) */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#FFD700]" />
                    <span className="font-bold text-white uppercase tracking-wide">Daily Loss Cap</span>
                  </div>
                  <span className="text-[#64748B] text-[11px]">Loss: <span className="text-white font-bold">${simulatedLoss}</span> / limit: <span className="text-[#FFD700] font-bold">${ruleDailyLimit}</span></span>
                </div>
                
                <input 
                  type="range" 
                  min="200" 
                  max="1000" 
                  value={ruleDailyLimit}
                  onChange={(e) => setRuleDailyLimit(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FFD700]"
                />

                <div className="flex items-center justify-between pt-1">
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        (simulatedLoss / ruleDailyLimit) > 0.9 ? "bg-[#EF4444] animate-pulse" : "bg-[#FFD700]"
                      )}
                      style={{ width: `${Math.min(100, (simulatedLoss / ruleDailyLimit) * 100)}%` }}
                    />
                  </div>
                </div>
                {(simulatedLoss / ruleDailyLimit) > 0.9 && (
                  <p className="text-[10px] text-[#EF4444] font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> DRAWDOWN WARNING: 94% OF DAILY LOSS CAP EXCEEDED.
                  </p>
                )}
              </div>

              {/* Rule Card 2: Lot Constraint */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#FFD700]" />
                    <span className="font-bold text-white uppercase tracking-wide">Max Lot Allocation</span>
                  </div>
                  <span className="text-[#64748B] text-[11px]">Active: <span className="text-white font-bold">{simulatedLots} Lots</span> / limit: <span className="text-[#FFD700] font-bold">{maxLots} Lots</span></span>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setSimulatedLots(1.5)} 
                    className={cn("flex-1 py-1.5 text-[10px] font-bold uppercase rounded border transition-colors",
                      simulatedLots === 1.5 ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/5 text-[#64748B]"
                    )}
                  >
                    1.50 Lots
                  </button>
                  <button 
                    onClick={() => setSimulatedLots(3.5)} 
                    className={cn("flex-1 py-1.5 text-[10px] font-bold uppercase rounded border transition-colors",
                      simulatedLots === 3.5 ? "bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]" : "bg-white/5 border-white/5 text-[#64748B]"
                    )}
                  >
                    3.50 Lots
                  </button>
                </div>

                {simulatedLots > maxLots && (
                  <div className="p-2.5 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
                    <div>
                      <h4 className="text-[10px] font-bold text-[#EF4444] uppercase tracking-wider">RULE VIOLATION TRIGGERED</h4>
                      <p className="text-[9px] text-[#64748B]">Position breached max 2.0 Lots limit. Strike logged to history.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 4: High-Fidelity Analytics */}
      <section id="analytics" className="py-24 border-t border-white/5 relative bg-[#050508]/10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row-reverse items-center gap-16">
          <motion.div {...fadeUp(0)} className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FFD700]/10 border border-[#FFD700]/20 text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">
              <BarChart2 className="w-3 h-3" /> Visual Analytics
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-none text-white">
              Dynamic Analytics. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#F59E0B]">
                Discover Your Edge.
              </span>
            </h2>
            <p className="text-[#94A3B8] leading-relaxed text-sm">
              Ditch static spreadsheets. GoldBook constructs high-fidelity equity curves, win/loss calendars, session payout mapping, and precise metrics. See immediately which time blocks, assets, and lot-profiles contribute to your growth and which damage your profile.
            </p>
            <div className="space-y-3.5">
              {[
                { title: "Dynamic Equity Curve Plotting", desc: "Plots absolute growth progress maps with standard error bounding bands." },
                { title: "Heatmapped calendar logs", desc: "A gorgeous calendar showcasing exact daily gains, losses, and emotion flags." },
                { title: "Advanced statistics indicators", desc: "Computes Profit Factor, Sharpe Ratio, Win/Loss Standard Deviation, and R-multiple." }
              ].map(item => (
                <div key={item.title} className="flex gap-3">
                  <Check className="w-4 h-4 text-[#FFD700] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-xs font-bold text-white hover:text-[#FFD700] uppercase tracking-wider transition-colors">
                  Open Analytics Dashboard <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Interactive Mockup 4: Analytics Console & Performance Calendar */}
          <motion.div {...fadeUp(0.2)} className="flex-1 w-full">
            <div className="bg-[#0c0c14]/80 border border-white/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl flex flex-col h-[400px]">
              {/* Tab selector */}
              <div className="flex border-b border-white/5 bg-white/[0.01] rounded-t-xl overflow-hidden mb-4">
                <button 
                  onClick={() => setAnalyticsTab('equity')}
                  className={cn("flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors", 
                    analyticsTab === 'equity' ? "bg-white/5 text-[#FFD700] border-b border-[#FFD700]" : "text-[#64748B] hover:text-white"
                  )}
                >
                  Equity Curve
                </button>
                <button 
                  onClick={() => setAnalyticsTab('calendar')}
                  className={cn("flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors", 
                    analyticsTab === 'calendar' ? "bg-white/5 text-[#FFD700] border-b border-[#FFD700]" : "text-[#64748B] hover:text-white"
                  )}
                >
                  PnL Calendar
                </button>
                <button 
                  onClick={() => setAnalyticsTab('stats')}
                  className={cn("flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors", 
                    analyticsTab === 'stats' ? "bg-white/5 text-[#FFD700] border-b border-[#FFD700]" : "text-[#64748B] hover:text-white"
                  )}
                >
                  Edge Stats
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-1">
                {analyticsTab === 'equity' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#64748B] uppercase tracking-wide">Net Growth Curve</span>
                      <span className="text-[#22C55E] font-bold font-mono">+$4,250.00 Overall</span>
                    </div>
                    {/* SVG Equity Line */}
                    <div className="relative h-44 w-full bg-white/[0.01] border border-white/5 rounded-xl overflow-hidden flex items-end">
                      <svg className="absolute inset-0 w-full h-full p-2" viewBox="0 0 100 50" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FFD700" stopOpacity="0.2"/>
                            <stop offset="100%" stopColor="#FFD700" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        {/* Area */}
                        <path d="M 0 50 L 10 45 L 20 40 L 30 46 L 40 38 L 50 35 L 60 22 L 70 28 L 80 20 L 90 12 L 100 8 L 100 50 Z" fill="url(#chartGradient)" />
                        {/* Line */}
                        <path d="M 0 50 L 10 45 L 20 40 L 30 46 L 40 38 L 50 35 L 60 22 L 70 28 L 80 20 L 90 12 L 100 8" fill="none" stroke="#FFD700" strokeWidth="1.5" />
                        {/* Highlights */}
                        <circle cx="60" cy="22" r="1.5" fill="#FFD700" className="animate-pulse" />
                        <circle cx="100" cy="8" r="1.5" fill="#FFD700" className="animate-pulse" />
                      </svg>
                      <div className="absolute bottom-2 left-2 text-[9px] font-mono text-[#64748B]">May 1</div>
                      <div className="absolute bottom-2 right-2 text-[9px] font-mono text-[#64748B]">May 21</div>
                    </div>
                  </div>
                )}

                {analyticsTab === 'calendar' && (
                  <div className="space-y-4">
                    <p className="text-[10px] text-[#64748B] uppercase tracking-wide">Interactive Session Calendar (Click days)</p>
                    
                    <div className="grid grid-cols-5 gap-2.5 max-w-sm mx-auto">
                      {mockCalendarDays.map((d) => (
                        <div 
                          key={d.day}
                          onClick={() => setSelectedDay(d.day)}
                          className={cn(
                            "aspect-square rounded-lg flex flex-col justify-center items-center cursor-pointer border transition-all text-xs font-bold",
                            d.win === true ? "bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/20" : 
                            d.win === false ? "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/20" : 
                            "bg-white/5 border-white/5 text-[#64748B]",
                            selectedDay === d.day ? "ring-2 ring-[#FFD700] ring-offset-2 ring-offset-[#0c0c14]" : ""
                          )}
                        >
                          <span>{d.day}</span>
                        </div>
                      ))}
                    </div>

                    {/* Day Details card details */}
                    <AnimatePresence mode="wait">
                      {selectedDay && (
                        <motion.div 
                          key={selectedDay}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[11px]"
                        >
                          <div className="flex justify-between items-center font-bold text-white mb-2 uppercase tracking-wider text-[10px]">
                            <span>Session Detail — May {selectedDay}</span>
                            <span className={cn(
                              mockCalendarDays.find(d => d.day === selectedDay)?.profit ?? 0 >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                            )}>
                              {mockCalendarDays.find(d => d.day === selectedDay)?.profit ?? 0 >= 0 ? '+' : ''}
                              ${mockCalendarDays.find(d => d.day === selectedDay)?.profit}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[#64748B]">
                            <span>Executions: <span className="text-white font-semibold">3 (MT5 Synced)</span></span>
                            <span>Avg RR Achieved: <span className="text-white font-semibold">1:2.8</span></span>
                            <span>Main Tag: <span className="text-white font-semibold uppercase">Calm / Discipline</span></span>
                            <span>Revenge Trades: <span className="text-white font-semibold">0</span></span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {analyticsTab === 'stats' && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Profit Factor', val: '2.84', desc: 'Ratio of gross wins to gross losses' },
                      { label: 'Sharpe Ratio', val: '1.92', desc: 'Risk-adjusted investment return profile' },
                      { label: 'Average RR', val: '1:3.2', desc: 'Realized stop-loss to target metrics' },
                      { label: 'Execution Rate', val: '94.2%', desc: 'Percentage of trades matching rules' }
                    ].map(s => (
                      <div key={s.label} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                        <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold block">{s.label}</span>
                        <span className="text-sm font-extrabold text-[#FFD700] block mt-0.5">{s.val}</span>
                        <span className="text-[9px] text-[#64748B] leading-none mt-1 block">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 5: Collaborative Trading Hub */}
      <section id="community" className="py-24 border-t border-white/5 relative bg-[#050508]/40">
        <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
          <motion.div {...fadeUp(0)} className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FFD700]/10 border border-[#FFD700]/20 text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">
              <Users className="w-3 h-3" /> Peer Collaboration
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-none text-white">
              Shared Rooms. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#F59E0B]">
                Trade in Synchrony.
              </span>
            </h2>
            <p className="text-[#94A3B8] leading-relaxed text-sm">
              Don't isolate yourself in trading. Join collaborative GoldBook voice rooms where you can discuss live market flows, share trading plans, and broadcast verified executions. Build social accountability structures to stay aligned with your goals.
            </p>
            <div className="space-y-3.5">
              {[
                { title: "High-fidelity social voice rooms", desc: "Collaborate instantly on active levels with integrated voice latency controls." },
                { title: "Verified plan broadcasting feed", desc: "Broadcast live plans directly. Peers see verified entry and statistics overlays." },
                { title: "Group accountability checklists", desc: "Establish shared rules. Room participants receive notifications when rules are violated." }
              ].map(item => (
                <div key={item.title} className="flex gap-3">
                  <Check className="w-4 h-4 text-[#FFD700] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-xs font-bold text-white hover:text-[#FFD700] uppercase tracking-wider transition-colors">
                  Join Peer Ecosystem <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Interactive Mockup 5: Voice Channel & Shared Trades Hub */}
          <motion.div {...fadeUp(0.2)} className="flex-1 w-full">
            <div className="bg-[#0c0c14]/80 border border-white/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl relative space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Trading Room Voice</h3>
                  <p className="text-[#64748B] text-[10px]">Active Room: <span className="text-[#FFD700] font-semibold">{joinedRoom}</span></p>
                </div>
                <button 
                  onClick={() => setIsJoined(!isJoined)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border",
                    isJoined 
                      ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]" 
                      : "bg-[#FFD700]/10 border-[#FFD700]/30 text-[#FFD700] hover:scale-105"
                  )}
                >
                  {isJoined ? 'Disconnect' : 'Join Voice Room'}
                </button>
              </div>

              {/* Speaker layout bubble */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Yash21', role: 'Host', avatar: 'Y' },
                  { name: 'Nirav_Fx', role: 'Trader', avatar: 'N' },
                  { name: 'Sara_Trader', role: 'Scalper', avatar: 'S' },
                  { name: 'You', role: 'Trader', avatar: 'U' }
                ].map(u => {
                  const isUserJoined = isJoined || u.name !== 'You'
                  const isSpeaking = isUserJoined && activeSpeakers.includes(u.name)
                  return (
                    <div 
                      key={u.name} 
                      className={cn(
                        "p-3 rounded-xl border flex items-center gap-3 transition-all",
                        isSpeaking 
                          ? "bg-[#FFD700]/5 border-[#FFD700]/20 shadow-[0_0_12px_rgba(255,215,0,0.1)]" 
                          : "bg-white/[0.01] border-white/5"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs relative",
                        isSpeaking ? "bg-[#FFD700] text-black" : "bg-white/10 text-white/80"
                      )}>
                        {u.avatar}
                        {isSpeaking && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#FFD700] rounded-full border-2 border-[#0c0c14] flex items-center justify-center">
                            <Volume2 className="w-2.5 h-2.5 text-black" />
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white/95 block">{u.name}</span>
                        <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">{u.role}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Shared Live Trade Card in room */}
              <div className="bg-[#10101a] border border-white/5 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-[10px] text-[#64748B]">
                  <span className="uppercase tracking-wider font-bold text-white/60">Verified Broadcast from Room</span>
                  <span>10 mins ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase bg-[#22C55E]/10 text-[#22C55E] px-1.5 py-0.5 rounded">LIMIT BUY</span>
                    <span className="text-xs font-bold text-white">XAUUSD</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#FFD700]">Entry: 2342.10</span>
                </div>
                <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                  "Targeting weekly liquidity boundary. Stop placed below H1 support level (2336.00). Target TP at 2360.00."
                </p>
                <div className="pt-1 flex gap-2">
                  <button className="flex-1 py-1 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded text-[9px] font-bold text-white uppercase tracking-wider">
                    Copy Strategy levels
                  </button>
                  <button className="flex-1 py-1 bg-[#FFD700]/10 border border-[#FFD700]/20 hover:bg-[#FFD700]/20 transition-colors rounded text-[9px] font-bold text-[#FFD700] uppercase tracking-wider">
                    View Chart Breakdown
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Cinematic Call To Action */}
      <section className="py-32 px-6 border-t border-white/5 text-center relative overflow-hidden bg-[#07070b]/60">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-8 relative z-10">
          <h2 className="text-4xl md:text-7xl font-black tracking-tight uppercase leading-none text-white">
            Remove Rule Fatigue.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#FFE066] to-[#D4AF37] drop-shadow-[0_0_20px_rgba(255,215,0,0.15)]">
              Acquire Precision Edge.
            </span>
          </h2>
          <p className="text-[#94A3B8] text-base md:text-lg max-w-2xl mx-auto">
            Join the cohort of institutional-minded retail traders tracking emotion, executing with discipline, and streaming verified telemetry.
          </p>
          <div className="flex justify-center pt-4">
            <Link href="/auth">
              <button className="group relative px-9 py-4.5 bg-gradient-to-r from-[#FFD700] via-[#F59E0B] to-[#D4AF37] text-black font-extrabold uppercase tracking-widest text-xs rounded-lg transition-transform hover:scale-105 shadow-[0_0_30px_rgba(255,215,0,0.3)]">
                <span className="relative z-10 flex items-center gap-2">
                  Deploy GoldBook Console Now <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#050508] px-6 py-12 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#64748B] font-semibold">
          <div className="flex items-center gap-2 font-black text-lg tracking-tight text-white">
            <GoldBookLogo size={22} className="shadow-[0_0_10px_rgba(255,215,0,0.15)]" />
            <span className="font-extrabold text-sm tracking-wider">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#F59E0B] to-[#D4AF37]">GOLD</span>
              <span className="text-white/90 font-light">BOOK</span>
            </span>
          </div>
          <p>© {new Date().getFullYear()} GoldBook Inc. Free forever. Built by gold traders for disciplined scalpers.</p>
        </div>
      </footer>
    </div>
  </div>
  )
}
