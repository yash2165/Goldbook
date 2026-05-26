'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronRight, Loader2, ShieldCheck, ShieldAlert, Lock, Info, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect } from 'react'

export default function ConnectPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realBalance, setRealBalance] = useState<number | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let channel: RealtimeChannel
    let intervalId: NodeJS.Timeout

    if (accountId) {
      // 1. Supabase Realtime Subscription
      channel = supabase
        .channel(`mt5_account_status`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'mt5_accounts', filter: `id=eq.${accountId}` },
          (payload) => {
            const acc = payload.new
            if (acc.is_verified) {
              setRealBalance(acc.current_balance)
              setStep(4)
              setTimeout(() => {
                router.push('/dashboard')
              }, 3000)
            } else if (acc.is_active === false) {
              setError("Failed to connect. Please check MT5 login/password/server, and ensure your MT5 terminal has the API URL whitelisted (Tools > Options > Expert Advisors > WebRequest).")
              setLoading(false)
              setAccountId(null) // Reset so they can try again
            }
          }
        )
        .subscribe()

      // 2. Polling Fallback (runs every 3 seconds)
      intervalId = setInterval(async () => {
        const { data, error } = await supabase
          .from('mt5_accounts')
          .select('is_verified, current_balance, is_active')
          .eq('id', accountId)
          .single()

        if (!error && data) {
          if (data.is_verified) {
            clearInterval(intervalId)
            setRealBalance(data.current_balance)
            setStep(4)
            setTimeout(() => {
              router.push('/dashboard')
            }, 3000)
          } else if (data.is_active === false) {
            clearInterval(intervalId)
            setError("Failed to connect. Please check MT5 login/password/server, and ensure your MT5 terminal has the API URL whitelisted (Tools > Options > Expert Advisors > WebRequest).")
            setLoading(false)
            setAccountId(null)
          }
        }
      }, 3000)
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (intervalId) clearInterval(intervalId)
    }
  }, [accountId, router, supabase])

  const handleConnect = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const login = formData.get('login') as string
    const password = formData.get('password') as string
    const server = formData.get('server') as string
    const initialBalance = parseFloat(formData.get('initialBalance') as string || '10000')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const mt5Login = Number.parseInt(login, 10)
      if (!Number.isFinite(mt5Login)) throw new Error('Invalid MT5 login number')

      const { data: existing, error: existingError } = await supabase
        .from('mt5_accounts')
        .select('id, is_verified, is_active')
        .eq('user_id', user.id)
        .eq('mt5_login', mt5Login)
        .maybeSingle()

      if (existingError) throw existingError

      if (existing && existing.is_verified && existing.is_active) {
        throw new Error('This MT5 account is already connected.')
      }

      if (existing) {
        const { data, error } = await supabase
          .from('mt5_accounts')
          .update({
            investor_password: password,
            broker_server: server,
            is_verified: false,
            is_active: true,
            sync_token: crypto.randomUUID(),
            initial_balance: initialBalance,
            current_balance: initialBalance,
            current_equity: initialBalance,
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        setAccountId(data.id)
      } else {
        const { data, error } = await supabase
          .from('mt5_accounts')
          .insert({
            user_id: user.id,
            mt5_login: mt5Login,
            investor_password: password,
            broker_server: server,
            is_verified: false,
            is_active: true,
            sync_token: crypto.randomUUID(),
            initial_balance: initialBalance,
            current_balance: initialBalance,
            current_equity: initialBalance,
          })
          .select()
          .single()

        if (error) throw error
        setAccountId(data.id)
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 mt-6 text-[#F1F5F9] pb-24">
      
      {/* Title block */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black uppercase tracking-wider text-white">Connect Broker Account</h1>
        <p className="text-[#64748B] text-xs font-black uppercase tracking-wider">Sync your MT5 trades automatically to GoldBook</p>
      </div>

      {/* Progress Steps Tracker */}
      <div className="flex items-center justify-center space-x-2 max-w-md mx-auto">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
              step >= i 
                ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]' 
                : 'border-white/10 bg-white/[0.02] text-[#64748B]'
            }`}>
              {step > i ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> : i}
            </div>
            {i < 4 && <div className={`flex-1 h-[2px] mx-2 rounded ${step > i ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />}
          </div>
        ))}
      </div>

      {/* Glassmorphic Panel Wrapper */}
      <div className="w-full bg-[#12121a]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-[0_30px_80px_rgba(0,0,0,0.85)] relative overflow-hidden">
        
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent" />

        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-black uppercase tracking-wider text-white">Recommended Broker</h2>
              <p className="text-xs uppercase tracking-wider text-[#64748B] font-bold">For the best XAUUSD scaling experience</p>
            </div>

            <div className="flex items-center justify-center p-8 bg-gradient-to-br from-[#D4AF37]/5 via-white/[0.01] to-[#00D4AA]/5 rounded-2xl border border-white/5 relative overflow-hidden shadow-inner group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#00D4AA]/5 rounded-full blur-2xl pointer-events-none" />
              <div className="text-5xl font-black bg-gradient-to-r from-[#D4AF37] via-[#FFF] to-[#FFD700] text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(212,175,55,0.25)] tracking-wider">
                EXNESS
              </div>
            </div>

            <div className="space-y-6 max-w-xl mx-auto">
              <p className="text-xs text-center text-[#94A3B8] leading-relaxed font-semibold">
                To get started, you need an MT5 Demo or Live account. Make sure you have at least $10,000 starting balance if demo, and XAUUSD is fully tradable.
              </p>
              
              <button 
                className="w-full py-4 bg-gradient-to-b from-[#D4AF37] to-[#B8860B] hover:opacity-95 text-black rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[#D4AF37]/10 flex items-center justify-center gap-2 hover:scale-[1.01]" 
                onClick={() => setStep(2)}
              >
                I have an account <ChevronRight className="w-4 h-4 text-black" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-3">
              <span className="px-3 py-1.5 rounded-full text-[9px] font-black bg-red-500/10 text-red-400 border border-red-500/25 uppercase tracking-widest animate-pulse">
                ⚠️ Critical Security Protocol
              </span>
              <h2 className="text-2xl font-black text-white uppercase tracking-wider mt-2">
                Investor Password Required
              </h2>
              <p className="text-[#94A3B8] text-xs max-w-xl mx-auto leading-relaxed font-medium">
                GoldBook operates on a strictly **Read-Only** architecture. We only read historical closed trade logs. For absolute safety, you must provide your **Investor Password**, not your master trading credentials.
              </p>
            </div>

            {/* Red alert banner */}
            <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/[0.02] relative overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.05)]">
              <div className="absolute top-0 right-0 p-3 opacity-[0.03]">
                <Lock className="w-24 h-24 text-red-500" />
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/35 flex items-center justify-center shrink-0 text-red-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-red-400 uppercase tracking-widest">CRITICAL SAFETY INSTRUCTION</h4>
                  <p className="text-[11px] text-red-200/80 leading-relaxed font-medium">
                    **NEVER enter your Master (Main) Password** on GoldBook or any other third-party platform. Your Master Password grants absolute control to execute trades, place orders, and withdraw funds. GoldBook will **NEVER** request it. Only use your **Investor (Read-Only) Password**.
                  </p>
                </div>
              </div>
            </div>

            {/* Side-by-Side Comparison cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-red-500/10 bg-red-500/[0.01] p-5 rounded-2xl space-y-3 relative overflow-hidden">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/25 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.05)]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-red-400 uppercase tracking-widest">Master (Main) Password</h3>
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed pl-11 font-medium">
                  Grants full authority to execute trades, modify active risk allocations, and withdraw funds.
                </p>
                <div className="pl-11 pt-1">
                  <span className="inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                    ❌ DO NOT ENTER
                  </span>
                </div>
              </div>

              <div className="border border-emerald-500/15 bg-emerald-500/[0.01] p-5 rounded-2xl space-y-3 relative overflow-hidden">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/25 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">Investor (Read-Only) Password</h3>
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed pl-11 font-medium">
                  Grants read-only access to view closed trade performance logs. Zero execution privileges or withdrawal rights.
                </p>
                <div className="pl-11 pt-1">
                  <span className="inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    ✅ 100% SAFE READ-ONLY
                  </span>
                </div>
              </div>
            </div>

            {/* Steps guidelines */}
            <div className="space-y-4 pt-6 border-t border-white/5">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-white">
                <Info className="w-4.5 h-4.5 text-amber-400" /> Guide: Creating Read-Only Credentials
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-2.5">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[8px] font-black text-amber-400 uppercase tracking-wider">
                    Method A: MT5 Desktop
                  </span>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Via Desktop Terminal</h4>
                  <ol className="list-decimal pl-4 text-xs text-[#94A3B8] space-y-2 leading-relaxed font-semibold">
                    <li>Launch **MetaTrader 5** on your computer.</li>
                    <li>Go to **Tools &gt; Options** in the top menu.</li>
                    <li>In the **Server** tab, click **Change Password**.</li>
                    <li>Choose **"Change investor (read-only) password"**.</li>
                    <li>Provide Master password and set the new **Investor Password**.</li>
                  </ol>
                </div>

                <div className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-2.5">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[8px] font-black text-amber-400 uppercase tracking-wider">
                    Method B: Broker Web Console
                  </span>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Via Exness Personal Area</h4>
                  <ol className="list-decimal pl-4 text-xs text-[#94A3B8] space-y-2 leading-relaxed font-semibold">
                    <li>Log in to your Exness/Broker Personal Area.</li>
                    <li>Locate your MT5 active accounts list under **My Accounts**.</li>
                    <li>Click the **Settings (Gear icon)** next to the target account.</li>
                    <li>Choose **Change Read-Only / Investor Password** in the menu.</li>
                    <li>Configure your read-only Investor Password and save.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-white border border-white/5 rounded-xl font-black text-xs uppercase tracking-widest transition-colors cursor-pointer" 
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button 
                className="flex-1 py-3.5 bg-gradient-to-r from-amber-600 to-amber-400 hover:opacity-95 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/10 transition-all hover:scale-[1.01] cursor-pointer" 
                onClick={() => setStep(3)}
              >
                I Have Setup My Investor Password <ChevronRight className="ml-2 w-4 h-4 text-black inline-block" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-2 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-black uppercase tracking-wider text-white">Credentials & Details</h2>
              <p className="text-xs text-[#64748B] font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Connection is fully encrypted and sandboxed
              </p>
            </div>

            <form onSubmit={handleConnect} className="space-y-5 max-w-md mx-auto">
              <div className="space-y-1.5">
                <label htmlFor="login" className="text-xs font-black text-[#64748B] uppercase tracking-wider block">MT5 Login ID</label>
                <input 
                  id="login" 
                  name="login" 
                  required 
                  placeholder="e.g. 84729103" 
                  className="w-full bg-[#050508] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-white placeholder:text-[#334155]" 
                />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-xs font-black text-[#64748B] uppercase tracking-wider">Investor Password (Read-Only)</label>
                  <span className="text-[8px] text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">Secure link</span>
                </div>
                <input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  placeholder="Enter read-only password" 
                  className="w-full bg-[#050508] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-white placeholder:text-[#334155]" 
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="server" className="text-xs font-black text-[#64748B] uppercase tracking-wider block">Broker MT5 Server Name</label>
                <input 
                  id="server" 
                  name="server" 
                  required 
                  placeholder="e.g. Exness-MT5Real3" 
                  className="w-full bg-[#050508] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-white placeholder:text-[#334155]" 
                />
              </div>

              {/* Starting Account Balance Input Field - Note on Auto calculation */}
              <div className="space-y-2 p-4 rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.02] shadow-[0_0_15px_rgba(245,158,11,0.02)]">
                <div className="flex justify-between items-center">
                  <label htmlFor="initialBalance" className="text-xs font-black text-[#D4AF37] uppercase tracking-wider">Starting Balance ($)</label>
                  <span className="text-[8px] text-[#D4AF37] font-black border border-[#D4AF37]/20 px-2 py-0.5 rounded uppercase tracking-wider">Auto Detect</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal mb-1 font-medium">
                  We will automatically verify your original deposit history from MT5. This entered value is strictly a fallback in case history logs are missing.
                </p>
                <input 
                  id="initialBalance" 
                  name="initialBalance" 
                  type="number" 
                  step="0.01" 
                  min="1" 
                  required 
                  defaultValue="10000"
                  placeholder="e.g. 10000.00" 
                  className="w-full bg-[#050508] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-white font-mono font-semibold" 
                />
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed text-center font-semibold">
                  {error}
                </div>
              )}

              {loading && !error && (
                <div className="p-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-xs leading-relaxed text-center animate-pulse font-semibold">
                  Establishing secure tunnel and verifying read-only credentials with broker...
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-xs uppercase tracking-widest border border-white/5 transition-colors cursor-pointer" 
                  onClick={() => setStep(2)} 
                  disabled={loading}
                >
                  Back
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:opacity-95 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer" 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-black inline-block" /> : 'Connect & Sync'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 4 && (
          <div className="p-8 text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-wider text-white">Connected Successfully!</h2>
              <p className="text-sm text-[#64748B] font-bold uppercase tracking-wider">Your read-only account has been verified.</p>
            </div>
            <div className="bg-[#050508] border border-white/5 p-5 rounded-2xl inline-block">
              <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Current Balance</p>
              <p className="text-3xl font-black text-emerald-400 mt-1 font-mono">
                {realBalance !== null ? `$${realBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '...'}
              </p>
            </div>
            <p className="text-xs text-[#64748B] font-black uppercase tracking-widest animate-pulse mt-8">Redirecting to observatory dashboard...</p>
          </div>
        )}
      </div>
    </div>
  )
}
