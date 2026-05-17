'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    if (!isLogin && !name) return
    
    setLoading(true)
    setError(null)

    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      router.push('/dashboard')
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            display_name: name,
          }
        }
      })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }
      
      // If email confirmation is required, notify user
      if (data?.user && data.user.identities?.length === 0) {
        setError('This email is already registered.')
        setLoading(false)
        return
      }

      // Upsert profile for the new user just to be safe
      if (data?.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: name,
          username: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        }, { onConflict: 'id' })
      }

      router.push('/onboarding')
    }
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

      <div className="w-full max-w-md space-y-8 bg-[#0d1017]/80 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl relative z-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gold drop-shadow-md">Gold</span>Book
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          <button
            onClick={() => { setIsLogin(true); setError(null) }}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
              isLogin ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-white"
            )}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(null) }}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
              !isLogin ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-white"
            )}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background/50 border-white/10 h-11"
              />
            </div>
          )}
          
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="trader@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background/50 border-white/10 h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-background/50 border-white/10 h-11"
            />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-sm text-danger animate-in fade-in">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : isLogin ? 'Sign In' : 'Create Account'}
          </Button>

          <div className="relative pt-4">
            <div className="absolute inset-0 flex items-center pt-4">
              <span className="w-full border-t border-white/5" />
            </div>
            <div className="relative flex justify-center text-xs uppercase pt-4">
              <span className="bg-[#0d1017] px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleLogin}
            className="w-full h-11 bg-background/50 border-white/10 hover:bg-white/5 transition-colors"
            disabled={loading}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </Button>
        </form>
      </div>
    </div>
  )
}
