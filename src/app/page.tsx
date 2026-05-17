'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Bot, Shield, Zap, BarChart2, BookOpen, Activity, ChevronRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const fadeUp = (delay = 0): any => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] },
})

function FloatingGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ perspective: '1000px' }}>
      <motion.div 
        animate={{ 
          backgroundPosition: ['0px 0px', '0px 40px'],
        }}
        transition={{ 
          repeat: Infinity, 
          duration: 2, 
          ease: "linear" 
        }}
        className="absolute w-[200%] h-[200%] left-[-50%] top-[-50%] opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #F59E0B 1px, transparent 1px),
            linear-gradient(to bottom, #F59E0B 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          transform: 'rotateX(60deg) translateY(-100px) translateZ(-200px)',
          maskImage: 'linear-gradient(to bottom, transparent 20%, black 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 20%, black 60%, transparent 100%)',
        }}
      />
    </div>
  )
}

export default function LandingPage() {
  const { scrollY } = useScroll()
  const yHero = useTransform(scrollY, [0, 500], [0, 150])
  const opacityHero = useTransform(scrollY, [0, 300], [1, 0])

  return (
    <div className="min-h-screen bg-[#050508] text-[#F1F5F9] overflow-x-hidden selection:bg-[#F59E0B]/30">
      
      {/* Cinematic Lighting */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#F59E0B]/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#3B82F6]/5 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0A0A0F]/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-xl tracking-tight">
            <div className="w-6 h-6 bg-[#F59E0B] rounded-sm flex items-center justify-center transform rotate-45">
              <div className="w-3 h-3 bg-[#0A0A0F] rounded-sm transform -rotate-45" />
            </div>
            <span><span className="text-[#F59E0B]">Gold</span>Book</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#94A3B8]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#engine" className="hover:text-white transition-colors">Intelligence Engine</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth" className="text-sm font-bold text-[#94A3B8] hover:text-white transition-colors hidden sm:block">Log In</Link>
            <Link href="/auth">
              <button className="relative group px-5 py-2 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black rounded-sm font-bold text-sm transition-all overflow-hidden">
                <span className="relative z-10 flex items-center gap-2">
                  Launch Terminal <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-40 pb-32 px-6 overflow-hidden">
        <FloatingGrid />
        
        <motion.div style={{ y: yHero, opacity: opacityHero }} className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
          <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/10 text-xs font-bold text-[#F59E0B] uppercase tracking-widest backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F59E0B]" />
            </span>
            Next-Gen Trading Intelligence
          </motion.div>

          <motion.h1 {...fadeUp(0.1)} className="text-6xl md:text-8xl font-black tracking-tighter leading-[1.05] uppercase">
            Master Your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F59E0B] via-yellow-200 to-[#F59E0B] drop-shadow-[0_0_30px_rgba(245,159,11,0.3)]">
              Psychology.
            </span>
          </motion.h1>

          <motion.p {...fadeUp(0.2)} className="text-xl md:text-2xl text-[#94A3B8] max-w-3xl mx-auto leading-relaxed font-medium">
            Connect MT5. Auto-sync trades. Let our elite AI coach detect your emotional biases, revenge trading patterns, and true statistical edge.
          </motion.p>

          <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4">
            <Link href="/auth">
              <button className="group relative px-8 py-4 bg-white text-black hover:bg-gray-100 rounded-sm text-lg font-black uppercase tracking-widest transition-all hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                <span className="relative z-10 flex items-center gap-3">
                  Start Profiling Free
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                {/* Scanline effect on button */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.1)_50%,transparent_100%)] bg-[length:100%_4px] animate-[scan_2s_linear_infinite] opacity-30" />
              </button>
            </Link>
            <a href="#features" className="px-8 py-4 text-[#94A3B8] hover:text-white font-bold uppercase tracking-widest text-sm transition-colors flex items-center gap-2">
              <Bot className="w-5 h-5" /> View AI Capabilities
            </a>
          </motion.div>
        </motion.div>

        {/* Hero Terminal Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 100, rotateX: 20 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1, delay: 0.5, type: 'spring', bounce: 0.2 }}
          className="mt-24 max-w-6xl mx-auto relative z-20"
          style={{ perspective: 1200 }}
        >
          <div className="absolute -inset-4 bg-gradient-to-b from-[#F59E0B]/20 to-transparent blur-3xl -z-10 rounded-[3rem]" />
          
          <div className="relative bg-[#0A0A0F]/90 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col">
            {/* Terminal Header */}
            <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 bg-white/[0.02]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-white/10" />
                <div className="w-3 h-3 rounded-full bg-white/10" />
                <div className="w-3 h-3 rounded-full bg-white/10" />
              </div>
              <div className="text-[10px] font-mono text-[#64748B] uppercase tracking-widest px-3 py-1 rounded bg-white/5 border border-white/5">
                GoldBook.app — Active
              </div>
              <div className="w-16" /> {/* spacer */}
            </div>

            {/* Terminal Body */}
            <div className="flex">
              {/* Sidebar */}
              <div className="w-16 md:w-56 border-r border-white/5 bg-[#050508]/50 p-3 hidden sm:flex flex-col gap-2">
                {[
                  { icon: Activity, label: 'Dashboard', active: true },
                  { icon: BarChart2, label: 'Trades', active: false },
                  { icon: BookOpen, label: 'Journal', active: false },
                  { icon: Bot, label: 'AI Coach', active: false },
                ].map(item => (
                  <div key={item.label} className={cn("flex items-center gap-3 p-3 rounded-lg transition-colors", item.active ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "text-[#64748B]")}>
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-sm hidden md:block tracking-wide">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Content area */}
              <div className="flex-1 p-6 md:p-8 space-y-6 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px]">
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="text-2xl font-black">Live Assessment</h3>
                    <p className="text-[#64748B] text-sm mt-1">Real-time MT5 Sync Active.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold bg-[#22C55E]/10 text-[#22C55E] px-3 py-1.5 rounded-full border border-[#22C55E]/20">
                    <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                    SYNCED
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Unrealized P&L', val: '+$2,450.00', color: 'text-[#22C55E]' },
                    { label: 'Win Rate', val: '72.4%', color: 'text-white' },
                    { label: 'Revenge Trades', val: '0', color: 'text-white' },
                    { label: 'Overall Grade', val: 'A-', color: 'text-[#F59E0B]' },
                  ].map((s, i) => (
                    <div key={s.label} className="bg-[#0A0A0F] border border-[#1A1A2E] rounded-xl p-4">
                      <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">{s.label}</p>
                      <p className={cn("text-2xl font-black mt-2", s.color)}>{s.val}</p>
                    </div>
                  ))}
                </div>

                {/* AI Snippet */}
                <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-5 flex gap-4">
                  <Bot className="w-6 h-6 text-[#F59E0B] shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-[#F59E0B] uppercase tracking-wider text-xs mb-2">Psychology Alert</h4>
                    <p className="text-sm text-[#94A3B8] leading-relaxed">
                      "You've taken 3 trades within 10 minutes of a losing XAUUSD short. Your heart rate/emotion log indicates <span className="text-white font-bold">FRUSTRATION</span>. Statistically, your win rate drops to 18% in this state. Walk away for 30 minutes."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 border-t border-white/5 relative bg-[#050508]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-sm font-bold text-[#F59E0B] uppercase tracking-widest">The Arsenal</h2>
            <p className="text-4xl md:text-5xl font-black tracking-tighter uppercase">More than a journal.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: 'Real-Time Telemetry', desc: 'Plug in your MT5 Investor password. We stream your trades live, no manual entry required.', color: 'text-[#F59E0B]' },
              { icon: Bot, title: 'Diagnostic AI', desc: 'Not a generic chatbot. A specialized model that grades your discipline, risk management, and execution.', color: 'text-[#3B82F6]' },
              { icon: Shield, title: 'Absolute Security', desc: 'Read-only access. Server-side processing. We analyze your edge without ever touching your funds.', color: 'text-[#22C55E]' },
              { icon: BookOpen, title: 'Psychological Ledger', desc: 'Log emotions before and after trades. Discover if FOMO or overconfidence is destroying your PnL.', color: 'text-[#A855F7]' },
              { icon: Activity, title: 'Rule Enforcement', desc: 'Set hard parameters (max daily loss, max lot size). We track every violation dynamically based on your balance.', color: 'text-[#EF4444]' },
              { icon: BarChart2, title: 'Deep Analytics', desc: 'Heatmaps, session breakdowns, and equity curves. Professional-grade stats for the serious trader.', color: 'text-[#F59E0B]' },
            ].map((f, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                key={f.title} 
                className="group p-8 bg-[#0A0A0F] border border-[#1A1A2E] rounded-2xl hover:border-white/10 transition-all hover:-translate-y-2 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity">
                  <f.icon className="w-32 h-32" />
                </div>
                <f.icon className={cn("w-8 h-8 mb-6", f.color)} />
                <h3 className="font-bold text-xl mb-3 uppercase tracking-wide">{f.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof / Rule Section */}
      <section className="py-32 px-6 border-t border-white/5 bg-[#0A0A0F] overflow-hidden relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#F59E0B]/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10">
          <div className="flex-1 space-y-8">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-[1.1]">
              Discipline isn't optional.<br/>
              <span className="text-[#EF4444]">It's enforced.</span>
            </h2>
            <p className="text-[#94A3B8] text-lg leading-relaxed">
              Define your maximum daily loss percentage, maximum lot sizes, and minimum risk-reward ratios. GoldBook's Nirikshan AI calculates these dynamically against your live account balance. Break a rule? It goes on your permanent record.
            </p>
            <ul className="space-y-4">
              {[
                'Dynamic balance-based % calculations',
                'Revenge trade detection (< 15m intervals)',
                'Automated daily loss lockouts reporting',
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-[#F1F5F9] font-medium">
                  <CheckCircle2 className="w-5 h-5 text-[#F59E0B]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 w-full">
            <div className="bg-[#050508] border border-[#EF4444]/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative">
              <div className="absolute top-0 right-0 px-4 py-1 bg-[#EF4444]/20 text-[#EF4444] text-[10px] font-black uppercase tracking-widest rounded-bl-lg">
                Violation Log
              </div>
              <div className="space-y-4 mt-6">
                {[
                  { rule: 'Daily Loss Limit', val: '-$540.00 (Limit: $500)', time: 'Today, 14:32' },
                  { rule: 'Revenge Trade', val: 'XAUUSD Short within 3m of loss', time: 'Today, 14:35' },
                ].map(v => (
                  <div key={v.rule} className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-[#EF4444] uppercase tracking-wide text-sm">{v.rule}</p>
                      <p className="text-xs text-[#94A3B8] mt-1">{v.val}</p>
                    </div>
                    <span className="text-[10px] text-[#64748B]">{v.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 border-t border-white/5 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none" />
        
        <div className="max-w-3xl mx-auto space-y-10 relative z-10">
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
            Stop Guessing.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F59E0B] via-yellow-200 to-[#F59E0B]">
              Start Knowing.
            </span>
          </h2>
          <p className="text-[#94A3B8] text-xl font-medium">Join the elite faction of traders who treat psychology as a measurable metric.</p>
          <Link href="/auth">
            <button className="group relative px-10 py-5 bg-[#F59E0B] text-black rounded-sm text-xl font-black uppercase tracking-widest transition-all hover:scale-105 shadow-[0_0_40px_rgba(245,159,11,0.3)]">
              <span className="relative z-10 flex items-center gap-3">
                Deploy GoldBook
                <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#050508] px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-[#64748B] font-medium">
          <div className="flex items-center gap-2 font-black text-lg tracking-tight text-white">
            <div className="w-4 h-4 bg-[#F59E0B] rounded-sm flex items-center justify-center transform rotate-45">
              <div className="w-2 h-2 bg-[#0A0A0F] rounded-sm transform -rotate-45" />
            </div>
            <span><span className="text-[#F59E0B]">Gold</span>Book</span>
          </div>
          <p>© {new Date().getFullYear()} GoldBook. Free forever. Built for traders.</p>
        </div>
      </footer>
    </div>
  )
}
