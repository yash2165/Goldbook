import Link from 'next/link'
import GoldBookLogo from '@/components/GoldBookLogo'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#060A12] text-white px-6 py-16 font-sans">
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
        <header className="flex justify-between items-center border-b border-white/5 pb-6">
          <Link href="/" className="flex items-center gap-2 text-white">
            <GoldBookLogo size={28} className="shadow-[0_0_12px_rgba(56,189,248,0.2)]" />
            <span className="font-extrabold text-sm tracking-wider uppercase">
              <span className="bg-gradient-to-r from-[#38BDF8] via-[#7DD3FC] to-[#BAE6FD] text-transparent bg-clip-text font-black">GOLD</span>
              <span className="text-white font-light tracking-wide ml-0.5">BOOK</span>
            </span>
          </Link>
          <Link href="/auth" className="text-xs font-bold text-[#38BDF8] hover:text-white uppercase tracking-wider transition-colors">
            Enter App
          </Link>
        </header>

        <main className="space-y-6">
          <h1 className="text-3xl font-black tracking-tight text-white uppercase">Terms of Service</h1>
          <p className="text-xs text-[#64748B] font-mono">Last Updated: June 30, 2026</p>

          <section className="space-y-3 pt-4">
            <h2 className="text-lg font-bold text-[#38BDF8]">1. Acceptance of Terms</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              By creating an account on Goldbook or using the platform, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, you must not access or use the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#38BDF8]">2. No Financial Advice Disclaimer</h2>
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs leading-relaxed space-y-2">
              <p className="font-black uppercase tracking-wider">⚠️ IMPORTANT DISCLAIMER:</p>
              <p>
                Goldbook is a trading journal, statistics logger, and psychological analysis tool. **We do not provide investment advice, financial planning, trading execution services, or recommendation signals.**
              </p>
              <p>
                All trading involves high risk. Any decisions you make to buy, sell, or hold financial assets (including stocks, options, futures, forex, or crypto) are solely your responsibility. Past performance is not indicative of future results.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#38BDF8]">3. Account Registration & MetaTrader5 Credentials</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              You are responsible for safeguarding your credentials. If you choose to connect your broker account using our MT5 sync module, you must **only** provide your **investor (read-only) password**. You must **never** input your master execution password. Goldbook is not responsible for any issues arising from the misuse of execution keys.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#38BDF8]">4. Acceptable Social & Community Behavior</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              When participating in our feed, direct messaging, or community floor, you agree not to:
            </p>
            <ul className="list-disc list-inside text-sm text-[#94A3B8] pl-2 space-y-1.5">
              <li>Harass, abuse, threat, or defame other traders.</li>
              <li>Spam referral links, advertise paid services/courses, or distribute malicious files.</li>
              <li>Impersonate other traders or verify fake trading metrics.</li>
            </ul>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              We reserve the right to suspend or terminate accounts that breach community rules.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#38BDF8]">5. Modifications to the Service</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Goldbook is currently free and undergoing active improvements. We reserve the right to modify, suspend, or discontinue any feature, tool, or database sync pipeline at any time without notice.
            </p>
          </section>
        </main>

        <footer className="border-t border-white/5 pt-6 text-center text-[10px] text-[#64748B] uppercase tracking-wider">
          <p>© {new Date().getFullYear()} GoldBook Inc. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}
