'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function AuthPage() {
  const [step, setStep] = useState<'email' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // We can't definitively check if a user exists via client without triggering rate limits easily, 
  // so we will attempt login. If 'Invalid login credentials', we assume they need to register.
  // Actually, a better UX is asking for password right away if they just enter email.
  const [isRegistering, setIsRegistering] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setError(null)
    setStep('password')
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    
    setLoading(true)
    setError(null)

    // First, try to sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        // Automatically try to sign up if login fails with invalid credentials
        // This is a seamless "if not registered, create account" flow
        const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
          email,
          password,
        })
        
        if (signUpError) {
          setError(signUpError.message)
          setLoading(false)
          return
        }

        // If signup requires email confirmation and they hit rate limits, catch it
        if (signUpData?.user && signUpData.user.identities?.length === 0) {
          setError('Email already registered. Incorrect password.')
          setLoading(false)
          return
        }

        router.push('/onboarding')
        router.refresh()
        return
      } else {
        setError(signInError.message)
        setLoading(false)
        return
      }
    }

    // Success login
    router.push('/dashboard')
    router.refresh()
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/20 blur-[120px] rounded-full" />

      <div className="w-full max-w-md space-y-8 bg-card/60 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl relative z-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gold drop-shadow-md">Gold</span>Book
          </h1>
          <p className="mt-2 text-muted-foreground">
            {step === 'email' ? 'Sign in or create an account' : 'Enter your password'}
          </p>
        </div>

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-6 animate-in slide-in-from-right-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="trader@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50 border-white/10 h-12"
              />
            </div>
            
            <Button type="submit" className="w-full h-12 text-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              Continue
            </Button>

            <div className="relative pt-4">
              <div className="absolute inset-0 flex items-center pt-4">
                <span className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-xs uppercase pt-4">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-12 bg-background/50 border-white/10 hover:bg-muted transition-colors"
              disabled={loading}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </Button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6 animate-in slide-in-from-right-4">
            <button 
              type="button"
              onClick={() => { setStep('email'); setError(null) }}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to email
            </button>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password for {email}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="bg-background/50 border-white/10 h-12"
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-sm text-danger animate-in fade-in">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-12 text-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : 'Secure Login / Sign Up'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
