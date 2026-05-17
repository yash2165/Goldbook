'use client'

import { motion } from 'framer-motion'
import { ArrowRight, TrendingUp, Bot, Shield, Zap, ChevronRight, BarChart2, BookOpen } from 'lucide-react'
import Link from 'next/link'

const fadeUp = (delay = 0): any => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] },
})

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Gradient orbs */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-[#F59E0B]/8 blur-[100px] rounded-full pointer-events-none" />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-black text-2xl tracking-tight">
            <span className="text-[#F59E0B]">Gold</span>Book
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#64748B]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="text-sm text-[#64748B] hover:text-white transition-colors hidden sm:block">Sign In</Link>
            <Link href="/auth">
              <button className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 rounded-full text-sm font-semibold transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40">
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 relative">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Free Forever · No Credit Card Required
          </motion.div>

          <motion.h1 {...fadeUp(0.08)} className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.05]">
            The Trading Journal <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F59E0B] via-yellow-300 to-[#F59E0B]">
              Built for Gold.
            </span>
          </motion.h1>

          <motion.p {...fadeUp(0.15)} className="text-xl text-[#64748B] max-w-2xl mx-auto leading-relaxed">
            Connect your MT5 account. Sync trades automatically. Get AI coaching that actually understands XAUUSD price action.
          </motion.p>

          <motion.div {...fadeUp(0.22)} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth">
              <button className="group flex items-center gap-3 px-8 py-4 bg-primary hover:bg-primary/90 rounded-2xl text-lg font-bold transition-all shadow-2xl shadow-primary/25 hover:shadow-primary/40 hover:scale-105">
                Start Journaling Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </motion.div>

          <motion.div {...fadeUp(0.28)} className="flex items-center justify-center gap-6 text-sm text-[#64748B]">
            {['✓ No subscription', '✓ MT5 auto-sync', '✓ AI powered'].map(t => (
              <span key={t}>{t}</span>
            ))}
          </motion.div>
        </div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mt-20 max-w-5xl mx-auto relative"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] to-transparent z-10 bottom-0 pointer-events-none" style={{ top: '60%' }} />
          <div className="absolute -inset-1 bg-primary/10 blur-2xl rounded-3xl" />

          <div className="relative bg-[#12121a] border border-white/8 rounded-2xl overflow-hidden shadow-2xl">
            {/* Fake browser chrome */}
            <div className="h-10 bg-[#0d0d14] border-b border-white/5 flex items-center px-4 gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]/50" />
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]/50" />
                <div className="w-3 h-3 rounded-full bg-[#22C55E]/50" />
              </div>
              <div className="flex-1 h-5 bg-white/5 rounded-full max-w-xs mx-auto flex items-center px-3">
                <span className="text-[10px] text-[#334155]">app.goldbook.app/dashboard</span>
              </div>
            </div>

            <div className="flex">
              {/* Fake sidebar */}
              <div className="w-48 bg-[#0d0d14] border-r border-white/5 p-3 space-y-1 hidden sm:block">
                <div className="h-8 bg-white/3 rounded-lg" />
                {['Dashboard', 'Trades', 'Journal', 'Analysis', 'AI Report'].map((n, i) => (
                  <div key={n} className={`h-8 rounded-lg flex items-center px-3 gap-2 ${i === 0 ? 'bg-primary/15' : ''}`}>
                    <div className={`w-3 h-3 rounded ${i === 0 ? 'bg-primary' : 'bg-white/10'}`} />
                    <span className={`text-[11px] font-medium ${i === 0 ? 'text-primary' : 'text-[#334155]'}`}>{n}</span>
                  </div>
                ))}
              </div>

              {/* Fake content */}
              <div className="flex-1 p-5 space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Total P&L', val: '+$1,420', color: 'text-[#22C55E]' },
                    { label: 'Win Rate', val: '68%', color: 'text-white' },
                    { label: 'Profit Factor', val: '2.1', color: 'text-[#22C55E]' },
                    { label: 'Open Trades', val: '3', color: 'text-[#F59E0B]' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#0d0d14] rounded-xl p-3 border border-white/5">
                      <p className="text-[9px] text-[#334155] uppercase tracking-wider">{s.label}</p>
                      <p className={`text-base font-black mt-1 ${s.color}`}>{s.val}</p>
                    </div>
                  ))}
                </div>
                {/* Fake chart */}
                <div className="h-36 bg-[#0d0d14] rounded-xl border border-white/5 overflow-hidden relative">
                  <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="w-full h-full">
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,80 Q40,70 80,60 T160,40 T240,30 T320,20 T400,10" fill="none" stroke="#3B82F6" strokeWidth="2" />
                    <path d="M0,80 Q40,70 80,60 T160,40 T240,30 T320,20 T400,10 L400,100 L0,100Z" fill="url(#g)" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest">Features</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Everything pro traders need.</h2>
            <p className="text-[#64748B] text-lg max-w-xl mx-auto">No spreadsheets. No manual entry. No monthly fees.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: 'MT5 Auto-Sync', desc: 'Connect via read-only investor password. Trades sync every 30 seconds automatically.', color: 'text-primary bg-primary/10' },
              { icon: Bot, title: 'Gemini AI Coach', desc: 'Get personalized insights on your psychology, patterns, and blind spots from Google\'s best AI.', color: 'text-[#F59E0B] bg-[#F59E0B]/10' },
              { icon: BarChart2, title: 'Session Analytics', desc: 'See which session (Asian/London/NY) you perform best in. Optimize your trading hours.', color: 'text-[#8B5CF6] bg-[#8B5CF6]/10' },
              { icon: BookOpen, title: 'Smart Journal', desc: 'Log emotions, setup tags, and pre-trade checklists. Correlate psychology with outcomes.', color: 'text-[#22C55E] bg-[#22C55E]/10' },
              { icon: TrendingUp, title: 'Equity Curve', desc: 'Visualize your cumulative P&L and drawdown. Identify turning points in your performance.', color: 'text-primary bg-primary/10' },
              { icon: Shield, title: 'Read-Only Security', desc: 'We only need your investor password. We can never place or modify orders on your account.', color: 'text-[#EF4444] bg-[#EF4444]/10' },
            ].map(f => (
              <div key={f.title} className="group p-6 bg-[#12121a] border border-white/5 rounded-2xl hover:border-white/15 transition-all hover:-translate-y-1">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-white/5 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">
            Ready to stop losing <br />
            <span className="text-[#F59E0B]">on psychology?</span>
          </h2>
          <p className="text-[#64748B] text-lg">Join gold traders who journal, analyze, and improve — for free.</p>
          <Link href="/auth">
            <button className="px-10 py-4 bg-primary hover:bg-primary/90 rounded-2xl text-lg font-bold transition-all shadow-2xl shadow-primary/25 hover:scale-105 hover:shadow-primary/40">
              Start Free — No Card Needed
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#334155]">
          <div className="font-bold"><span className="text-[#F59E0B]">Gold</span>Book</div>
          <p>© 2025 GoldBook. Free forever. Built for XAUUSD traders.</p>
        </div>
      </footer>
    </div>
  )
}
