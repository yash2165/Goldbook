import Link from 'next/link'
import GoldBookLogo from '@/components/GoldBookLogo'

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-black tracking-tight text-white uppercase">Privacy Policy</h1>
          <p className="text-xs text-[#64748B] font-mono">Last Updated: June 30, 2026</p>

          <section className="space-y-3 pt-4">
            <h2 className="text-lg font-bold text-[#38BDF8]">1. Information We Collect</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              We collect information to provide a better trading experience. This includes:
            </p>
            <ul className="list-disc list-inside text-sm text-[#94A3B8] pl-2 space-y-1.5">
              <li><strong>Account Credentials</strong>: Email address and authentication details managed securely via Supabase Auth.</li>
              <li><strong>Profile Information</strong>: Username, display name, avatar, bio, and trading preferences (timezone, market segment).</li>
              <li><strong>Trading Data</strong>: Trade records, logs, screenshots, checklist options, and notes that you enter manually or sync via MT5.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#38BDF8]">2. How We Use Information</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              We use your trading logs, statistics, and journal entries to compute performance telemetry, track compliance with discipline rules, and generate personalized AI coaching reports. 
            </p>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              We do **not** sell, rent, or monetize your trading data. Your data is protected by Row Level Security (RLS) policies inside Supabase.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#38BDF8]">3. Third-Party Integrations</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Our service relies on secure third-party components to deliver features:
            </p>
            <ul className="list-disc list-inside text-sm text-[#94A3B8] pl-2 space-y-1.5">
              <li><strong>Supabase</strong>: For database storage, file uploads, and session management.</li>
              <li><strong>Google Gemini API</strong>: Used to analyze statistics and journal sentiments to generate AI reports. (For free tier users, queries may be handled by Google in accordance with their developer API privacy policies).</li>
              <li><strong>LiveKit</strong>: Voice chat integration on the community floor.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#38BDF8]">4. Data Control and Portability</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Under GDPR and privacy regulations, you have full control over your data. You can export all your trading logs and personal records from the Settings screen at any time. You can also delete your account permanently, which instantly scrubs all your rows from our database.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#38BDF8]">5. Contact Us</h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              If you have any questions about this Privacy Policy or your data rights, submit a ticket in the Support Hub or contact us at <span className="text-white">support@goldbook.app</span>.
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
