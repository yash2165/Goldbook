import { HelpCircle, MessageCircle, Book, Mail } from 'lucide-react'
import Link from 'next/link'

const FAQS = [
  { q: 'How does MT5 sync work?', a: 'You provide your MT5 investor (read-only) password. We connect via MetaTrader5 API and pull your trade history every 30 seconds. We never have access to execute trades.' },
  { q: 'Is my data secure?', a: 'Yes. All data is stored in Supabase with Row Level Security. Only you can access your trades. We use read-only investor passwords — we cannot place or modify orders.' },
  { q: 'How is the AI report generated?', a: 'We compute your real statistics (win rate, profit factor, session performance, day patterns) and send them to Google Gemini 1.5 Flash with a detailed prompt. The AI returns personalized insights.' },
  { q: 'Is GoldBook really free?', a: 'Yes, completely free. No credit card required, no limits, and no hidden subscriptions. GoldBook provides all advanced analytical tools and AI behavior coaching at absolutely no cost.' },
  { q: 'How do I add manual trades?', a: 'Go to the Trades page and click "+ Add Trade". Enter the symbol, direction, entry/exit price, dates, and optional pre-trade checklist. P&L is calculated automatically for XAUUSD.' },
]

export default function HelpPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <HelpCircle className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Help & Support</h1>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Book, title: 'Documentation', desc: 'Read our full guide', color: 'text-primary bg-primary/10' },
          { icon: MessageCircle, title: 'Community', desc: 'Ask other traders', color: 'text-[#F59E0B] bg-[#F59E0B]/10', href: '/community' },
          { icon: Mail, title: 'Contact Us', desc: 'support@goldbook.app', color: 'text-[#22C55E] bg-[#22C55E]/10' },
        ].map(item => (
          <div key={item.title} className="bg-[#0D1421] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors cursor-pointer">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <p className="font-semibold text-sm">{item.title}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* FAQs */}
      <div className="space-y-4">
        <h2 className="font-bold text-lg">Frequently Asked Questions</h2>
        {FAQS.map((faq, i) => (
          <div key={i} className="bg-[#0D1421] border border-white/5 rounded-xl p-5">
            <p className="font-semibold text-sm mb-2 text-foreground">{faq.q}</p>
            <p className="text-sm text-[#64748B] leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
