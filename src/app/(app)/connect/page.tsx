'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, ChevronRight, Loader2, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect } from 'react'

export default function ConnectPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realBalance, setRealBalance] = useState<number | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let channel: RealtimeChannel

    if (accountId) {
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
              setError("Failed to connect. Please check your MT5 login, password, and server.")
              setLoading(false)
              setAccountId(null) // Reset so they can try again
            }
          }
        )
        .subscribe()
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
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

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: insertError } = await supabase
        .from('mt5_accounts')
        .insert({
          user_id: user.id,
          mt5_login: parseInt(login),
          investor_password: password,
          broker_server: server,
          is_verified: false,
          is_active: true
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('This MT5 account is already connected.')
        }
        throw insertError
      }

      setAccountId(data.id)
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
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Get Investor Password</h2>
              <p className="text-muted-foreground">We use read-only access. We cannot place trades.</p>
            </div>
            <div className="bg-muted p-6 rounded-xl border border-border space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded bg-background flex items-center justify-center font-bold">1</div>
                <div>Open MetaTrader 5 and go to <strong>Tools &gt; Options</strong></div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded bg-background flex items-center justify-center font-bold">2</div>
                <div>Click the <strong>Server</strong> tab and select <strong>Change</strong> next to Password</div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded bg-background flex items-center justify-center font-bold">3</div>
                <div>Select <strong>Change investor (read only) password</strong> and set a new password</div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1 h-12" onClick={() => setStep(3)}>Next Step <ChevronRight className="ml-2 w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Enter Account Details</h2>
              <p className="text-muted-foreground flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-success" /> Connection is fully encrypted
              </p>
            </div>
            <form onSubmit={handleConnect} className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="login">MT5 Login Number</Label>
                <Input id="login" name="login" required placeholder="e.g. 12345678" className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Investor Password</Label>
                <Input id="password" name="password" type="password" required placeholder="Read-only password" className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server">Broker Server</Label>
                <Input id="server" name="server" required placeholder="e.g. Exness-MT5Trial6" className="h-12" />
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              {loading && !error && <p className="text-sm text-muted-foreground text-center animate-pulse">Waiting for worker verification...</p>}
              <div className="pt-4 flex gap-4">
                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setStep(2)} disabled={loading}>Back</Button>
                <Button type="submit" className="flex-1 h-12" disabled={loading}>
                  {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : 'Connect'}
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
