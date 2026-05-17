'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bot, CheckCircle2 } from 'lucide-react'

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState({
    username: '',
    display_name: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    experience_level: '',
    forex_pairs: [] as string[]
  })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data?.onboarding_completed) {
          router.push('/dashboard')
        }
      }
    }
    load()
  }, [])

  const togglePair = (pair: string) => {
    setProfile(p => ({
      ...p,
      forex_pairs: p.forex_pairs.includes(pair) 
        ? p.forex_pairs.filter(x => x !== pair)
        : [...p.forex_pairs, pair]
    }))
  }

  const handleComplete = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({
        username: profile.username,
        display_name: profile.display_name,
        timezone: profile.timezone,
        experience_level: profile.experience_level,
        forex_pairs: profile.forex_pairs,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)
      
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6 text-foreground">
      <div className="w-full max-w-xl bg-[#12121a] border border-white/5 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="text-3xl font-black text-primary">GB</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Welcome to GoldBook</h1>
        <p className="text-[#64748B] text-center mb-8">Let's set up your trader profile to personalize your experience.</p>

        {step === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-1.5 block">What should we call you?</label>
              <input
                value={profile.display_name}
                onChange={e => setProfile({...profile, display_name: e.target.value})}
                placeholder="Display Name (e.g., John Doe)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-1.5 block">Choose a unique username</label>
              <input
                value={profile.username}
                onChange={e => setProfile({...profile, username: e.target.value})}
                placeholder="@username"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-1.5 block">Timezone</label>
              <select
                value={profile.timezone}
                onChange={e => setProfile({...profile, timezone: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-colors"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">EST (New York)</option>
                <option value="Europe/London">BST (London)</option>
                <option value="Asia/Kolkata">IST (India)</option>
                <option value="Asia/Tokyo">JST (Tokyo)</option>
                <option value="Australia/Sydney">AEST (Sydney)</option>
                <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>Local ({Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
              </select>
            </div>
            <button
              disabled={!profile.display_name || !profile.username}
              onClick={() => setStep(2)}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all disabled:opacity-50 mt-6"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
            <div>
              <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-3 block">What is your experience level?</label>
              <div className="grid grid-cols-3 gap-3">
                {['Beginner', 'Intermediate', 'Expert'].map(level => (
                  <button
                    key={level}
                    onClick={() => setProfile({...profile, experience_level: level.toLowerCase()})}
                    className={`py-3 rounded-xl border text-sm font-semibold transition-all ${profile.experience_level === level.toLowerCase() ? 'bg-primary/10 border-primary text-primary' : 'bg-white/5 border-white/10 text-[#64748B] hover:text-white'}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-3 block">Which pairs do you primarily trade?</label>
              <div className="flex flex-wrap gap-2">
                {['XAUUSD', 'EURUSD', 'GBPUSD', 'US30', 'NAS100', 'BTCUSD'].map(pair => (
                  <button
                    key={pair}
                    onClick={() => togglePair(pair)}
                    className={`px-4 py-2 rounded-full border text-xs font-bold transition-all ${profile.forex_pairs.includes(pair) ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]' : 'bg-white/5 border-white/10 text-[#64748B] hover:text-white'}`}
                  >
                    {pair}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all"
              >
                Back
              </button>
              <button
                disabled={!profile.experience_level || loading}
                onClick={handleComplete}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#22C55E] hover:bg-[#22C55E]/90 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-[#22C55E]/20"
              >
                {loading ? 'Saving...' : <><CheckCircle2 className="w-5 h-5" /> Complete Setup</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
