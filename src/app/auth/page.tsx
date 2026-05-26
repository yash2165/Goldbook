'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import GoldBookLogo from '@/components/GoldBookLogo'

const ParticleBackground = dynamic(
  () => import('@/components/obsidian/ParticleBackground').then(mod => mod.ParticleBackground),
  { ssr: false }
)

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [pendingUserId, setPendingUserId] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // OTP verification flow
    if (otpSent) {
      if (!otpCode || otpCode.length !== 6) {
        setError('Please enter the full 6-digit verification code.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const verifyRes = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: pendingUserId, code: otpCode })
        })
        const verifyData = await verifyRes.json()
        
        if (!verifyRes.ok) {
          setError(verifyData.error || 'Verification failed')
          setLoading(false)
          return
        }

        // Automatic secure login upon verification success
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setError('Verification succeeded, but login failed: ' + signInError.message)
          setIsLogin(true)
          setOtpSent(false)
          setLoading(false)
          return
        }
        router.push('/dashboard')
      } catch (err: any) {
        setError('Verification failed: ' + err.message)
        setLoading(false)
      }
      return
    }

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
      // 1. Strict domain constraint validation
      if (!email.toLowerCase().endsWith('@gmail.com')) {
        setError('Registration is restricted to verified Gmail addresses only.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to register')
        setLoading(false)
        return
      }

      setPendingUserId(data.userId)
      setOtpSent(true)
      setError('Verification code sent! Please check your Gmail inbox.')
      setLoading(false)
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
    <div className="min-h-screen flex items-center justify-center bg-transparent text-[#F1F5F9] p-4 relative overflow-hidden font-sans isolate">
      {/* Landing Page Background (Obsidian + Three.js Interactive Particles) */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[#050508]">
        <ParticleBackground density={1200} />
      </div>

      {/* Floating Lights */}
      <div className="fixed top-[-10%] left-[-10%] w-[45vw] h-[45vw] bg-[#F59E0B]/6 blur-[180px] rounded-full pointer-events-none mix-blend-screen z-0" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] bg-[#B8860B]/4 blur-[200px] rounded-full pointer-events-none mix-blend-screen z-0" />

      {/* Back to Home CTA */}
      <div className="absolute top-6 left-6 z-20">
        <Link href="/">
          <button className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-colors cursor-pointer">
            ← Back to Home
          </button>
        </Link>
      </div>

      <div className="relative z-10 w-full flex justify-center py-12">
        <div className="w-full max-w-md space-y-8 bg-[#0c0c14]/95 backdrop-blur-2xl p-8 rounded-2xl border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.8)] relative">
          
          {/* Gold Badge Logo Header */}
          <div className="text-center space-y-3">
            <GoldBookLogo size={42} className="shadow-[0_0_20px_rgba(255,215,0,0.2)] mx-auto" />
            <h1 className="font-extrabold text-2xl tracking-wider uppercase">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#F59E0B] to-[#D4AF37]">GOLD</span>
              <span className="text-white/90 font-light">BOOK</span>
            </h1>
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest mt-1">
              {otpSent ? 'Activate your account' : isLogin ? 'Sign in to your console' : 'Establish a new account'}
            </p>
          </div>

          {/* Tab Switcher */}
          {!otpSent && (
            <div className="flex bg-white/[0.03] rounded-xl p-1.5 gap-1 border border-white/5">
              <button
                onClick={() => { setIsLogin(true); setError(null) }}
                className={cn(
                  "flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all border cursor-pointer",
                  isLogin 
                    ? "bg-[#FFD700]/15 border-[#FFD700]/20 text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.1)]" 
                    : "text-[#64748B] border-transparent hover:text-white/90"
                )}
              >
                Sign In
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(null) }}
                className={cn(
                  "flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all border cursor-pointer",
                  !isLogin 
                    ? "bg-[#FFD700]/15 border-[#FFD700]/20 text-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.1)]" 
                    : "text-[#64748B] border-transparent hover:text-white/90"
                )}
              >
                Sign Up
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {otpSent ? (
              // 6-digit numeric verification layout
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-xs text-slate-300">
                    We sent a 6-digit activation code to <strong className="text-primary">{email}</strong>.
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-1 font-semibold uppercase tracking-wider">
                    Please check your Gmail inbox and spam folders.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="otpCode" className="text-xs font-bold text-slate-400 uppercase tracking-wider">6-Digit Verification Code</Label>
                  <Input
                    id="otpCode"
                    placeholder="••••••"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                    className="bg-[#09090F] border-white/10 h-14 text-center text-2xl tracking-[8px] font-black text-white focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 font-mono"
                  />
                </div>
              </div>
            ) : (
              // Traditional Login / Signup Inputs
              <>
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Your Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="bg-[#09090F] border-white/10 h-12 text-white focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 font-medium"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="trader@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-[#09090F] border-white/10 h-12 text-white focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Secure Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-[#09090F] border-white/10 h-12 text-white focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 font-medium"
                  />
                </div>
              </>
            )}

            {error && (
              <div className={cn(
                "p-4 rounded-xl text-xs leading-relaxed text-center border animate-in fade-in",
                error.includes('Verification code sent') || error.includes('Verification succeeded')
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]"
              )}>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="w-full py-3.5 bg-gradient-to-r from-[#FFD700] via-[#F59E0B] to-[#D4AF37] hover:opacity-95 text-black font-extrabold text-xs uppercase tracking-widest rounded-lg transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(255,215,0,0.25)] flex items-center justify-center cursor-pointer"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-black" />
              ) : otpSent ? (
                'Activate Terminal'
              ) : isLogin ? (
                'Launch Console'
              ) : (
                'Deploy Account'
              )}
            </button>

            {otpSent && (
              <button
                type="button"
                onClick={() => { setOtpSent(false); setError(null); setOtpCode('') }}
                className="w-full py-2 bg-transparent text-[#64748B] hover:text-white/80 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer text-center"
              >
                ← Cancel & Re-register
              </button>
            )}

            {!otpSent && (
              <>
                <div className="relative pt-2">
                  <div className="absolute inset-0 flex items-center pt-2">
                    <span className="w-full border-t border-white/5" />
                  </div>
                  <div className="relative flex justify-center text-[10px] font-bold uppercase pt-2">
                    <span className="bg-[#0c0c14] px-3 text-[#64748B] tracking-wider">Or secure credentials with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-3 bg-white/[0.02] border border-white/10 hover:bg-white/[0.06] text-white/95 font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  disabled={loading}
                >
                  <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google Account
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
