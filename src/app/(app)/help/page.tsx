'use client'

import { useState } from 'react'
import { HelpCircle, MessageCircle, Book, Mail, Loader2, CheckCircle2, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FAQS = [
  { q: 'How does MT5 sync work?', a: 'You provide your MT5 investor (read-only) password. We connect via MetaTrader5 API and pull your trade history every 30 seconds. We never have access to execute trades.' },
  { q: 'Is my data secure?', a: 'Yes. All data is stored in Supabase with Row Level Security. Only you can access your trades. We use read-only investor passwords — we cannot place or modify orders.' },
  { q: 'How is the AI report generated?', a: 'We compute your real statistics (win rate, profit factor, session performance, day patterns) and send them to Google Gemini 1.5 Flash with a detailed prompt. The AI returns personalized insights.' },
  { q: 'Is GoldBook free?', a: 'Yes! GoldBook is completely free. All features, including advanced automated MT5 syncing, real-time AI behavioral coaching, and visual replay backtesting, are now accessible to all users at no cost.' },
  { q: 'How do I add manual trades?', a: 'Go to the Trades page and click "+ Add Trade". Enter the symbol, direction, entry/exit price, dates, and optional pre-trade checklist. P&L is calculated automatically for XAUUSD.' },
]

export default function HelpPage() {
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('bug')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, category, message })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        setSubject('')
        setMessage('')
      } else {
        alert(data.error || 'Failed to submit support ticket.')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <HelpCircle className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-white uppercase tracking-wider">Help & Support Hub</h1>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0D1421] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors cursor-pointer flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-primary bg-primary/10">
              <Book className="w-5 h-5" />
            </div>
            <p className="font-semibold text-sm text-white">Documentation</p>
            <p className="text-xs text-[#64748B] mt-0.5">Read our full guide</p>
          </div>
        </div>

        <Link href="/feed" className="bg-[#0D1421] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors cursor-pointer flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-[#F59E0B] bg-[#F59E0B]/10">
              <MessageCircle className="w-5 h-5" />
            </div>
            <p className="font-semibold text-sm text-white">Community</p>
            <p className="text-xs text-[#64748B] mt-0.5">Interact with other traders</p>
          </div>
        </Link>

        <button 
          onClick={() => {
            setShowTicketForm(true)
            setSuccess(false)
          }}
          className="bg-[#0D1421] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors text-left cursor-pointer flex flex-col justify-between w-full"
        >
          <div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-[#22C55E] bg-[#22C55E]/10">
              <Mail className="w-5 h-5" />
            </div>
            <p className="font-semibold text-sm text-white">Submit Ticket</p>
            <p className="text-xs text-[#64748B] mt-0.5">Direct agent response</p>
          </div>
        </button>
      </div>

      {/* Support ticket submission form */}
      {showTicketForm && (
        <div className="bg-[#0D1421] border border-[#1E3A5F]/40 p-6 rounded-2xl space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Submit a Support Ticket</h3>
            <button 
              onClick={() => setShowTicketForm(false)}
              className="text-xs text-[#64748B] hover:text-white"
            >
              Cancel
            </button>
          </div>

          {success ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#34D399]/10 border border-[#34D399]/20 flex items-center justify-center text-[#34D399] mx-auto scale-110">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-extrabold text-white">Ticket Submitted Successfully!</h4>
              <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                We have registered your ticket and sent a confirmation email. A support representative will review your request shortly.
              </p>
              <Button 
                onClick={() => setShowTicketForm(false)}
                className="mt-4 bg-[#38BDF8] text-[#060A12] hover:bg-[#7DD3FC]"
              >
                Close Ticket Form
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs text-[#64748B] uppercase tracking-wider">Category</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-[#38BDF8]/40"
                  >
                    <option value="bug" className="bg-[#0D1421]">Bug Report</option>
                    <option value="feature" className="bg-[#0D1421]">Feature Request</option>
                    <option value="account" className="bg-[#0D1421]">Account Access</option>
                    <option value="billing" className="bg-[#0D1421]">Billing / Free Tier</option>
                    <option value="other" className="bg-[#0D1421]">Other Inquiry</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs text-[#64748B] uppercase tracking-wider">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="bg-white/5 border-white/10 h-11"
                    placeholder="Brief summary of the issue..."
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-xs text-[#64748B] uppercase tracking-wider">Message Description</Label>
                <textarea
                  id="message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#38BDF8]/40 min-h-[140px] placeholder-[#64748B]"
                  placeholder="Provide details about what went wrong, your device, browser, etc..."
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-b from-[#38BDF8] to-[#0284C7] hover:from-[#7DD3FC] hover:to-[#38BDF8] text-[#060A12] font-black uppercase tracking-widest text-xs rounded-full transition-transform hover:scale-[1.01] active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting Request...
                  </>
                ) : (
                  <>
                    Submit Ticket <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      )}

      {/* FAQs */}
      <div className="space-y-4">
        <h2 className="font-bold text-lg text-white">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 gap-4">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-[#0D1421] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
              <p className="font-semibold text-sm mb-2 text-[#38BDF8]">{faq.q}</p>
              <p className="text-sm text-[#64748B] leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
