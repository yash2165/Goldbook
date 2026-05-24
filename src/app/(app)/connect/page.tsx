'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, ChevronRight, Loader2, ShieldCheck, ShieldAlert, Lock, Info } from 'lucide-react'
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
              // Worker marked it as inactive due to login failure
              setError("Failed to connect. Please check MT5 login/password/server, and ensure your MT5 terminal has the API URL whitelisted (Tools > Options > Expert Advisors > WebRequest).")
              setLoading(false)
              setAccountId(null) // Reset so they can try again
            }
          }
        )
        .subscribe()

      // 2. Polling Fallback (runs every 3 seconds in case Realtime replication is disabled)
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

      // If an account already exists for this login, allow retry by updating it.
      // This avoids getting stuck behind the UNIQUE(user_id, mt5_login) constraint.
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
      // Step 3 shows loading automatically now because loading=true
      // We do not setStep(4) until real-time update says it is verified.
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8 mt-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Connect Your Account</h1>
        <p className="text-muted-foreground text-lg">Sync your MT5 trades automatically to GoldBook</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center space-x-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
              step >= i ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'
            }`}>
              {step > i ? <CheckCircle2 className="w-4 h-4" /> : i}
            </div>
            {i < 4 && <div className={`w-12 h-1 ${step > i ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      <Card className="border-border shadow-2xl">
        {step === 1 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Recommended Broker</h2>
              <p className="text-muted-foreground">For the best XAUUSD trading experience</p>
            </div>
            <div className="flex items-center justify-center p-6 bg-background rounded-xl border border-border">
              <div className="text-4xl font-bold text-gold">EXNESS</div>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-center">To get started, you need an MT5 Demo or Live account. Make sure you have at least $10,000 starting balance if demo, and XAUUSD is tradable.</p>
              <Button className="w-full h-12 text-lg" onClick={() => setStep(2)}>
                I have an account <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center space-y-3">
              <span className="px-3 py-1.5 rounded-full text-xs font-black bg-red-500/10 text-red-400 border border-red-500/25 uppercase tracking-widest animate-pulse">
                ⚠️ Critical Security Protocol
              </span>
              <h2 className="text-3xl font-extrabold text-white tracking-tight mt-2 flex items-center justify-center gap-2">
                Investor Password Required
              </h2>
              <p className="text-[#94A3B8] text-sm max-w-xl mx-auto leading-relaxed">
                GoldBook operates on a strictly <strong>Read-Only</strong> architecture. We only read your historical trade logs. For absolute security, you must provide your <strong>Investor Password</strong>, not your Master password.
              </p>
            </div>

            {/* Red alert for Master Password protection */}
            <div className="p-5 rounded-2xl border border-red-500/30 bg-red-500/5 relative overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.05)]">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Lock className="w-24 h-24 text-red-500" />
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 text-red-400">
                  <ShieldAlert className="w-5 h-5 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-red-400 uppercase tracking-widest">CRITICAL SAFETY ALERT</h4>
                  <p className="text-xs text-red-200/80 leading-relaxed">
                    <strong>NEVER share or type your Master (Main) Password</strong> on GoldBook or any other third-party platform. Your Master Password grants absolute control to execute trades and withdraw funds. GoldBook will <strong>NEVER</strong> request it. Only use your <strong>Investor (Read-Only) Password</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-red-500/20 bg-red-500/[0.01] p-5 rounded-2xl space-y-4 relative overflow-hidden group hover:border-red-500/35 transition-all shadow-[0_0_20px_rgba(239,68,68,0.01)]">
                <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-red-500/[0.05] rounded-full blur-2xl pointer-events-none" />
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-red-400 uppercase tracking-wider">Master (Main) Password</h3>
                </div>
                <div className="space-y-3 pl-11">
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Grants full authority to execute trades, place pending orders, modify risk settings, and request withdrawals from your broker account.
                  </p>
                  <span className="inline-flex text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                    ❌ DO NOT ENTER THIS
                  </span>
                </div>
              </div>

              <div className="border border-emerald-500/25 bg-emerald-500/[0.01] p-5 rounded-2xl space-y-4 relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-[0_0_20px_rgba(16,185,129,0.02)]">
                <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-emerald-500/[0.05] rounded-full blur-2xl pointer-events-none" />
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider">Investor (Read-Only) Password</h3>
                </div>
                <div className="space-y-3 pl-11">
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    Grants strictly read-only access to view historical closed performance logs. Absolute zero execution privileges or fund withdraw rights.
                  </p>
                  <span className="inline-flex text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    ✅ 100% SAFE READ-ONLY ACCESS
                  </span>
                </div>
              </div>
            </div>

            {/* Setup Guides */}
            <div className="space-y-4 pt-6 border-t border-white/5">
              <h3 className="text-base font-extrabold flex items-center gap-2 text-white">
                <Info className="w-4.5 h-4.5 text-amber-400" /> Guide: Setting Up Read-Only Credentials
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-[#09090F] border border-white/5 p-5 rounded-2xl space-y-3 hover:border-white/10 transition-all">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[10px] font-black text-amber-400 uppercase tracking-wider">
                    Method A
                  </span>
                  <h4 className="text-sm font-bold text-white tracking-wide">Inside MT5 Desktop Terminal</h4>
                  <ol className="list-decimal pl-4 text-xs text-[#94A3B8] space-y-2.5 leading-relaxed">
                    <li>Launch **MetaTrader 5** on your computer.</li>
                    <li>Go to **Tools &gt; Options** in the top menu.</li>
                    <li>Select the **Server** tab, click **Change Password**.</li>
                    <li>Choose **"Change investor (read-only) password"**.</li>
                    <li>Provide your current Master password, then type and confirm your new **Investor Password**.</li>
                  </ol>
                </div>

                <div className="bg-[#09090F] border border-white/5 p-5 rounded-2xl space-y-3 hover:border-white/10 transition-all">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[10px] font-black text-amber-400 uppercase tracking-wider">
                    Method B
                  </span>
                  <h4 className="text-sm font-bold text-white tracking-wide">Broker Personal Area (Exness, etc.)</h4>
                  <ol className="list-decimal pl-4 text-xs text-[#94A3B8] space-y-2.5 leading-relaxed">
                    <li>Log in to your broker console (e.g. **Exness Personal Area**).</li>
                    <li>Open your MT5 active accounts list under **My Accounts**.</li>
                    <li>Click the **Settings (Gear icon)** next to the target account.</li>
                    <li>Choose **Change Read-Only / Investor Password** in the menu.</li>
                    <li>Set your read-only Investor Password and save the changes.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button variant="outline" className="flex-1 h-12 border-white/5 hover:bg-white/5 text-[#94A3B8]" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button 
                className="flex-1 h-12 bg-gradient-to-r from-amber-600 to-amber-400 hover:opacity-95 text-black font-extrabold rounded-xl shadow-lg shadow-amber-500/10 transition-all hover:scale-[1.01]" 
                onClick={() => setStep(3)}
              >
                I Have Setup My Investor Password <ChevronRight className="ml-2 w-4 h-4 text-black" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Enter Account Connection Details</h2>
              <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Connection is fully encrypted and sandboxed
              </p>
            </div>

            <form onSubmit={handleConnect} className="space-y-5 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="login" className="text-xs font-bold text-slate-300 uppercase tracking-wider">MT5 Login ID</Label>
                <Input id="login" name="login" required placeholder="e.g. 84729103" className="h-12 bg-[#09090F] border-[#1A1A2E] text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-bold text-slate-300 uppercase tracking-wider">Investor Password (Read-Only)</Label>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">Highly Secure</span>
                </div>
                <Input id="password" name="password" type="password" required placeholder="Enter read-only password" className="h-12 bg-[#09090F] border-[#1A1A2E] text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="server" className="text-xs font-bold text-slate-300 uppercase tracking-wider">Broker MT5 Server Name</Label>
                <Input id="server" name="server" required placeholder="e.g. Exness-MT5Real3" className="h-12 bg-[#09090F] border-[#1A1A2E] text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30" />
              </div>

              {/* Starting Account Balance Input Field */}
              <div className="space-y-2 p-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.02] shadow-[0_0_15px_rgba(245,158,11,0.02)]">
                <div className="flex justify-between items-center">
                  <Label htmlFor="initialBalance" className="text-xs font-bold text-amber-400 uppercase tracking-wider">Starting Account Balance ($)</Label>
                  <span className="text-[10px] text-amber-400 font-bold border border-amber-400/20 px-2 py-0.5 rounded uppercase">Growth Baseline</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal mb-1">
                  Specify the starting balance of this MT5 account. This baseline is critical to plotting your compounding growth curve and discipline calculations accurately.
                </p>
                <Input 
                  id="initialBalance" 
                  name="initialBalance" 
                  type="number" 
                  step="0.01" 
                  min="1" 
                  required 
                  defaultValue="10000"
                  placeholder="e.g. 10000.00" 
                  className="h-12 bg-[#09090F] border-[#1A1A2E] text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 font-semibold" 
                />
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed text-center">
                  {error}
                </div>
              )}

              {loading && !error && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs leading-relaxed text-center animate-pulse">
                  Establishing secure tunnel and verifying read-only credentials with broker...
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <Button type="button" variant="outline" className="flex-1 h-12 border-[#1A1A2E] text-white hover:bg-white/5" onClick={() => setStep(2)} disabled={loading}>Back</Button>
                <Button type="submit" className="flex-1 h-12 bg-gradient-to-r from-[#B8860B] to-[#F59E0B] hover:opacity-90 text-black font-extrabold" disabled={loading}>
                  {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin text-black" /> : 'Connect & Sync'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {step === 4 && (
          <div className="p-12 text-center space-y-6 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-success/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12 text-success" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Connected Successfully!</h2>
              <p className="text-muted-foreground text-lg">Your account has been verified.</p>
            </div>
            <div className="bg-muted p-4 rounded-lg inline-block border border-border">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-2xl font-bold text-success">
                {realBalance !== null ? `$${realBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '...'}
              </p>
            </div>
            <p className="text-sm text-muted-foreground animate-pulse mt-8">Redirecting to dashboard...</p>
          </div>
        )}
      </Card>
    </div>
  )
}
