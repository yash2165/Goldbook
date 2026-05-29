'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle2, ChevronRight, Loader2, ShieldCheck, ShieldAlert, Lock, Info, AlertTriangle,
  Brain, Check, X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { motion } from 'framer-motion'

export default function ConnectPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realBalance, setRealBalance] = useState<number | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const supabase = createClient()

  const [userTier, setUserTier] = useState<'free' | 'paid' | 'pro' | null>(null)
  const [loadingTier, setLoadingTier] = useState(true)
  const [connectedCount, setConnectedCount] = useState<number>(0)

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleRazorpayCheckout = async (tierName: 'paid' | 'pro', amount: number) => {
    const loaded = await loadRazorpayScript()
    if (!loaded) {
      alert('Failed to load Razorpay SDK. Please check your internet connection.')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in to upgrade your plan.')
        return
      }

      const options = {
        key: 'rzp_test_Sv9GJ0OEOAIjVO',
        amount: amount * 100, // Amount in paise
        currency: 'INR',
        name: 'GoldBook',
        description: `Upgrade to ${tierName === 'paid' ? 'The Automated Trader' : 'The Elite Professional'}`,
        image: 'https://goldbook-roan.vercel.app/logo.png',
        handler: async function (response: any) {
          try {
            // Update Supabase profile directly on success
            const { error: dbErr } = await supabase
              .from('profiles')
              .update({ tier: tierName })
              .eq('id', user.id)

            if (dbErr) throw dbErr

            alert(`Payment Successful! Your account has been upgraded to ${tierName === 'paid' ? 'Paid' : 'Pro'} tier.`)
            window.location.reload()
          } catch (err: any) {
            alert('Payment was successful (Payment ID: ' + response.razorpay_payment_id + '), but your profile update failed. Please contact support.')
          }
        },
        prefill: {
          email: user.email || '',
        },
        theme: {
          color: tierName === 'pro' ? '#F59E0B' : '#3B82F6',
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (err: any) {
      console.error(err)
      alert('Error initializing checkout. Please try again.')
    }
  }

  useEffect(() => {
    async function loadUserTierAndAccounts() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('tier')
            .eq('id', user.id)
            .single()
          
          if (data && data.tier) {
            setUserTier(data.tier as any)
          } else {
            setUserTier('free')
          }

          const { count, error } = await supabase
            .from('mt5_accounts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_active', true)
          
          if (!error && count !== null) {
            setConnectedCount(count)
          }
        }
      } catch (err) {
        setUserTier('free')
      } finally {
        setLoadingTier(false)
      }
    }
    loadUserTierAndAccounts()
  }, [])

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

  if (loadingTier) {
    return (
      <div className="p-6 max-w-full mx-auto space-y-6 min-h-[60vh] flex flex-col items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
          <div className="absolute inset-0 rounded-full border border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-[#64748B] text-xs font-mono animate-pulse">Checking credentials & active connections...</p>
      </div>
    )
  }

  if (userTier === 'free') {
    return (
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-12 min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Premium Gating Card */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-30 pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#0D1421] border border-white/5 rounded-3xl p-6 text-center space-y-4 shadow-2xl backdrop-blur-md relative z-10"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] mx-auto shadow-[0_0_20px_rgba(245,159,11,0.15)] animate-pulse">
            <Brain className="w-7 h-7 stroke-[1.5]" />
          </div>
          
          <div className="space-y-1.5">
            <span className="text-[9px] bg-[#F59E0B] text-black font-black uppercase px-2.5 py-0.5 rounded font-mono tracking-wider">
              PREMIUM GATED FEATURE
            </span>
            <h2 className="text-lg font-black text-white uppercase tracking-wider mt-2.5">Real-Time Broker Sync</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Automated MT5 account synchronization is a premium feature. Upgrade your plan below to connect your MetaTrader 5 account and synchronize all your trades in real-time 24/7!
            </p>
          </div>
        </motion.div>

        {/* Stunning 3-Tier Modern Pricing Plans Grid */}
        <div className="w-full space-y-6 relative z-10">
          <div className="text-center space-y-1">
            <h2 className="text-sm font-black uppercase text-white tracking-widest">Select Your Professional Edge</h2>
            <p className="text-xs text-[#64748B]">Unlock automated systems, deep behavioral psychology, and priority cloud execution.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1000px] mx-auto">
            
            {/* Free Plan */}
            <div className="bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#64748B]">Free forever</h3>
                  <h4 className="text-sm font-black text-white">The Accountable Trader</h4>
                  <div className="text-2xl font-black text-white mt-1">$0 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited manual journaling</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Full TradingView charts suite</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Complete stats & metrics grids</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Public community & leaderboards</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No background MT5 auto-sync</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No AI Psychology audits & chat</p>
                </div>
              </div>
              <button disabled className="mt-6 w-full py-3 bg-white/5 text-[#64748B] font-black text-xs uppercase tracking-wider rounded-xl cursor-not-allowed">
                Current Plan
              </button>
            </div>

            {/* Paid Plan */}
            <div className="bg-[#0D1421] border border-[#3B82F6]/10 hover:border-[#3B82F6]/30 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#3B82F6]/5 rounded-full blur-2xl group-hover:bg-[#3B82F6]/10 transition-all pointer-events-none" />
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#3B82F6]">Automated Sync</h3>
                  <h4 className="text-sm font-black text-white font-bold">The Automated Trader</h4>
                  <div className="text-2xl font-black text-white mt-1">$9 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">1 Active MT5 Account Sync</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited active journal history</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Standard analytical drawdowns grid</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Weekly/Monthly static AI reports</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Custom templates & habit logs</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No Conversational AI coaching chat</p>
                </div>
              </div>
              <button 
                onClick={() => handleRazorpayCheckout('paid', 750)} 
                className="mt-6 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-blue-500/10"
              >
                Select Plan
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-[#0D1421] border border-[#F59E0B]/20 hover:border-[#F59E0B]/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B]/10 rounded-full blur-2xl group-hover:bg-[#F59E0B]/15 transition-all pointer-events-none" />
              <div className="absolute -right-12 -top-12 w-24 h-24 bg-[#F59E0B] text-black font-black uppercase text-[8px] flex items-center justify-center rotate-45 tracking-widest pt-12 shadow-lg animate-pulse">
                Ultimate
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#F59E0B]">Nirikshan Pro</h3>
                  <h4 className="text-sm font-black text-white font-bold">The Elite Professional</h4>
                  <div className="text-2xl font-black text-white mt-1">$29 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">Unlimited MT5 Accounts Sync</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">Nirikshan Conversational AI Chat</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> AI Cognitive bias threat heatmaps</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Visual Replay Backtest (Scissors)</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Priority sandbox processing</p>
                </div>
              </div>
              <button 
                onClick={() => handleRazorpayCheckout('pro', 2400)} 
                className="mt-6 w-full py-3 bg-primary hover:bg-primary/95 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-primary/10"
              >
                Select Plan
              </button>
            </div>

          </div>
        </div>
      </div>
    )
  }

  if (userTier === 'paid' && connectedCount >= 1) {
    return (
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-12 min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Premium Gating Card */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-30 pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#0D1421] border border-white/5 rounded-3xl p-6 text-center space-y-4 shadow-2xl backdrop-blur-md relative z-10"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] mx-auto shadow-[0_0_20px_rgba(245,159,11,0.15)] animate-pulse">
            <Brain className="w-7 h-7 stroke-[1.5]" />
          </div>
          
          <div className="space-y-1.5">
            <span className="text-[9px] bg-[#F59E0B] text-black font-black uppercase px-2.5 py-0.5 rounded font-mono tracking-wider">
              CONNECTION LIMIT REACHED
            </span>
            <h2 className="text-lg font-black text-white uppercase tracking-wider mt-2.5">MT5 Sync Limit Reached</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Your current Paid plan supports 1 active MT5 account connection. Upgrade to Pro below to connect and manage multiple brokers and prop-firm challenge accounts simultaneously!
            </p>
          </div>
        </motion.div>

        {/* Stunning 3-Tier Modern Pricing Plans Grid */}
        <div className="w-full space-y-6 relative z-10">
          <div className="text-center space-y-1">
            <h2 className="text-sm font-black uppercase text-white tracking-widest">Select Your Professional Edge</h2>
            <p className="text-xs text-[#64748B]">Unlock automated systems, deep behavioral psychology, and priority cloud execution.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1000px] mx-auto">
            
            {/* Free Plan */}
            <div className="bg-[#0D1421] border border-white/5 hover:border-white/10 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#64748B]">Free forever</h3>
                  <h4 className="text-sm font-black text-white">The Accountable Trader</h4>
                  <div className="text-2xl font-black text-white mt-1">$0 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited manual journaling</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Full TradingView charts suite</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Complete stats & metrics grids</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Public community & leaderboards</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No background MT5 auto-sync</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No AI Psychology audits & chat</p>
                </div>
              </div>
              <button disabled className="mt-6 w-full py-3 bg-white/5 text-[#64748B] font-black text-xs uppercase tracking-wider rounded-xl cursor-not-allowed">
                Standard
              </button>
            </div>

            {/* Paid Plan */}
            <div className="bg-[#0D1421] border border-[#3B82F6]/10 hover:border-[#3B82F6]/30 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#3B82F6]/5 rounded-full blur-2xl group-hover:bg-[#3B82F6]/10 transition-all pointer-events-none" />
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#3B82F6]">Automated Sync</h3>
                  <h4 className="text-sm font-black text-white font-bold">The Automated Trader</h4>
                  <div className="text-2xl font-black text-white mt-1">$9 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">1 Active MT5 Account Sync</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited active journal history</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Standard analytical drawdowns grid</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Weekly/Monthly static AI reports</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Custom templates & habit logs</p>
                  <p className="flex items-center gap-2"><X className="w-4 h-4 text-red-500/60 shrink-0" /> No Conversational AI coaching chat</p>
                </div>
              </div>
              <button disabled className="mt-6 w-full py-3 bg-blue-500/20 text-[#3B82F6] font-black text-xs uppercase tracking-wider rounded-xl cursor-not-allowed">
                Current Plan
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-[#0D1421] border border-[#F59E0B]/20 hover:border-[#F59E0B]/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B]/10 rounded-full blur-2xl group-hover:bg-[#F59E0B]/15 transition-all pointer-events-none" />
              <div className="absolute -right-12 -top-12 w-24 h-24 bg-[#F59E0B] text-black font-black uppercase text-[8px] flex items-center justify-center rotate-45 tracking-widest pt-12 shadow-lg animate-pulse">
                Ultimate
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#F59E0B]">Nirikshan Pro</h3>
                  <h4 className="text-sm font-black text-white font-bold">The Elite Professional</h4>
                  <div className="text-2xl font-black text-white mt-1">$29 <span className="text-xs text-[#64748B] font-bold">/ month</span></div>
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2 text-xs font-semibold text-[#94A3B8]">
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">Unlimited MT5 Accounts Sync</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> <strong className="text-white font-bold">Nirikshan Conversational AI Chat</strong></p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> AI Cognitive bias threat heatmaps</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Visual Replay Backtest (Scissors)</p>
                  <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Priority sandbox processing</p>
                </div>
              </div>
              <button 
                onClick={() => handleRazorpayCheckout('pro', 2400)} 
                className="mt-6 w-full py-3 bg-primary hover:bg-primary/95 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-primary/10"
              >
                Upgrade to Pro
              </button>
            </div>

          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 mt-6 text-[#F1F5F9] pb-24">
      
      {/* Title block */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black uppercase tracking-wider text-white">Connect Broker Account</h1>
        <p className="text-[#94A3B8] text-xs font-black uppercase tracking-wider">Sync your MT5 trades automatically to GoldBook</p>
      </div>

      {/* Progress Steps Tracker */}
      <div className="flex items-center justify-center space-x-2 max-w-md mx-auto">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
              step >= i 
                ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8] shadow-[0_0_10px_rgba(56,189,248,0.2)]' 
                : 'border-white/10 bg-white/[0.02] text-[#94A3B8]'
            }`}>
              {step > i ? <CheckCircle2 className="w-4 h-4 text-[#34D399]" /> : i}
            </div>
            {i < 4 && <div className={`flex-1 h-[2px] mx-2 rounded ${step > i ? 'bg-[#38BDF8]' : 'bg-white/10'}`} />}
          </div>
        ))}
      </div>

      {/* Glassmorphic Panel Wrapper */}
      <div className="w-full bg-[#0D1421]/60 backdrop-blur-xl border border-[#1E3A5F]/50 rounded-3xl p-8 shadow-[0_30px_80px_rgba(0,0,0,0.85)] relative overflow-hidden">
        
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#38BDF8]/20 to-transparent" />

        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-black uppercase tracking-wider text-white">Recommended Broker</h2>
              <p className="text-xs uppercase tracking-wider text-[#94A3B8] font-bold">For the best XAUUSD scaling experience</p>
            </div>

            <div className="flex items-center justify-center p-8 bg-gradient-to-br from-[#38BDF8]/5 via-white/[0.01] to-[#34D399]/5 rounded-2xl border border-white/5 relative overflow-hidden shadow-inner group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#38BDF8]/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#34D399]/5 rounded-full blur-2xl pointer-events-none" />
              <div className="text-5xl font-black bg-gradient-to-r from-[#38BDF8] via-[#FFF] to-[#7DD3FC] text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(56,189,248,0.25)] tracking-wider">
                EXNESS
              </div>
            </div>

            <div className="space-y-6 max-w-xl mx-auto">
              <p className="text-xs text-center text-[#94A3B8] leading-relaxed font-semibold">
                To get started, you need an MT5 Demo or Live account. Make sure you have at least $10,000 starting balance if demo, and XAUUSD is fully tradable.
              </p>
              
              <button 
                className="w-full py-4 bg-gradient-to-r from-[#38BDF8] to-[#7DD3FC] hover:opacity-95 text-[#020617] rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[#38BDF8]/10 flex items-center justify-center gap-2 hover:scale-[1.01]" 
                onClick={() => setStep(2)}
              >
                I have an account <ChevronRight className="w-4 h-4 text-[#020617]" />
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
                  <div className="w-8 h-8 rounded-lg bg-[#34D399]/10 flex items-center justify-center border border-[#34D399]/25 text-[#34D399] shadow-[0_0_10px_rgba(52,211,153,0.05)]">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-[#34D399] uppercase tracking-widest">Investor (Read-Only) Password</h3>
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed pl-11 font-medium">
                  Grants read-only access to view closed trade performance logs. Zero execution privileges or withdrawal rights.
                </p>
                <div className="pl-11 pt-1">
                  <span className="inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#34D399]/10 border border-[#34D399]/20 text-[#34D399]">
                    ✅ 100% SAFE READ-ONLY
                  </span>
                </div>
              </div>
            </div>

            {/* Steps guidelines */}
            <div className="space-y-4 pt-6 border-t border-white/5">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-white">
                <Info className="w-4.5 h-4.5 text-[#38BDF8]" /> Guide: Creating Read-Only Credentials
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-2.5">
                  <span className="px-2 py-0.5 rounded bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[8px] font-black text-[#38BDF8] uppercase tracking-wider">
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
                  <span className="px-2 py-0.5 rounded bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[8px] font-black text-[#38BDF8] uppercase tracking-wider">
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
                className="flex-1 py-3.5 bg-gradient-to-r from-[#38BDF8] to-[#7DD3FC] hover:opacity-95 text-[#020617] font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-[#38BDF8]/10 transition-all hover:scale-[1.01] cursor-pointer" 
                onClick={() => setStep(3)}
              >
                I Have Setup My Investor Password <ChevronRight className="ml-2 w-4 h-4 text-[#020617] inline-block" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-2 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-black uppercase tracking-wider text-white">Credentials & Details</h2>
              <p className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#34D399]" /> Connection is fully encrypted and sandboxed
              </p>
            </div>

            <form onSubmit={handleConnect} className="space-y-5 max-w-md mx-auto">
              <div className="space-y-1.5">
                <label htmlFor="login" className="text-xs font-black text-[#94A3B8] uppercase tracking-wider block">MT5 Login ID</label>
                <input 
                  id="login" 
                  name="login" 
                  required 
                  placeholder="e.g. 84729103" 
                  className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors text-white placeholder:text-[#334155]" 
                />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-xs font-black text-[#94A3B8] uppercase tracking-wider">Investor Password (Read-Only)</label>
                  <span className="text-[8px] text-[#34D399] font-black bg-[#34D399]/10 px-2 py-0.5 rounded border border-[#34D399]/20 uppercase tracking-wider">Secure link</span>
                </div>
                <input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  placeholder="Enter read-only password" 
                  className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors text-white placeholder:text-[#334155]" 
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="server" className="text-xs font-black text-[#94A3B8] uppercase tracking-wider block">Broker MT5 Server Name</label>
                <input 
                  id="server" 
                  name="server" 
                  required 
                  placeholder="e.g. Exness-MT5Real3" 
                  className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors text-white placeholder:text-[#334155]" 
                />
              </div>

              {/* Starting Account Balance Input Field - Note on Auto calculation */}
              <div className="space-y-2 p-4 rounded-xl border border-[#38BDF8]/15 bg-[#38BDF8]/[0.02] shadow-[0_0_15px_rgba(56,189,248,0.02)]">
                <div className="flex justify-between items-center">
                  <label htmlFor="initialBalance" className="text-xs font-black text-[#38BDF8] uppercase tracking-wider">Starting Balance ($)</label>
                  <span className="text-[8px] text-[#38BDF8] font-black border border-[#38BDF8]/20 px-2 py-0.5 rounded uppercase tracking-wider">Auto Detect</span>
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
                  className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors text-white font-mono font-semibold" 
                />
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-[#F87171]/10 border border-[#F87171]/20 text-[#F87171] text-xs leading-relaxed text-center font-semibold">
                  {error}
                </div>
              )}

              {loading && !error && (
                <div className="p-4 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-xs leading-relaxed text-center animate-pulse font-semibold">
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
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#38BDF8] to-[#7DD3FC] hover:opacity-95 text-[#020617] font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer" 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-[#020617] inline-block" /> : 'Connect & Sync'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 4 && (
          <div className="p-8 text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-[#34D399]/10 border border-[#34D399]/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(52,211,153,0.15)]">
              <CheckCircle2 className="w-10 h-10 text-[#34D399]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-wider text-white">Connected Successfully!</h2>
              <p className="text-sm text-[#94A3B8] font-bold uppercase tracking-wider">Your read-only account has been verified.</p>
            </div>
            <div className="bg-[#060A12] border border-white/5 p-5 rounded-2xl inline-block">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-black">Current Balance</p>
              <p className="text-3xl font-black text-[#34D399] mt-1 font-mono">
                {realBalance !== null ? `$${realBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '...'}
              </p>
            </div>
            <p className="text-xs text-[#94A3B8] font-black uppercase tracking-widest animate-pulse mt-8">Redirecting to observatory dashboard...</p>
          </div>
        )}
      </div>
    </div>
  )
}
