'use client'

import { useState, useEffect } from 'react'
import Lenis from 'lenis'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowRight, Bot, Shield, Zap, BarChart2, BookOpen, Activity, 
  ChevronRight, CheckCircle2, XCircle, Volume2, TrendingUp, AlertTriangle, 
  Users, Lock, Clock, Plus, Check, DollarSign, Play, X, FileText, Award, Scale, Timer, Gauge
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import GoldBookLogo from '@/components/GoldBookLogo'

// ─── Obsidian UI Components ───────────────────────────────────────────────────
import dynamic from 'next/dynamic'

const ParticleBackground = dynamic(
  () => import('@/components/obsidian/ParticleBackground').then(mod => mod.ParticleBackground),
  { ssr: false }
)

import { ParallaxSection } from '@/components/obsidian/ParallaxSection'
import { ScrollReveal } from '@/components/obsidian/ScrollReveal'
import { MagneticButton } from '@/components/obsidian/MagneticButton'
import { LiquidProgress } from '@/components/obsidian/LiquidProgress'
import { HolographicTilt } from '@/components/obsidian/HolographicTilt'

// ─── Frost Platinum Palette ───────────────────────────────────────────────────
// Primary bg:  #060A12  (deep navy-void)
// Surface:     #0D1421  (frost-dark navy)
// Accent:      #38BDF8  (ice blue)
// Glow:        #7DD3FC  (frost glow)
// Success:     #34D399  (mint ice)
// Danger:      #F87171  (frost rose)
// Border:      #1E3A5F  (ice-steel)
// Text muted:  #94A3B8
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState<number>(0)
  const [analyticsTab, setAnalyticsTab] = useState<'equity' | 'calendar' | 'stats'>('equity')
  const [aiTab, setAiTab] = useState<'bias' | 'emotions'>('bias')
  const [selectedDay, setSelectedDay] = useState<number>(21)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.6,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.8,
      infinite: false,
    })
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
    return () => { lenis.destroy() }
  }, [])

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

  return (
    <div className="min-h-screen bg-[#060A12] text-[#E2E8F0] overflow-x-hidden selection:bg-[#38BDF8]/25 relative font-sans antialiased">

      {/* Fine 1px scanline texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.025]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 2px)',
          backgroundSize: '100% 2px'
        }}
      />

      {/* Global terminal grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.018] z-0"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.12) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      {/* Ambient frost glow orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[55vw] h-[55vw] bg-gradient-to-r from-[#38BDF8]/5 to-transparent blur-[160px] rounded-full pointer-events-none -z-10 select-none" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] bg-gradient-to-r from-[#7DD3FC]/3 to-transparent blur-[180px] rounded-full pointer-events-none -z-10 select-none" />

      {/* ═══════════════════════════════════════════════════════════════════
          NAV
      ═══════════════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-[#38BDF8]/8 bg-[#060A12]/85 backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 font-black text-xl tracking-tight">
            <GoldBookLogo size={30} className="shadow-[0_0_20px_rgba(56,189,248,0.2)]" />
            <span className="font-extrabold text-lg tracking-wider">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] via-[#7DD3FC] to-[#BAE6FD]">GOLD</span>
              <span className="text-white/90 font-light">BOOK</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs uppercase tracking-widest font-bold text-white/50">
            <a href="#sync-feed" className="hover:text-[#38BDF8] hover:tracking-[0.12em] transition-all">Live Sync</a>
            <a href="#ai-coach" className="hover:text-[#38BDF8] hover:tracking-[0.12em] transition-all">AI Coaching</a>
            <a href="#discipline" className="hover:text-[#38BDF8] hover:tracking-[0.12em] transition-all">Discipline</a>
            <a href="#analytics" className="hover:text-[#38BDF8] hover:tracking-[0.12em] transition-all">Analytics</a>
            <a href="#community" className="hover:text-[#38BDF8] hover:tracking-[0.12em] transition-all">Community</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/auth" className="text-xs font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors hidden sm:block">
              Sign In
            </Link>
            <Link href="/auth">
              <MagneticButton className="relative group px-5 py-2 border border-[#38BDF8]/30 hover:border-[#38BDF8]/70 bg-gradient-to-b from-[#38BDF8]/8 to-transparent text-white font-extrabold text-[10px] uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(56,189,248,0.08)] cursor-pointer overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#38BDF8]/20 to-transparent -translate-x-full opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity duration-300 pointer-events-none" />
                <span className="relative z-10 flex items-center gap-2">
                  Launch Terminal <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </MagneticButton>
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — Hero "The Observatory"
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-6 pt-24 overflow-hidden border-b border-[#38BDF8]/8">
        <ParticleBackground density={1200} goldColor="#7DD3FC" cyanColor="#38BDF8" />

        <div className="max-w-6xl mx-auto text-center space-y-8 relative z-10 py-16">
          {/* Status badge */}
          <ScrollReveal delay={0.1}>
            <div className="inline-flex items-center gap-2.5 px-4.5 py-2 rounded-full border border-[#38BDF8]/20 bg-[#38BDF8]/5 text-[10px] font-black uppercase tracking-widest text-[#38BDF8] backdrop-blur-lg">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38BDF8] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#38BDF8]" />
              </span>
              Automated MT5 Journaling &amp; Trading Psychology Coach
            </div>
          </ScrollReveal>

          {/* Headline */}
          <ScrollReveal delay={0.2} direction="up" className="space-y-2">
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tight leading-[0.98] uppercase">
              Master Your Discipline. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] via-[#E2E8F0] to-[#7DD3FC] drop-shadow-[0_0_24px_rgba(56,189,248,0.2)] animate-[pulse_4s_infinite]">
                Own Your Edge.
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.35}>
            <p className="text-base sm:text-lg text-[#94A3B8] max-w-3xl mx-auto leading-relaxed font-semibold">
              Sync your MT5 account instantly. Log trades automatically. Let our psychology coach identify your blind spots, block revenge trading, and keep you disciplined.
            </p>
          </ScrollReveal>

          {/* CTAs */}
          <ScrollReveal delay={0.5} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/auth">
              <MagneticButton className="group relative px-8 py-3.5 bg-gradient-to-b from-[#38BDF8] to-[#0284C7] hover:from-[#7DD3FC] hover:to-[#38BDF8] text-[#060A12] font-black text-xs uppercase tracking-widest rounded-full transition-all hover:scale-105 shadow-[0_5px_30px_rgba(56,189,248,0.25)] cursor-pointer overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity duration-300 pointer-events-none" />
                <span className="relative z-10 flex items-center gap-3">
                  Initialize Connection
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </span>
              </MagneticButton>
            </Link>
            <a href="#sync-feed" className="px-7 py-3.5 text-[#94A3B8] hover:text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 group border border-white/5 hover:border-[#38BDF8]/20 rounded-full bg-white/[0.02]">
              <Activity className="w-4 h-4 group-hover:text-[#38BDF8] animate-pulse" /> Explore Features
            </a>
          </ScrollReveal>
        </div>

        {/* Dashboard showcase mockup */}
        <ScrollReveal delay={0.6} direction="up" className="w-full max-w-5xl mx-auto px-4 z-20 pb-16">
          <HolographicTilt>
            <div className="absolute -inset-2 bg-gradient-to-b from-[#38BDF8]/8 to-transparent blur-2xl -z-10 rounded-[2rem]" />

            <div className="bg-[#060A12]/90 border border-[#38BDF8]/12 rounded-2xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.85)] flex flex-col h-[480px]">
              {/* Window controls */}
              <div className="h-11 border-b border-white/5 flex items-center justify-between px-4 bg-white/[0.01]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/30" />
                </div>
                <div className="text-[9px] font-mono text-[#38BDF8]/60 uppercase tracking-widest px-4 py-1 rounded bg-[#38BDF8]/5 border border-[#38BDF8]/12">
                  GOLDBOOK TERMINAL — ENGINE ACTIVE
                </div>
                <div className="w-12" />
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Mock Sidebar */}
                <div className="w-48 border-r border-white/5 bg-[#060A12]/70 p-3 hidden md:flex flex-col gap-1.5">
                  {[
                    { icon: Activity, label: 'Dashboard', active: true },
                    { icon: BarChart2, label: 'Trade Analytics', active: false },
                    { icon: Bot, label: 'Nirikshan AI Coach', active: false },
                    { icon: Shield, label: 'Discipline Rules', active: false },
                    { icon: Users, label: 'Trading Rooms', active: false },
                  ].map(item => (
                    <div key={item.label} className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer text-[10px] uppercase font-black tracking-widest",
                      item.active ? "bg-[#38BDF8]/8 text-[#38BDF8] border border-[#38BDF8]/15" : "text-[#64748B] hover:text-white/85"
                    )}>
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* Mock Main Console */}
                <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm uppercase font-black tracking-widest text-white">Console Overview</h3>
                      <p className="text-[#64748B] text-[10px] font-mono">Live Sync Connection established with MT5.</p>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase bg-[#34D399]/8 text-[#34D399] px-3 py-1.5 rounded-full border border-[#34D399]/15">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                      SYNC_CONNECTED
                    </div>
                  </div>

                  {/* Metric blocks */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Account Balance', val: '$24,850.50', color: 'text-white' },
                      { label: "Today's P&L", val: '+$530.00', color: 'text-[#34D399]' },
                      { label: 'Rule Violations', val: '0 STRIKES', color: 'text-[#34D399]' },
                      { label: 'Discipline Grade', val: 'A (EXCELLENT)', color: 'text-[#38BDF8]' },
                    ].map((s) => (
                      <div key={s.label} className="bg-gradient-to-b from-[#38BDF8]/3 to-transparent border border-[#1E3A5F]/60 rounded-xl p-4 flex flex-col justify-between">
                        <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">{s.label}</p>
                        <p className={cn("text-sm font-black tracking-wide mt-1.5", s.color)}>{s.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Live trade ticker */}
                  <div className="bg-[#060A12]/80 border border-[#34D399]/12 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-[9px] text-[#34D399] uppercase tracking-widest font-black">Live Sync Stream</p>
                      <span className="text-[9px] font-mono text-[#64748B] bg-white/5 px-2 py-0.5 rounded">Latency: 14ms</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { id: 1, pair: 'XAUUSD', type: 'BUY', size: 1.00, entry: 2345.20, current: 2348.50, profit: 330.00 },
                        { id: 2, pair: 'EURUSD', type: 'SELL', size: 2.00, entry: 1.08250, current: 1.08180, profit: 140.00 },
                        { id: 3, pair: 'GBPUSD', type: 'BUY', size: 1.50, entry: 1.26420, current: 1.26460, profit: 60.00 }
                      ].map(t => (
                        <div key={t.id} className="flex items-center justify-between p-2.5 bg-[#060A12]/50 border border-white/5 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "text-[8px] px-2 py-0.5 rounded font-black tracking-wider",
                              t.type === 'BUY' ? 'bg-[#34D399]/8 text-[#34D399] border border-[#34D399]/15' : 'bg-red-500/8 text-[#F87171] border border-[#F87171]/15'
                            )}>{t.type}</span>
                            <span className="text-xs font-black text-white">{t.pair}</span>
                            <span className="text-[10px] text-[#64748B] font-mono">{t.size.toFixed(2)} Lots</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right hidden sm:block">
                              <span className="text-[8px] text-[#64748B] uppercase block">Entry</span>
                              <span className="text-xs font-mono font-semibold text-white/80">{t.entry.toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[8px] text-[#64748B] uppercase block">Live</span>
                              <span className="text-xs font-mono font-semibold text-white/80">{t.current.toFixed(2)}</span>
                            </div>
                            <div className="w-20 text-right">
                              <span className={cn("text-xs font-black font-mono", t.profit >= 0 ? "text-[#34D399]" : "text-[#F87171]")}>
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
          </HolographicTilt>
        </ScrollReveal>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none select-none">
          <span className="text-[8px] font-mono uppercase tracking-widest text-[#38BDF8]/50">Scroll Terminal</span>
          <motion.div
            className="w-[1.5px] h-10 bg-gradient-to-b from-[#38BDF8] to-transparent origin-top"
            animate={{ scaleY: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — Live MT5 Trade Stream
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="sync-feed" className="relative py-36 overflow-hidden border-b border-[#34D399]/8">
        <div className="absolute inset-0 bg-[#060A12] pointer-events-none -z-20" />
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-[radial-gradient(circle,rgba(52,211,153,0.04)_0%,transparent_70%)] pointer-events-none -z-10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[35vw] h-[35vw] bg-[radial-gradient(circle,rgba(56,189,248,0.03)_0%,transparent_70%)] pointer-events-none -z-10 blur-3xl" />
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.025]"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, #38BDF8 0px, #38BDF8 1px, transparent 1px, transparent 6px)' }}
        />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <ScrollReveal direction="left" delay={0.1}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#34D399]/8 border border-[#34D399]/15 text-[9px] font-black text-[#34D399] uppercase tracking-widest">
                <Zap className="w-3 h-3" /> Live Synchronization
              </div>
            </ScrollReveal>
            <ScrollReveal direction="left" delay={0.2}>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-none text-white">
                Zero Manual Logging. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-[#059669]">
                  Automatic Syncing.
                </span>
              </h2>
            </ScrollReveal>
            <ScrollReveal direction="left" delay={0.3}>
              <p className="text-[#94A3B8] leading-relaxed text-xs sm:text-sm font-medium">
                Stop messing with spreadsheets or manual logs. Simply connect your MT5 investor password. GoldBook securely logs in with read-only authorization and streams every execution directly, evaluating your metrics instantly without interrupting your trading desk.
              </p>
            </ScrollReveal>

            <div className="space-y-4 pt-2">
              {[
                { title: "Universal MT5 Connection", desc: "Connect Exness, IC Markets, Pepperstone, or any MT5 broker server globally." },
                { title: "Read-Only Security Guarantee", desc: "Secure credentials architecture. Your principal capital remains completely untouched." },
                { title: "Sub-Second Live Syncing", desc: "Open positions are tracked, evaluated, and synced with 15ms resolution." }
              ].map((item, idx) => (
                <ScrollReveal key={item.title} direction="left" delay={0.35 + idx * 0.1} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#34D399]/10 border border-[#34D399]/25 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-[#34D399]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5 font-medium">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal direction="left" delay={0.65} className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-[10px] font-black text-[#34D399] uppercase tracking-widest hover:text-white transition-colors cursor-pointer group">
                  Setup Live Sync Account <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </button>
              </Link>
            </ScrollReveal>
          </div>

          {/* Right side trade stream widget */}
          <div className="w-full relative">
            <ParallaxSection speed={0.6}>
              <div className="bg-[#0D1421]/90 border border-[#34D399]/12 rounded-2xl p-5 shadow-[0_30px_60px_rgba(0,0,0,0.7)] backdrop-blur-md relative">
                <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[8px] font-mono text-[#34D399] bg-[#34D399]/8 border border-[#34D399]/15 px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                  LIVE STREAMING
                </div>
                <h3 className="text-[10px] uppercase font-black text-white tracking-widest mb-1">Live MT5 Trade Stream</h3>
                <p className="text-[#64748B] text-[9px] font-mono mb-4">Simulating ticking prices from your MT5 terminal.</p>

                <div className="space-y-3">
                  {[
                    { id: 1, pair: 'XAUUSD', type: 'BUY', size: 1.00, entry: 2345.20, current: 2348.50, profit: 330.00 },
                    { id: 2, pair: 'EURUSD', type: 'SELL', size: 2.00, entry: 1.08250, current: 1.08180, profit: 140.00 },
                    { id: 3, pair: 'GBPUSD', type: 'BUY', size: 1.50, entry: 1.26420, current: 1.26460, profit: 60.00 }
                  ].map(t => (
                    <div key={t.id} className="p-3 bg-gradient-to-b from-[#38BDF8]/3 to-transparent border border-[#1E3A5F]/60 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider relative",
                            t.type === 'BUY' ? 'bg-[#34D399]/8 text-[#34D399] border border-[#34D399]/15' : 'bg-[#F87171]/8 text-[#F87171] border border-[#F87171]/15'
                          )}>
                            <span className="absolute inset-0 rounded bg-inherit opacity-45 animate-ping pointer-events-none" />
                            {t.type}
                          </span>
                          <span className="text-xs font-black text-white font-mono">{t.pair}</span>
                          <span className="text-[9px] font-mono text-[#64748B]">{t.size.toFixed(2)} Lots</span>
                        </div>
                        <div className="flex gap-4 mt-2 font-mono text-[9px] text-[#64748B]">
                          <span>Entry: <span className="text-white/80">{t.entry.toFixed(2)}</span></span>
                          <span>Live: <span className="text-white/80">{t.current.toFixed(2)}</span></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] text-[#64748B] block uppercase tracking-widest font-black">Unrealized P&L</span>
                        <span className={cn("text-xs font-black font-mono", t.profit >= 0 ? "text-[#34D399]" : "text-[#F87171]")}>
                          {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-[#1E3A5F]/60 flex justify-between items-center text-[9px] font-mono text-[#64748B]">
                  <span>Total Trades Active: 3</span>
                  <span className="flex items-center gap-1.5 font-black text-white">
                    Net Open P&L: <span className="text-[#34D399] text-xs font-black">+$530.00</span>
                  </span>
                </div>
              </div>
            </ParallaxSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — Trading Psychology Coach
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="ai-coach" className="relative py-36 overflow-hidden border-b border-[#38BDF8]/8">
        <div className="absolute inset-0 bg-[#060A12] pointer-events-none -z-20" />
        <div className="absolute top-1/3 right-1/4 w-[45vw] h-[45vw] bg-[radial-gradient(circle,rgba(56,189,248,0.04)_0%,transparent_75%)] pointer-events-none -z-10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[35vw] h-[35vw] bg-[radial-gradient(circle,rgba(52,211,153,0.025)_0%,transparent_70%)] pointer-events-none -z-10 blur-3xl" />

        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="flex-1 space-y-6">
            <ScrollReveal direction="right" delay={0.1}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#38BDF8]/8 border border-[#38BDF8]/15 text-[9px] font-black text-[#38BDF8] uppercase tracking-widest">
                <Bot className="w-3 h-3 animate-pulse" /> Cognitive Assistant
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={0.2}>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-none text-white">
                Psychology Coach. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] to-[#0284C7]">
                  Your Behavioral Edge.
                </span>
              </h2>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={0.3}>
              <p className="text-[#94A3B8] leading-relaxed text-xs sm:text-sm font-medium">
                Most traders don't lack edge in strategy—they lack emotional control. Our built-in trading psychology coach is trained to recognize revenge trading patterns, FOMO entries, greed holds, and mental exhaustion. It grades your execution quality on every trade, delivering actionable behavioral feedback to keep you in peak performance.
              </p>
            </ScrollReveal>

            <div className="space-y-4 pt-2">
              {[
                { title: "Revenge trading lockout warning", desc: "Flags frequent re-entries within 15 minutes of a loss to prevent drawdowns." },
                { title: "Psychological profile matrix", desc: "Constructs a personalized profile map based on your logged emotion tags." },
                { title: "Behavioral edge reports", desc: "Pinpoints exactly which emotions lead to profitable executions and which destroy your P&L." }
              ].map((item, idx) => (
                <ScrollReveal key={item.title} direction="right" delay={0.35 + idx * 0.1} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/25 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-[#38BDF8]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5 font-medium">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal direction="right" delay={0.65} className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-[10px] font-black text-[#38BDF8] uppercase tracking-widest hover:text-white transition-colors cursor-pointer group">
                  Consult Psychology Coach <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </button>
              </Link>
            </ScrollReveal>
          </div>

          {/* Cognitive Bias Matrix console */}
          <div className="flex-1 w-full">
            <div className="bg-[#0D1421]/90 border border-[#38BDF8]/12 rounded-2xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.7)] backdrop-blur-md flex flex-col h-[430px]">
              <div className="flex border-b border-[#1E3A5F]/80 bg-white/[0.01] rounded-t-xl overflow-hidden shrink-0">
                <button
                  onClick={() => setAiTab('bias')}
                  className={cn("flex-1 py-3.5 text-[9px] font-black uppercase tracking-widest transition-colors",
                    aiTab === 'bias' ? "bg-white/5 text-[#38BDF8] border-b border-[#38BDF8]" : "text-[#64748B] hover:text-white"
                  )}
                >Cognitive Bias Matrix</button>
                <button
                  onClick={() => setAiTab('emotions')}
                  className={cn("flex-1 py-3.5 text-[9px] font-black uppercase tracking-widest transition-colors",
                    aiTab === 'emotions' ? "bg-white/5 text-[#38BDF8] border-b border-[#38BDF8]" : "text-[#64748B] hover:text-white"
                  )}
                >Emotion Correlations</button>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar">
                {aiTab === 'bias' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
                    {[
                      { name: "Loss Aversion", severity: "CRITICAL", color: "text-[#F87171]", glow: "border-[#F87171]/20 bg-[#F87171]/[0.02]", evidence: "Losing trades held 3.2x longer than wins (avg: 207s vs 64s).", exercise: "Enforce hard 15-minute Time-Stops. If an execution isn't profitable in 15 mins, close at market." },
                      { name: "Revenge Trading", severity: "MODERATE", color: "text-[#38BDF8]", glow: "border-[#38BDF8]/20 bg-[#38BDF8]/[0.02]", evidence: "Lot size spikes 1.8x on trades within 15 min of a closed loss.", exercise: "Cooling period: strict 30-minute cooling lockout automatically enforced on your account." },
                      { name: "Mental Fatigue", severity: "CRITICAL", color: "text-[#F87171]", glow: "border-[#F87171]/20 bg-[#F87171]/[0.02]", evidence: "Expectancy decays 85% after 4+ daily trades (+$120 avg drops to -$143).", exercise: "Daily quota: hard lock after 4 trades. Stop trading completely regardless of outcomes." },
                      { name: "FOMO / Overconfidence", severity: "HEALTHY", color: "text-[#34D399]", glow: "border-[#34D399]/20 bg-[#34D399]/[0.02]", evidence: "Pre-trade checklist compliance rate remains stable at 88%.", exercise: "No critical cognitive bias detected. Continue systematic plan tracking." }
                    ].map(bias => (
                      <div key={bias.name} className={cn("p-3.5 border rounded-xl flex flex-col justify-between transition-all border-white/5", bias.glow)}>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black uppercase text-white tracking-widest">{bias.name}</span>
                            <span className={cn("text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded bg-black/45 border border-white/5 flex items-center gap-1", bias.color)}>
                              <span className={cn("w-1 h-1 rounded-full", bias.severity === 'HEALTHY' ? 'bg-[#34D399]' : bias.severity === 'MODERATE' ? 'bg-[#38BDF8]' : 'bg-[#F87171]')} />
                              {bias.severity}
                            </span>
                          </div>
                          <p className="text-[9px] text-[#94A3B8] leading-normal font-medium mb-1">
                            <span className="text-white/80 font-bold">Evidence:</span> {bias.evidence}
                          </p>
                        </div>
                        <div className="pt-2 mt-2 border-t border-white/5">
                          <p className="text-[9px] text-[#64748B] leading-normal italic">
                            <span className="text-[#38BDF8] not-italic font-black uppercase tracking-widest text-[7px] block mb-0.5">Therapeutic Protocol:</span> &quot;{bias.exercise}&quot;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {aiTab === 'emotions' && (
                  <div className="space-y-3">
                    <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Emotion-to-Performance Correlations</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { emotion: "Confident", trades: 12, wr: 75, pnl: 180.50, compliance: 95, color: "text-[#34D399]", bg: "bg-[#34D399]/[0.02] border-[#34D399]/15" },
                        { emotion: "Greedy", trades: 8, wr: 25, pnl: -240.00, compliance: 35, color: "text-[#F87171]", bg: "bg-[#F87171]/[0.01] border-[#F87171]/15" },
                        { emotion: "Nervous", trades: 6, wr: 50, pnl: -12.50, compliance: 80, color: "text-[#38BDF8]", bg: "bg-[#38BDF8]/[0.02] border-[#38BDF8]/15" },
                        { emotion: "Frustrated", trades: 5, wr: 0, pnl: -410.00, compliance: 10, color: "text-[#F87171]", bg: "bg-[#F87171]/[0.01] border-[#F87171]/15" }
                      ].map(item => (
                        <div key={item.emotion} className={cn("p-3 border border-white/5 rounded-xl flex flex-col justify-between", item.bg)}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-black uppercase text-white tracking-widest">{item.emotion}</span>
                            <span className="text-[8px] font-mono text-[#64748B] bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{item.trades} trades</span>
                          </div>
                          <div className="space-y-1.5 text-[9px] font-mono text-[#94A3B8]">
                            <div className="flex justify-between">
                              <span>Win Rate:</span>
                              <span className={cn("font-bold", item.wr >= 50 ? "text-[#34D399]" : "text-[#F87171]")}>{item.wr}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Average P&L:</span>
                              <span className={cn("font-bold", item.pnl >= 0 ? "text-[#34D399]" : "text-[#F87171]")}>
                                {item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Plan Compliance:</span>
                              <span className="text-[#38BDF8] font-bold">{item.compliance}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — Discipline Safeguards
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="discipline" className="relative py-36 overflow-hidden border-b border-[#34D399]/8">
        <div className="absolute inset-0 bg-[#060A12] pointer-events-none -z-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55vw] h-[55vw] bg-[radial-gradient(circle,rgba(52,211,153,0.03)_0%,rgba(56,189,248,0.02)_40%,transparent_75%)] pointer-events-none -z-10 blur-3xl" />
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(circle, #38BDF8 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 space-y-6">
            <ScrollReveal direction="left" delay={0.1}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#34D399]/8 border border-[#34D399]/15 text-[9px] font-black text-[#34D399] uppercase tracking-widest">
                <Shield className="w-3 h-3" /> Hard Safeguards
              </div>
            </ScrollReveal>
            <ScrollReveal direction="left" delay={0.2}>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-none text-white">
                Strict Rule Framework. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-[#059669]">
                  Enforce Your Limits.
                </span>
              </h2>
            </ScrollReveal>
            <ScrollReveal direction="left" delay={0.3}>
              <p className="text-[#94A3B8] leading-relaxed text-xs sm:text-sm font-medium">
                Define your custom parameters for maximum daily loss, maximum lot size limits, risk-reward ratios, and session restraints. GoldBook continuously calculates risk constraints against your active balance, flashing immediate warnings and logging violations to keep you transparent.
              </p>
            </ScrollReveal>

            <div className="space-y-4 pt-2">
              {[
                { title: "Dynamic balance-based % calculations", desc: "Daily drawdown bounds recalculate automatically relative to your high water mark." },
                { title: "Permanent violation logging system", desc: "Infractions are permanently logged to enforce accountability and remove rule fatigue." },
                { title: "Automated restraint warnings", desc: "Flags aggressive trade executions happening in too short of a timeline." }
              ].map((item, idx) => (
                <ScrollReveal key={item.title} direction="left" delay={0.35 + idx * 0.1} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#34D399]/10 border border-[#34D399]/25 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-[#34D399]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5 font-medium">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal direction="left" delay={0.65} className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-[10px] font-black text-[#34D399] uppercase tracking-widest hover:text-white transition-colors cursor-pointer group">
                  Establish Discipline Board <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </button>
              </Link>
            </ScrollReveal>
          </div>

          {/* Discipline dashboard card */}
          <div className="flex-1 w-full">
            <HolographicTilt>
              <div className="bg-[#0D1421]/90 border border-[#34D399]/12 rounded-2xl p-5 shadow-[0_30px_60px_rgba(0,0,0,0.7)] backdrop-blur-md relative space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-black uppercase text-white tracking-widest">Discipline Dashboard</h3>
                    <p className="text-[#64748B] text-[9px] font-mono">Real-time balance-linked parameter engine.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-[#64748B] block uppercase tracking-widest font-black font-mono">Rule Score</span>
                    <span className="text-xs font-black text-[#34D399]">96% SECURE</span>
                  </div>
                </div>

                {/* Daily Drawdown */}
                <div className="p-4 bg-[#060A12]/40 border border-[#1E3A5F]/60 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#38BDF8]" />
                      <span className="font-black text-white uppercase tracking-widest text-[10px]">Daily Loss Cap</span>
                    </div>
                    <span className="text-[#64748B] text-[10px] font-mono">Loss: <span className="text-white font-bold">$120</span> / limit: <span className="text-[#38BDF8] font-bold">$500</span></span>
                  </div>
                  <LiquidProgress value={24} color="#38BDF8" />
                  <p className="text-[9px] text-[#64748B] leading-none font-medium">Drawdown parameters active. 76% daily capital headroom remaining.</p>
                </div>

                {/* Lot Constraint */}
                <div className="p-4 bg-[#060A12]/40 border border-[#1E3A5F]/60 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#34D399]" />
                      <span className="font-black text-white uppercase tracking-widest text-[10px]">Max Lot Allocation</span>
                    </div>
                    <span className="text-[#64748B] text-[10px] font-mono">Active: <span className="text-white font-bold">1.50 Lots</span> / limit: <span className="text-[#34D399] font-bold">2.00 Lots</span></span>
                  </div>
                  <LiquidProgress value={75} color="#34D399" />
                  <div className="p-2.5 bg-[#34D399]/8 border border-[#34D399]/15 rounded-lg flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#34D399] shrink-0" />
                    <div>
                      <h4 className="text-[9px] font-black text-[#34D399] uppercase tracking-widest">RULE CHECKS COMPLIANT</h4>
                      <p className="text-[9px] text-[#64748B] font-medium">Positions respect active risk allocations. All entries verified.</p>
                    </div>
                  </div>
                </div>
              </div>
            </HolographicTilt>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5 — Visual Analytics
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="analytics" className="relative py-36 overflow-hidden border-b border-[#38BDF8]/8">
        <div className="absolute inset-0 bg-[#060A12] pointer-events-none -z-20" />
        <div className="absolute top-1/3 left-1/4 w-[45vw] h-[45vw] bg-[radial-gradient(circle,rgba(56,189,248,0.035)_0%,rgba(52,211,153,0.02)_50%,transparent_80%)] pointer-events-none -z-10 blur-3xl" />

        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="flex-1 space-y-6">
            <ScrollReveal direction="right" delay={0.1}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#38BDF8]/8 border border-[#38BDF8]/15 text-[9px] font-black text-[#38BDF8] uppercase tracking-widest">
                <BarChart2 className="w-3 h-3" /> Visual Analytics
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={0.2}>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-none text-white">
                Dynamic Analytics. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] to-[#0284C7]">
                  Discover Your Edge.
                </span>
              </h2>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={0.3}>
              <p className="text-[#94A3B8] leading-relaxed text-xs sm:text-sm font-medium">
                Ditch static spreadsheets. GoldBook constructs high-fidelity equity curves, win/loss calendars, session payout mapping, and precise metrics. See immediately which time blocks, assets, and lot-profiles contribute to your growth and which damage your profile.
              </p>
            </ScrollReveal>

            <div className="space-y-4 pt-2">
              {[
                { title: "Dynamic Equity Curve Plotting", desc: "Plots absolute growth progress maps with standard error bounding bands." },
                { title: "Heatmapped calendar logs", desc: "A gorgeous calendar showcasing exact daily gains, losses, and emotion flags." },
                { title: "Advanced statistics indicators", desc: "Computes Sharpe Ratio, Profit Factor, Win/Loss Standard Deviation, and R-multiple." }
              ].map((item, idx) => (
                <ScrollReveal key={item.title} direction="right" delay={0.35 + idx * 0.1} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/25 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-[#38BDF8]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5 font-medium">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal direction="right" delay={0.65} className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-[10px] font-black text-[#38BDF8] uppercase tracking-widest hover:text-white transition-colors cursor-pointer group">
                  Open Analytics Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </button>
              </Link>
            </ScrollReveal>
          </div>

          {/* 3-depth parallax analytics cards */}
          <div className="flex-1 w-full relative h-[400px]">
            <ParallaxSection speed={0.6} className="absolute inset-0 z-0">
              <div className="bg-[#0D1421]/95 border border-[#38BDF8]/10 rounded-2xl p-5 shadow-2xl h-[260px] flex flex-col justify-between">
                <div className="flex justify-between items-center text-[9px] font-mono">
                  <span className="text-[#64748B] uppercase tracking-widest font-black">Net Growth Curve</span>
                  <span className="text-[#34D399] font-bold">+$4,250.00 Overall</span>
                </div>
                <div className="relative h-32 w-full bg-white/[0.01] border border-[#1E3A5F]/60 rounded-xl overflow-hidden flex items-end">
                  <svg className="absolute inset-0 w-full h-full p-2" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2"/>
                        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d="M 0 50 L 10 45 L 20 40 L 30 46 L 40 38 L 50 35 L 60 22 L 70 28 L 80 20 L 90 12 L 100 8 L 100 50 Z" fill="url(#chartGradient)" />
                    <path d="M 0 50 L 10 45 L 20 40 L 30 46 L 40 38 L 50 35 L 60 22 L 70 28 L 80 20 L 90 12 L 100 8" fill="none" stroke="#38BDF8" strokeWidth="1.5" />
                    <circle cx="60" cy="22" r="1.2" fill="#38BDF8" />
                    <circle cx="100" cy="8" r="1.2" fill="#38BDF8" />
                  </svg>
                  <div className="absolute bottom-2 left-2 text-[8px] font-mono text-[#64748B]">May 1</div>
                  <div className="absolute bottom-2 right-2 text-[8px] font-mono text-[#64748B]">May 21</div>
                </div>
              </div>
            </ParallaxSection>

            <ParallaxSection speed={1.0} className="absolute inset-x-4 top-24 z-10">
              <div className="bg-[#0D1421]/98 border border-[#34D399]/10 rounded-2xl p-5 shadow-2xl space-y-3 max-w-sm mx-auto">
                <p className="text-[8px] text-[#64748B] uppercase tracking-widest font-black">Performance Calendar Logs</p>
                <div className="grid grid-cols-5 gap-2.5">
                  {mockCalendarDays.map((d) => (
                    <div
                      key={d.day}
                      onClick={() => setSelectedDay(d.day)}
                      className={cn(
                        "aspect-square rounded-lg flex flex-col justify-center items-center cursor-pointer border transition-all text-[10px] font-mono font-bold",
                        d.win === true ? "bg-[#34D399]/8 border-[#34D399]/15 text-[#34D399]" :
                        d.win === false ? "bg-[#F87171]/8 border-[#F87171]/15 text-[#F87171]" :
                        "bg-white/5 border-white/5 text-[#64748B]",
                        selectedDay === d.day ? "ring-1 ring-[#38BDF8]" : ""
                      )}
                    >
                      <span>{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ParallaxSection>

            <ParallaxSection speed={1.2} className="absolute right-4 top-48 z-20 max-w-[220px]">
              <div className="bg-[#0D1421] border border-[#38BDF8]/12 rounded-2xl p-4 shadow-2xl space-y-3">
                <div className="flex justify-between items-center text-[8px] font-mono">
                  <span className="text-white font-black uppercase tracking-widest">Sharpe Ratio</span>
                  <span className="text-[#38BDF8] font-black">1.92</span>
                </div>
                <div className="flex justify-between items-center text-[8px] font-mono">
                  <span className="text-white font-black uppercase tracking-widest">Profit Factor</span>
                  <span className="text-[#34D399] font-black">2.84</span>
                </div>
              </div>
            </ParallaxSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5.5 — Peer Collaboration
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="community" className="relative py-36 overflow-hidden border-b border-[#34D399]/8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 space-y-6">
            <ScrollReveal direction="left" delay={0.1}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#34D399]/8 border border-[#34D399]/15 text-[9px] font-black text-[#34D399] uppercase tracking-widest">
                <Users className="w-3 h-3" /> Peer Collaboration
              </div>
            </ScrollReveal>
            <ScrollReveal direction="left" delay={0.2}>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-none text-white">
                Shared Rooms. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-[#059669]">
                  Trade in Synchrony.
                </span>
              </h2>
            </ScrollReveal>
            <ScrollReveal direction="left" delay={0.3}>
              <p className="text-[#94A3B8] leading-relaxed text-xs sm:text-sm font-medium">
                Don&apos;t isolate yourself in trading. Join collaborative GoldBook voice rooms where you can discuss live market flows, share trading plans, and broadcast verified executions. Build social accountability structures to stay aligned with your goals.
              </p>
            </ScrollReveal>

            <div className="space-y-4 pt-2">
              {[
                { title: "High-fidelity social voice rooms", desc: "Collaborate instantly on active levels with integrated voice latency controls." },
                { title: "Verified plan broadcasting feed", desc: "Broadcast live plans directly. Peers see verified entry and statistics overlays." },
                { title: "Group accountability checklists", desc: "Establish shared rules. Room participants receive notifications when rules are violated." }
              ].map((item, idx) => (
                <ScrollReveal key={item.title} direction="left" delay={0.35 + idx * 0.1} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#34D399]/10 border border-[#34D399]/25 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-[#34D399]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">{item.title}</h4>
                    <p className="text-[#64748B] text-xs mt-0.5 font-medium">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal direction="left" delay={0.65} className="pt-2">
              <Link href="/auth">
                <button className="flex items-center gap-2 text-[10px] font-black text-[#34D399] uppercase tracking-widest hover:text-white transition-colors cursor-pointer group">
                  Join Peer Ecosystem <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </button>
              </Link>
            </ScrollReveal>
          </div>

          {/* Voice room mockup */}
          <div className="flex-1 w-full">
            <div className="bg-[#0D1421]/90 border border-[#34D399]/12 rounded-2xl p-5 shadow-[0_30px_60px_rgba(0,0,0,0.7)] backdrop-blur-md relative space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-widest">Trading Room Voice</h3>
                  <p className="text-[#64748B] text-[9px] font-mono">Active Room: <span className="text-[#34D399] font-bold">XAUUSD Live Scalpers</span></p>
                </div>
                <div className="px-3.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/5 text-white/80">
                  Room Full
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Yash21', role: 'Host', avatar: 'Y', speaking: true },
                  { name: 'Nirav_Fx', role: 'Trader', avatar: 'N', speaking: false },
                  { name: 'Sara_Trader', role: 'Scalper', avatar: 'S', speaking: false },
                  { name: 'You', role: 'Trader', avatar: 'U', speaking: false }
                ].map(u => (
                  <div
                    key={u.name}
                    className={cn(
                      "p-3 rounded-xl border flex items-center gap-3 transition-all border-white/5",
                      u.speaking ? "bg-[#38BDF8]/5 border-[#38BDF8]/20 shadow-[0_0_12px_rgba(56,189,248,0.08)]" : "bg-white/[0.01]"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs relative",
                      u.speaking ? "bg-[#38BDF8] text-[#060A12]" : "bg-white/10 text-white/80"
                    )}>
                      {u.avatar}
                      {u.speaking && (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#38BDF8] rounded-full border border-[#0D1421] flex items-center justify-center">
                          <Volume2 className="w-2.5 h-2.5 text-[#060A12]" />
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-black text-white/95 block">{u.name}</span>
                      <span className="text-[8px] text-[#64748B] uppercase tracking-widest font-black">{u.role}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Shared live trade card */}
              <div className="bg-[#060A12]/60 border border-[#1E3A5F]/60 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-[8px] font-mono text-[#64748B]">
                  <span className="uppercase tracking-widest font-black text-white/60">Verified Broadcast</span>
                  <span>10 mins ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black uppercase bg-[#34D399]/8 text-[#34D399] px-1.5 py-0.5 rounded border border-[#34D399]/15">LIMIT BUY</span>
                    <span className="text-xs font-black text-white">XAUUSD</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#38BDF8]">Entry: 2342.10</span>
                </div>
                <p className="text-[10px] text-[#94A3B8] leading-relaxed font-semibold italic">
                  &quot;Targeting weekly liquidity boundary. Stop placed below H1 support level (2336.00). Target TP at 2360.00.&quot;
                </p>
                <div className="pt-1.5 flex gap-2">
                  <button className="flex-1 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded-full text-[8px] font-black text-white uppercase tracking-widest cursor-pointer">
                    Copy Strategy Levels
                  </button>
                  <button className="flex-1 py-1.5 bg-[#38BDF8]/8 border border-[#38BDF8]/15 hover:bg-[#38BDF8]/20 transition-colors rounded-full text-[8px] font-black text-[#38BDF8] uppercase tracking-widest cursor-pointer">
                    View Chart Breakdown
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6 — CTA Footer
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-36 px-6 overflow-hidden border-t border-[#38BDF8]/8 bg-[#060A12]">
        <ParticleBackground density={1400} goldColor="#7DD3FC" cyanColor="#38BDF8" />

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <ScrollReveal direction="up" delay={0.1}>
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight uppercase leading-none text-white">
              Remove Rule Fatigue.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] via-[#E2E8F0] to-[#7DD3FC] drop-shadow-[0_0_24px_rgba(56,189,248,0.25)]">
                Acquire Precision Edge.
              </span>
            </h2>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.25}>
            <p className="text-[#94A3B8] text-base max-w-xl mx-auto font-semibold">
              Join the community of systematic retail traders tracking emotion, executing with discipline, and streaming verified trade logs.
            </p>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.4} className="flex justify-center">
            <Link href="/auth">
              <MagneticButton className="group relative px-9 py-4 bg-gradient-to-b from-[#38BDF8] to-[#0284C7] hover:from-[#7DD3FC] hover:to-[#38BDF8] text-[#060A12] font-black uppercase tracking-widest text-xs rounded-full transition-transform hover:scale-105 shadow-[0_0_35px_rgba(56,189,248,0.3)] cursor-pointer overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity duration-300 pointer-events-none" />
                <span className="relative z-10 flex items-center gap-2">
                  Enter The Terminal <ChevronRight className="w-4 h-4" />
                </span>
              </MagneticButton>
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1E3A5F]/60 bg-[#060A12] px-6 py-12 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] uppercase tracking-wider text-[#64748B] font-black">
          <div className="flex items-center gap-2 text-white">
            <GoldBookLogo size={22} className="shadow-[0_0_12px_rgba(56,189,248,0.2)]" />
            <span className="font-extrabold text-xs tracking-wider">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] via-[#7DD3FC] to-[#BAE6FD]">GOLD</span>
              <span className="text-white/90 font-light">BOOK</span>
            </span>
          </div>
          <p>© {new Date().getFullYear()} GoldBook Inc. Free forever. Built by gold traders for disciplined scalpers.</p>
        </div>
      </footer>
    </div>
  )
}
