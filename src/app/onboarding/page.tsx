'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronRight, User, Globe, Trophy, UploadCloud, Loader2 } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import GoldBookLogo from '@/components/GoldBookLogo'

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState({
    username: '',
    display_name: '',
    avatar_url: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    country: '',
    experience_level: '',
    forex_pairs: [] as string[]
  })
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) {
          setProfile(p => ({
            ...p,
            username: data.username ?? '',
            display_name: data.display_name ?? '',
            avatar_url: data.avatar_url ?? '',
            timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
            country: data.country ?? ''
          }))
          if (data.onboarding_completed) {
            router.push('/dashboard')
          }
        }
      }
    }
    load()
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok && data.avatarUrl) {
        setProfile(p => ({ ...p, avatar_url: data.avatarUrl }))
        showSuccess('Avatar Updated', 'Your profile picture has been uploaded successfully.')
      } else {
        showError('Upload Failed', data.error || 'Failed to upload profile picture.')
      }
    } catch (err: any) {
      console.error(err)
      showError('Upload Failed', 'An error occurred during upload.')
    } finally {
      setUploadingAvatar(false)
    }
  }

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
    
    // Alphanumeric-only and lowercase validation for username
    const usernameRegex = /^[a-z0-9_]+$/
    const sanitizedUsername = profile.username ? profile.username.toLowerCase().replace(/[^a-z0-9_]/g, '').trim() : ''

    if (!sanitizedUsername) {
      showError('Validation Error', 'Username cannot be blank.')
      setLoading(false)
      return
    }

    if (!usernameRegex.test(sanitizedUsername)) {
      showError('Validation Error', 'Username must contain only lowercase letters, numbers, and underscores.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('profiles').update({
        username: sanitizedUsername,
        display_name: profile.display_name ? profile.display_name.trim() : null,
        avatar_url: profile.avatar_url || null,
        timezone: profile.timezone,
        country: profile.country || null,
        experience_level: profile.experience_level ? profile.experience_level.toLowerCase() : null,
        forex_pairs: profile.forex_pairs,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)
      
      if (!error) {
        showSuccess('Welcome to GoldBook!', 'Your trader profile has been configured successfully.')
        router.push('/dashboard')
      } else {
        console.error(error)
        if (error.code === '23505') {
          showError('Username Taken', 'This username is already claimed. Please choose a different unique username.')
        } else {
          showError('Failed to save profile', error.message)
        }
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#060A12] flex items-center justify-center p-6 text-[#F1F5F9] relative overflow-hidden font-sans">
      {/* 1px Fine Scanlines Texture Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.03]" 
        style={{ 
          backgroundImage: 'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 2px)',
          backgroundSize: '100% 2px'
        }} 
      />

      {/* Global Terminal Grid Background */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.02] z-0"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '45px 45px'
        }}
      />

      {/* Harmonious Ambient Glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60vw] h-[60vw] bg-[radial-gradient(circle,rgba(56,189,248,0.04)_0%,transparent_70%)] pointer-events-none -z-10 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60vw] h-[60vw] bg-[radial-gradient(circle,rgba(125,211,252,0.035)_0%,transparent_70%)] pointer-events-none -z-10 blur-3xl" />

      <div className="w-full max-w-xl bg-[#0D1421]/80 backdrop-blur-xl border border-[#1E3A5F]/50 rounded-3xl p-8 shadow-[0_30px_80px_rgba(0,0,0,0.85)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        
        {/* Glow effect at card top */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#38BDF8]/20 to-transparent" />

        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3">
            <GoldBookLogo size={36} className="shadow-[0_0_20px_rgba(56,189,248,0.2)]" />
            <span className="font-extrabold text-sm tracking-wider uppercase">
              <span className="bg-gradient-to-r from-[#38BDF8] via-[#7DD3FC] to-[#BAE6FD] text-transparent bg-clip-text font-black">GOLD</span>
              <span className="text-white font-light ml-0.5">BOOK</span>
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-black text-center uppercase tracking-wider text-white">Create Trader Identity</h1>
        <p className="text-[#94A3B8] text-center text-xs uppercase tracking-wider font-bold mt-1.5 mb-8">Personalize your observatory workspace</p>

        {/* Stepper Progress bar */}
        <div className="flex items-center justify-center gap-2 mb-8 max-w-xs mx-auto">
          {[1, 2].map(i => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
                step >= i 
                  ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8] shadow-[0_0_10px_rgba(56,189,248,0.2)]' 
                  : 'border-white/10 bg-white/[0.02] text-[#94A3B8]'
              }`}>
                {i}
              </div>
              {i === 1 && <div className={`flex-1 h-[2px] rounded ${step > 1 ? 'bg-[#38BDF8]' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Premium Onboarding Avatar Upload */}
            <div className="flex items-center gap-5 p-4 bg-white/[0.02] border border-white/5 rounded-2xl relative overflow-hidden">
              <div className="relative group">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#38BDF8]/30 group-hover:border-[#38BDF8] transition-all flex items-center justify-center bg-[#060A12] relative shadow-[0_0_15px_rgba(56,189,248,0.05)]">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile picture" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-black text-[#38BDF8]">
                      {profile.display_name?.charAt(0).toUpperCase() || profile.username?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-[#38BDF8] animate-spin" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs text-white font-black uppercase tracking-wider block mb-1">Profile Photo</label>
                <p className="text-[10px] text-[#94A3B8] mb-2 font-medium">Upload custom avatar image (JPG, PNG, WEBP)</p>
                <input 
                  type="file" 
                  id="onboarding-avatar-input" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload} 
                  disabled={uploadingAvatar}
                />
                <button 
                  type="button"
                  onClick={() => document.getElementById('onboarding-avatar-input')?.click()} 
                  disabled={uploadingAvatar}
                  className="px-3.5 py-1.5 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 border border-[#38BDF8]/25 hover:border-[#38BDF8]/50 text-[#38BDF8] rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                >
                  {profile.avatar_url ? 'Change Avatar' : 'Upload Avatar'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">What should we call you?</label>
              <input
                value={profile.display_name}
                onChange={e => setProfile({...profile, display_name: e.target.value})}
                placeholder="Display Name (e.g., Alexander)"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors text-white placeholder:text-[#334155]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Choose a unique username</label>
              <input
                value={profile.username}
                onChange={e => setProfile({...profile, username: e.target.value})}
                placeholder="e.g. scalper_king"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors text-white placeholder:text-[#334155]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Timezone</label>
                <div className="relative">
                  <select
                    value={profile.timezone}
                    onChange={e => setProfile({...profile, timezone: e.target.value})}
                    className="w-full bg-[#0D1421] border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors text-white [color-scheme:dark] appearance-none cursor-pointer"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">EST (New York)</option>
                    <option value="Europe/London">GMT/BST (London)</option>
                    <option value="Asia/Kolkata">IST (India)</option>
                    <option value="Asia/Tokyo">JST (Tokyo)</option>
                    <option value="Australia/Sydney">AEST (Sydney)</option>
                    <option value="Asia/Dubai">GST (Dubai)</option>
                    <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>Local ({Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace('_', ' ')})</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Country</label>
                <div className="relative">
                  <select
                    value={profile.country}
                    onChange={e => setProfile({...profile, country: e.target.value})}
                    className="w-full bg-[#0D1421] border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors text-white [color-scheme:dark] appearance-none cursor-pointer"
                  >
                    <option value="">Select Country</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="India">India</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="Japan">Japan</option>
                    <option value="Singapore">Singapore</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              disabled={!profile.display_name.trim() || !profile.username.trim() || !profile.country || uploadingAvatar}
              onClick={() => setStep(2)}
              className="w-full py-3.5 bg-gradient-to-r from-[#38BDF8] to-[#7DD3FC] hover:opacity-95 text-[#020617] rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-30 mt-6 cursor-pointer shadow-lg shadow-[#38BDF8]/10 flex items-center justify-center gap-2"
            >
              Continue Setup <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
            <div>
              <label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black mb-3 block flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[#38BDF8]" /> What is your primary trading style?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Scalper', 'Intraday', 'Swing'].map(level => (
                  <button
                    key={level}
                    onClick={() => setProfile({...profile, experience_level: level.toLowerCase()})}
                    className={`py-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      profile.experience_level === level.toLowerCase() 
                        ? 'bg-[#38BDF8]/10 border-[#38BDF8] text-[#38BDF8] shadow-[0_0_15px_rgba(56,189,248,0.15)]' 
                        : 'bg-white/[0.02] border-white/5 text-[#94A3B8] hover:text-white hover:border-white/20'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black mb-3 block flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#34D399]" /> Which instruments do you trade?
              </label>
              <div className="flex flex-wrap gap-2.5">
                {['XAUUSD', 'EURUSD', 'GBPUSD', 'US30', 'NAS100', 'BTCUSD'].map(pair => (
                  <button
                    key={pair}
                    onClick={() => togglePair(pair)}
                    className={`px-4 py-2 rounded-full border text-xs font-black transition-all cursor-pointer ${
                      profile.forex_pairs.includes(pair) 
                        ? 'bg-[#34D399]/10 border-[#34D399]/30 text-[#34D399] shadow-[0_0_10px_rgba(52,211,153,0.1)]' 
                        : 'bg-white/[0.02] border-white/5 text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {pair}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer border border-white/5"
              >
                Back
              </button>
              <button
                disabled={!profile.experience_level || loading}
                onClick={handleComplete}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#34D399] hover:bg-[#34D399]/90 text-[#020617] rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40 shadow-lg shadow-[#34D399]/20 cursor-pointer border border-emerald-500/30"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Finalizing...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Complete Observatory Setup</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
