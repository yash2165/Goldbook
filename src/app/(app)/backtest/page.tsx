'use client'

import { FlaskConical, Clock, Rocket } from 'lucide-react'
import Link from 'next/link'

export default function BacktestPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center space-y-8">
      {/* Animated icon */}
      <div className="relative">
        <div className="absolute inset-0 bg-[#F59E0B]/20 blur-[60px] rounded-full animate-pulse" />
        <div className="relative w-28 h-28 rounded-3xl bg-[#0D1421] border border-[#F59E0B]/20 flex items-center justify-center shadow-2xl">
          <FlaskConical className="w-14 h-14 text-[#F59E0B]" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#F59E0B] rounded-full flex items-center justify-center shadow-lg animate-bounce">
          <span className="text-[10px] font-black text-black">BETA</span>
        </div>
      </div>

      <div className="space-y-3 max-w-lg">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Backtesting is <span className="text-[#F59E0B]">Coming Soon</span>
        </h1>
        <p className="text-lg text-[#64748B] leading-relaxed">
          We're building a powerful chart replay engine for XAUUSD. Test your strategies on historical data with precision — candle by candle.
        </p>
      </div>

      {/* Features preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
        {[
          { icon: '📊', title: 'Chart Replay', desc: 'Navigate candle by candle at any speed' },
          { icon: '⚡', title: 'Fast Execution', desc: 'Place virtual Buy/Sell orders instantly' },
          { icon: '📈', title: 'Full Stats', desc: 'Win rate, drawdown, RR analysis' },
        ].map(f => (
          <div key={f.title} className="bg-[#0D1421] border border-white/5 rounded-xl p-4 text-left hover:border-[#F59E0B]/20 transition-colors">
            <div className="text-2xl mb-2">{f.icon}</div>
            <p className="font-semibold text-sm">{f.title}</p>
            <p className="text-xs text-[#64748B] mt-1">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-[#64748B] bg-[#0D1421] px-4 py-2 rounded-full border border-white/5">
          <Clock className="w-4 h-4" />
          Estimated: To be announced soon
        </div>
        <Link href="/dashboard">
          <button className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 rounded-full text-sm font-semibold transition-colors">
            <Rocket className="w-4 h-4" /> Back to Dashboard
          </button>
        </Link>
      </div>
    </div>
  )
}
