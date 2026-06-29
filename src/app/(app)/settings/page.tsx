'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  User, Bell, Shield, CheckCircle2, MonitorSmartphone, Settings as SettingsIcon, 
  Globe, Clock, TrendingUp, Edit3, Loader2, Save, Key, AlertTriangle, Trash2, 
  Copy, ShieldAlert, Check, CopyCheck, RefreshCcw, Info
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useToast } from '@/context/ToastContext'
import { useMarketMode, MarketMode } from '@/context/MarketModeContext'

type Tab = 'profile' | 'security'

const DEFAULT_CHECKLIST = [
  'Checked higher timeframe',
  'Risk within limits',
  'Fits my trading plan',
  'Key levels identified',
  'Economic calendar checked'
]

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Asia/Dubai',
  'Asia/Kolkata',
]

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'India', 'Germany', 'France', 'Japan', 'United Arab Emirates', 'Singapore'
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')
  const [user, setUser] = useState<any>(null)
  const { setMarketMode } = useMarketMode()

  const [profile, setProfile] = useState({ 
    username: '', 
    display_name: '', 
    avatar_url: '',
    trading_style: '', 
    country: '', 
    bio: '',
    timezone: 'UTC',
    pre_trade_checklist: DEFAULT_CHECKLIST,
    trading_setups: [] as { name: string, description: string }[],
    market_mode: 'forex' as MarketMode
  })

  const [rules, setRules] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  
  const [newChecklist, setNewChecklist] = useState('')
  const [newSetupName, setNewSetupName] = useState('')
  const [newSetupDesc, setNewSetupDesc] = useState('')
  
  // Security form states
  const [emailUpdate, setEmailUpdate] = useState('')
  const [passwordUpdate, setPasswordUpdate] = useState('')
  const [confirmPasswordUpdate, setConfirmPasswordUpdate] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authErrorMsg, setAuthErrorMsg] = useState('')
  
  // 2FA TOTP state hooks
  const [mfaFactors, setMfaFactors] = useState<any[]>([])
  const [mfaSecret, setMfaSecret] = useState<any>(null)
  const [mfaVerificationCode, setMfaVerificationCode] = useState('')
  const [enrollingMfa, setEnrollingMfa] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Session state hooks
  const [userAgentInfo, setUserAgentInfo] = useState<any>({
    browser: 'Modern Browser',
    os: 'Windows OS',
    ip: 'Current Session'
  })

  // Danger zone confirmation
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile({
          username: data.username ?? '',
          display_name: data.display_name ?? '',
          avatar_url: data.avatar_url ?? '',
          trading_style: data.trading_style ?? '',
          country: data.country ?? '',
          bio: data.bio ?? '',
          timezone: data.timezone ?? 'UTC',
          pre_trade_checklist: data.pre_trade_checklist || DEFAULT_CHECKLIST,
          trading_setups: data.trading_setups || [],
          market_mode: (data.market_mode as MarketMode) || 'forex'
        })

      }

      // Load active rules
      const { data: rulesData } = await supabase
        .from('trading_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
      
      if (rulesData) setRules(rulesData)

      // Load native Supabase TOTP MFA configuration
      try {
        const { data: factors, error: factorsErr } = await supabase.auth.mfa.listFactors()
        if (!factorsErr && factors) {
          setMfaFactors(factors.totp.filter(f => f.status === 'verified'))
        }
      } catch (err) {
        console.error('Error loading MFA factors:', err)
      }
    }
    load()

    // Detect browser/OS for session tracking
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent
      let browserName = 'Modern Browser'
      let osName = 'Windows OS'
      
      if (ua.includes('Chrome')) browserName = 'Google Chrome'
      else if (ua.includes('Firefox')) browserName = 'Mozilla Firefox'
      else if (ua.includes('Safari')) browserName = 'Apple Safari'
      else if (ua.includes('Edge')) browserName = 'Microsoft Edge'
      
      if (ua.includes('Windows')) osName = 'Windows Operating System'
      else if (ua.includes('Macintosh')) osName = 'macOS Operating System'
      else if (ua.includes('Linux')) osName = 'Linux Operating System'
      else if (ua.includes('Android')) osName = 'Android Mobile'
      else if (ua.includes('iPhone')) osName = 'iOS iPhone'
      
      setUserAgentInfo({
        browser: browserName,
        os: osName,
        ip: 'Current Session'
      })
    }
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
        showSuccess('Avatar Updated', 'Your profile picture has been updated successfully.')
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

  const save = async () => {
    if (!user) return
    setSaving(true)
    
    // Sanitize values to lowercase/null to satisfy check constraints and prevent database crashes
    const sanitizedTradingStyle = profile.trading_style ? profile.trading_style.toLowerCase().trim() : null
    const sanitizedCountry = profile.country ? profile.country.trim() : null
    const sanitizedBio = profile.bio ? profile.bio.trim() : null
    const sanitizedDisplayName = profile.display_name ? profile.display_name.trim() : null
    
    // Strict alphanumeric-only & lowercase validation for username
    const usernameRegex = /^[a-z0-9_]+$/
    const sanitizedUsername = profile.username ? profile.username.toLowerCase().replace(/[^a-z0-9_]/g, '').trim() : ''

    if (!sanitizedUsername) {
      showError('Validation Error', 'Username cannot be blank.')
      setSaving(false)
      return
    }

    if (!usernameRegex.test(sanitizedUsername)) {
      showError('Validation Error', 'Username must contain only lowercase letters, numbers, and underscores.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        username: sanitizedUsername,
        display_name: sanitizedDisplayName || null,
        trading_style: sanitizedTradingStyle || null,
        country: sanitizedCountry || null,
        bio: sanitizedBio || null,
        timezone: profile.timezone,
        pre_trade_checklist: profile.pre_trade_checklist,
        trading_setups: profile.trading_setups,
        market_mode: profile.market_mode,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      
    // Update active market context
    if (!error) {
      await setMarketMode(profile.market_mode)
    }

      
    setSaving(false)
    if (!error) {
      setSaved(true)
      showSuccess('Profile Updated Successfully', 'Your preferences, custom checklist, and setups have been saved.')
      setTimeout(() => setSaved(false), 2500)
    } else {
      console.error(error)
      if (error.code === '23505') {
        showError('Username Taken', 'This username is already claimed by another trader. Please choose a different unique username.')
      } else {
        showError('Failed to save profile', error.message || 'Make sure you have run the SQL update in Supabase.')
      }
    }
  }

  const addChecklistItem = () => {
    if (!newChecklist.trim()) return
    setProfile(p => ({ ...p, pre_trade_checklist: [...p.pre_trade_checklist, newChecklist.trim()] }))
    setNewChecklist('')
  }

  const removeChecklistItem = (idx: number) => {
    setProfile(p => ({ ...p, pre_trade_checklist: p.pre_trade_checklist.filter((_, i) => i !== idx) }))
  }

  const addSetupItem = () => {
    if (!newSetupName.trim()) return
    setProfile(p => ({ 
      ...p, 
      trading_setups: [...p.trading_setups, { name: newSetupName.trim(), description: newSetupDesc.trim() }] 
    }))
    setNewSetupName('')
    setNewSetupDesc('')
  }

  const removeSetupItem = (idx: number) => {
    setProfile(p => ({ ...p, trading_setups: p.trading_setups.filter((_, i) => i !== idx) }))
  }

  const handleUpdateAuth = async (type: 'email' | 'password') => {
    setAuthMessage('')
    setAuthErrorMsg('')

    if (type === 'email') {
      if (!emailUpdate) {
        setAuthErrorMsg('Please provide a valid email address.')
        return
      }
      setSaving(true)
      const { error } = await supabase.auth.updateUser({ email: emailUpdate })
      setSaving(false)
      if (error) {
        setAuthErrorMsg(error.message)
      } else {
        setAuthMessage('Email verification link dispatched. Please check both your current and new inbox to confirm the change.')
        setEmailUpdate('')
      }
    } else if (type === 'password') {
      if (!passwordUpdate) {
        setAuthErrorMsg('Password field cannot be blank.')
        return
      }
      if (passwordUpdate !== confirmPasswordUpdate) {
        setAuthErrorMsg('New passwords do not match. Double-check your entries.')
        return
      }
      if (passwordUpdate.length < 6) {
        setAuthErrorMsg('Password must be at least 6 characters for adequate security.')
        return
      }
      setSaving(true)
      const { error } = await supabase.auth.updateUser({ password: passwordUpdate })
      setSaving(false)
      if (error) {
        setAuthErrorMsg(error.message)
      } else {
        setAuthMessage('Password updated successfully.')
        setPasswordUpdate('')
        setConfirmPasswordUpdate('')
      }
    }
  }

  // 2FA TOTP Enrollment & Activation
  const startMfaEnrollment = async () => {
    setMfaLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'GoldBook',
        friendlyName: profile.username || 'Trader'
      })
      if (error) {
        showError('2FA Enrollment Failed', error.message)
      } else if (data) {
        setMfaSecret(data)
        setEnrollingMfa(true)
      }
    } catch (err: any) {
      showError('MFA Error', err.message || 'An error occurred during enrollment.')
    } finally {
      setMfaLoading(false)
    }
  }

  const verifyAndActivateMfa = async () => {
    if (!mfaSecret || !mfaVerificationCode) return
    setMfaLoading(true)
    try {
      const factorId = mfaSecret.id
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeErr) throw challengeErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: mfaVerificationCode
      })

      if (verifyErr) throw verifyErr

      showSuccess('2FA Activated Successfully', 'Hardware-level two-factor authentication has been locked onto your account.')
      setEnrollingMfa(false)
      setMfaSecret(null)
      setMfaVerificationCode('')
      
      // Reload active factors
      const { data: factors } = await supabase.auth.mfa.listFactors()
      if (factors) setMfaFactors(factors.totp.filter(f => f.status === 'verified'))
    } catch (err: any) {
      showError('Verification Failed', err.message || 'Invalid or expired 2FA verification code.')
    } finally {
      setMfaLoading(false)
    }
  }

  const disableMfa = async (factorId: string) => {
    setMfaLoading(true)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      showSuccess('2FA Disabled', 'Two-Factor Authentication has been removed from your account.')
      
      // Reload factors
      const { data: factors } = await supabase.auth.mfa.listFactors()
      if (factors) setMfaFactors(factors.totp.filter(f => f.status === 'verified'))
    } catch (err: any) {
      showError('Action Failed', err.message)
    } finally {
      setMfaLoading(false)
    }
  }

  const copySecretToClipboard = () => {
    if (!mfaSecret?.totp?.secret) return
    navigator.clipboard.writeText(mfaSecret.totp.secret)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  // Global logouts
  const handleGlobalSignOut = async () => {
    setMfaLoading(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) throw error
      showSuccess('Sessions Revoked', 'Logged out globally from all other devices successfully.')
      router.push('/')
    } catch (err: any) {
      showError('Action Failed', err.message)
    } finally {
      setMfaLoading(false)
    }
  }

  // Danger zone account wipe
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== profile.username) {
      showError('Verification Failed', 'Verification username is incorrect.')
      return
    }
    
    setDeletingAccount(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase.from('profiles').delete().eq('id', user.id)
        if (error) throw error
        await supabase.auth.signOut()
        showSuccess('Account Deleted', 'Your profile and data have been scrubbed from GoldBook.')
        router.push('/')
      }
    } catch (err: any) {
      showError('Action Failed', err.message)
    } finally {
      setDeletingAccount(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile & Setups', icon: User },
    { id: 'security', label: 'Security & 2FA', icon: Shield },
  ]

  const isPasswordStrong = passwordUpdate.length >= 8

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 mt-6 text-[#F1F5F9] pb-24 relative overflow-hidden">
      
      {/* Settings Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-wider text-white">Observatory Settings</h1>
          <p className="text-xs text-[#64748B] mt-1 font-bold uppercase tracking-wider">Configure your trading setups, rules baseline, and account security</p>
        </div>
      </div>

      {/* Premium Tab Selectors */}
      <div className="flex gap-2 border-b border-white/5 pb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer',
              tab === t.id 
                ? 'bg-[#38BDF8]/10 border-[#38BDF8] text-[#38BDF8] shadow-[0_0_15px_rgba(56,189,248,0.1)]' 
                : 'border-transparent text-[#94A3B8] hover:text-white hover:bg-white/5'
            )}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        
        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Visual Rules Overview card */}
            <div className="bg-[#0D1421]/60 backdrop-blur-xl border border-[#1E3A5F]/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-xs uppercase tracking-wider">Active Observance Rules</h3>
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-bold mt-0.5">Automated constraints tracked by psychology coach</p>
                  </div>
                </div>
                <Link href="/rules">
                  <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-black uppercase tracking-wider border border-white/5 transition-all cursor-pointer">
                    <Edit3 className="w-3 h-3" /> Edit Rules
                  </button>
                </Link>
              </div>
              
              {rules.length === 0 ? (
                <div className="p-5 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl text-xs text-[#64748B] text-center font-semibold">
                  No active risk constraints established. Set rules to let our coach keep you accountable.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {rules.map(r => {
                    let val = r.value_str || r.value?.toString() || 'Active'
                    if (r.rule_type === 'min_rr_ratio' && r.value) val = `1:${r.value}`
                    if (r.rule_type === 'daily_loss_limit' && r.value) val = `${r.value}%`
                    if (r.rule_type === 'max_risk_per_trade' && r.value) val = `${r.value}%`
                    
                    return (
                      <div key={r.id} className="bg-[#060A12]/40 border border-white/5 rounded-2xl p-4 shadow-sm hover:border-white/10 transition-all">
                        <p className="text-[9px] text-[#94A3B8] font-black uppercase tracking-widest flex items-center gap-1 truncate" title={r.label}>
                          <span className="text-[#38BDF8]">•</span> {r.label}
                        </p>
                        <p className="text-xl font-black mt-2 font-mono text-white/90 truncate">{val}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Preferences */}
              <div className="bg-[#0D1421]/60 backdrop-blur-xl border border-[#1E3A5F]/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-xs uppercase tracking-wider">Observatory Preferences</h3>
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-bold mt-0.5">Localisation settings and time frames</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Local Country</Label>
                    <select
                      value={profile.country}
                      onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
                      className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors [color-scheme:dark] text-white appearance-none cursor-pointer"
                    >
                      <option value="">Select Country</option>
                      {Array.from(new Set([...COUNTRIES, profile.country])).filter(Boolean).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Workspace Timezone</Label>
                    <select
                      value={profile.timezone}
                      onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}
                      className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors [color-scheme:dark] text-white appearance-none cursor-pointer"
                    >
                      {Array.from(new Set([...TIMEZONES, profile.timezone])).filter(Boolean).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Active Market Segment</Label>
                    <select
                      value={profile.market_mode}
                      onChange={e => setProfile(p => ({ ...p, market_mode: e.target.value as MarketMode }))}
                      className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors [color-scheme:dark] text-white appearance-none cursor-pointer"
                    >
                      <option value="forex">Forex Markets (USD / Lot-based)</option>
                      <option value="indian">Indian Stock Markets (INR / Option CE-PE / Equity)</option>
                    </select>
                  </div>

                </div>
              </div>

              {/* Personal Details */}
              <div className="bg-[#0D1421]/60 backdrop-blur-xl border border-[#1E3A5F]/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-xs uppercase tracking-wider">Profile Elements</h3>
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-bold mt-0.5">Customize how you appear in chat and podiums</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Avatar Upload */}
                  <div className="flex items-center gap-4 p-4 bg-[#060A12]/60 border border-white/5 rounded-2xl relative overflow-hidden">
                    <div className="relative group">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#38BDF8]/30 group-hover:border-[#38BDF8] transition-all flex items-center justify-center bg-[#0D1421] relative">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="Profile picture" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-7 h-7 text-[#94A3B8]" />
                        )}
                        {uploadingAvatar && (
                          <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-[#38BDF8] animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-white font-black uppercase tracking-wider block mb-0.5">Avatar Image</Label>
                      <p className="text-[9px] text-[#94A3B8] mb-2 font-semibold">JPG, PNG, WEBP. Max size 2MB</p>
                      <input 
                        type="file" 
                        id="settings-avatar-input" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleAvatarUpload} 
                        disabled={uploadingAvatar}
                      />
                      <button 
                        type="button"
                        onClick={() => document.getElementById('settings-avatar-input')?.click()} 
                        disabled={uploadingAvatar}
                        className="px-3 py-1.5 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 border border-[#38BDF8]/25 hover:border-[#38BDF8]/50 text-[#38BDF8] rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                      >
                        {profile.avatar_url ? 'Change Avatar' : 'Upload Avatar'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Observation Nickname</Label>
                    <Input value={profile.display_name} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} className="bg-[#060A12] border-[#1E3A5F]/50 h-11 focus-visible:ring-[#38BDF8]/35 text-white" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Observatory Username</Label>
                    <Input value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} className="bg-[#060A12] border-[#1E3A5F]/50 h-11 focus-visible:ring-[#38BDF8]/35 text-white" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Trading Style</Label>
                      <select
                        value={profile.trading_style}
                        onChange={e => setProfile(p => ({ ...p, trading_style: e.target.value }))}
                        className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors [color-scheme:dark] text-white appearance-none cursor-pointer h-11"
                      >
                        <option value="">None / System</option>
                        <option value="scalper">Scalper</option>
                        <option value="swing">Swing</option>
                        <option value="intraday">Intraday</option>
                        <option value="position">Position</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Trader Bio</Label>
                    <textarea 
                      value={profile.bio} 
                      onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} 
                      placeholder="Identify your setups..." 
                      className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#38BDF8]/50 transition-colors text-white h-24 resize-none placeholder:text-[#334155]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Pre-trade checklist manager */}
            <div className="bg-[#0D1421]/60 backdrop-blur-xl border border-[#1E3A5F]/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-xs uppercase tracking-wider">Custom Pre-Trade Checklist</h3>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-bold mt-0.5">Parameters you confirm before opening any MT5 trade</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {profile.pre_trade_checklist.length === 0 ? (
                  <div className="text-xs text-[#94A3B8] font-semibold py-4 uppercase text-center bg-white/[0.01] border border-[#94A3B8]/10 rounded-xl">No checklist items configured.</div>
                ) : (
                  profile.pre_trade_checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 bg-[#060A12]/40 border border-[#1E3A5F]/20 rounded-xl hover:border-white/10 transition-all">
                      <span className="text-sm font-semibold text-white/95">{item}</span>
                      <button onClick={() => removeChecklistItem(idx)} className="text-[#EF4444] text-xs font-black uppercase tracking-wider hover:underline cursor-pointer">Remove</button>
                    </div>
                  ))
                )}

                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                  <Input 
                    value={newChecklist} 
                    onChange={e => setNewChecklist(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                    placeholder="E.g. Confirm 4H trend direction..." 
                    className="bg-[#060A12] border-[#1E3A5F]/50 flex-1 focus-visible:ring-[#38BDF8]/35 text-white h-11"
                  />
                  <button onClick={addChecklistItem} className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider border border-white/5 transition-all cursor-pointer">
                    Add Step
                  </button>
                </div>
              </div>
            </div>

            {/* Custom trading setups tag manager */}
            <div className="bg-[#0D1421]/60 backdrop-blur-xl border border-[#1E3A5F]/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-xs uppercase tracking-wider">Trading Setup Catalog</h3>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-bold mt-0.5">Formulate unique entry tags to map closed win rates</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {profile.trading_setups?.length === 0 ? (
                  <div className="text-xs text-[#94A3B8] font-semibold py-4 uppercase text-center bg-white/[0.01] border border-[#94A3B8]/10 rounded-xl">No custom setups cataloged yet.</div>
                ) : (
                  profile.trading_setups?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-[#060A12]/40 border border-[#1E3A5F]/20 rounded-xl hover:border-white/10 transition-all">
                      <div>
                        <p className="text-sm font-black uppercase text-white tracking-wide">{item.name}</p>
                        {item.description && <p className="text-xs text-[#94A3B8] mt-1 font-medium">{item.description}</p>}
                      </div>
                      <button onClick={() => removeSetupItem(idx)} className="text-[#EF4444] text-xs font-black uppercase tracking-wider hover:underline cursor-pointer">Remove</button>
                    </div>
                  ))
                )}

                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/5">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input 
                      value={newSetupName} 
                      onChange={e => setNewSetupName(e.target.value)} 
                      placeholder="Setup Title (e.g. Liquidity Grab)" 
                      className="bg-[#060A12] border-[#1E3A5F]/50 flex-1 focus-visible:ring-[#38BDF8]/35 text-white h-11"
                    />
                    <div className="flex flex-1 gap-3">
                      <Input 
                        value={newSetupDesc} 
                        onChange={e => setNewSetupDesc(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && addSetupItem()}
                        placeholder="Setup Description (Optional)" 
                        className="bg-[#060A12] border-[#1E3A5F]/50 flex-1 focus-visible:ring-[#38BDF8]/35 text-white h-11"
                      />
                      <button onClick={addSetupItem} className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider border border-white/5 transition-all cursor-pointer shrink-0">
                        Add Setup
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile update save button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={save}
                disabled={saving}
                className={cn(
                  'flex items-center gap-2 px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all cursor-pointer',
                  saved 
                    ? 'bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E] shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                    : 'bg-gradient-to-r from-[#38BDF8] to-[#7DD3FC] border-[#38BDF8]/30 text-[#020617] shadow-lg shadow-[#38BDF8]/10'
                )}
              >
                {saved ? (
                  <><CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> Profile Saved!</>
                ) : saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-black" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Workspace Changes</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {tab === 'security' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Supabase 2FA TOTP Wizard */}
            <div className="bg-[#0D1421]/60 backdrop-blur-xl border border-[#1E3A5F]/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-xs uppercase tracking-wider">Two-Factor Authentication (2FA)</h3>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-bold mt-0.5">Encrypt authentication requests using hardware devices</p>
                </div>
              </div>

              {mfaFactors.length > 0 ? (
                /* 2FA Enabled State */
                <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.02] shadow-[0_0_20px_rgba(16,185,129,0.02)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-emerald-400 uppercase tracking-wider">2FA Locked & Active</h4>
                        <p className="text-[11px] text-[#94A3B8] font-medium mt-0.5">Authenticator app-linked TOTP factor successfully linked on your profile.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => disableMfa(mfaFactors[0].id)}
                      disabled={mfaLoading}
                      className="px-4 py-2 border border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 disabled:opacity-40"
                    >
                      {mfaLoading ? 'Scrubbing...' : 'Remove 2FA'}
                    </button>
                  </div>
                  
                  <div className="p-4 bg-black/45 rounded-xl border border-white/5">
                    <h5 className="text-[10px] text-[#94A3B8] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-500" /> Active Security Checklist
                    </h5>
                    <p className="text-[11px] text-slate-400 leading-normal font-semibold">
                      Your sessions are locked using two-factor codes. Keep your backup recovery credentials safe. If you lose access, contact support with your sync key.
                    </p>
                  </div>
                </div>
              ) : enrollingMfa ? (
                /* 2FA Enrollment Wizard Step */
                <div className="p-5 rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/[0.01] space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="text-center space-y-2">
                    <span className="px-3.5 py-1.5 bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse">
                      Verification Setup
                    </span>
                    <h4 className="text-base font-black text-white uppercase tracking-wider mt-2">Scan Authenticator Key</h4>
                    <p className="text-xs text-[#94A3B8] max-w-md mx-auto leading-relaxed font-semibold">
                      Scan the QR code below using Google Authenticator, Authy, or your browser security manager.
                    </p>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
                    {/* QR Code base64 image render */}
                    <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-white/10 relative overflow-hidden select-none">
                      {mfaSecret?.totp?.qr_code ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={mfaSecret.totp.qr_code} alt="2FA QR Code" className="w-40 h-40 object-contain select-none pointer-events-none" />
                      ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-black font-bold text-xs uppercase tracking-wider">QR Code Loading...</div>
                      )}
                    </div>

                    <div className="space-y-4 max-w-sm">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-black">Secret Account Key</Label>
                        <div className="flex items-center gap-2 bg-[#060A12] border border-[#1E3A5F]/50 px-3 py-2 rounded-xl">
                          <code className="text-xs font-mono font-bold text-slate-300 truncate max-w-[200px]">{mfaSecret?.totp?.secret || 'Generating key...'}</code>
                          <button 
                            type="button"
                            onClick={copySecretToClipboard}
                            className="p-1.5 hover:bg-white/5 rounded text-[#94A3B8] hover:text-[#38BDF8] transition-all cursor-pointer"
                          >
                            {copiedKey ? <Check className="w-4 h-4 text-[#34D399]" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-black">Enter 6-Digit Code</Label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            value={mfaVerificationCode}
                            onChange={e => setMfaVerificationCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="e.g. 847291"
                            className="bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-4 py-2.5 text-sm font-mono font-bold tracking-[0.3em] text-center w-full focus:outline-none focus:border-[#38BDF8]/50 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center pt-2 border-t border-white/5 max-w-md mx-auto">
                    <button 
                      onClick={() => { setEnrollingMfa(false); setMfaSecret(null) }}
                      className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-[#94A3B8] hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={verifyAndActivateMfa}
                      disabled={mfaLoading || mfaVerificationCode.length !== 6}
                      className="flex-1 py-2.5 bg-[#22C55E] hover:bg-[#22C55E]/90 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer border border-emerald-500/25"
                    >
                      {mfaLoading ? 'Activating...' : 'Verify & Lock 2FA'}
                    </button>
                  </div>
                </div>
              ) : (
                /* 2FA Disabled/Prompt State */
                <div className="space-y-4">
                  <p className="text-xs text-[#94A3B8] leading-relaxed font-semibold">
                    Protect your connected MT5 accounts and setups with hardware two-factor authentication. On each login attempt, you will be required to input a rolling 6-digit passcode generated by your authenticator app.
                  </p>
                  <button 
                    onClick={startMfaEnrollment}
                    disabled={mfaLoading}
                    className="px-6 py-3 bg-gradient-to-r from-[#38BDF8] to-[#7DD3FC] hover:opacity-95 text-[#020617] rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[#38BDF8]/10 hover:scale-[1.01]"
                  >
                    {mfaLoading ? 'Loading Wizard...' : 'Activate 2FA Device'}
                  </button>
                </div>
              )}
            </div>

            {/* Active Sessions */}
            <div className="bg-[#0D1421]/60 backdrop-blur-xl border border-[#1E3A5F]/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                  <MonitorSmartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-xs uppercase tracking-wider">Active Device Sessions</h3>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-bold mt-0.5">Device nodes currently authorized on your profile</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-[#060A12]/40 border border-[#1E3A5F]/20 rounded-2xl p-4 flex items-center gap-4 hover:border-white/10 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center shrink-0 text-[#38BDF8]">
                    <MonitorSmartphone className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black uppercase tracking-wider text-white">{userAgentInfo.browser}</p>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#38BDF8]/15 border border-[#38BDF8]/35 text-[#38BDF8]">Active Node</span>
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5 font-bold uppercase tracking-wider">{userAgentInfo.os} • {userAgentInfo.ip}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <button 
                    onClick={handleGlobalSignOut}
                    disabled={mfaLoading}
                    className="px-5 py-3 border border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {mfaLoading ? 'Revoking...' : 'Revoke All Other Device Sessions'}
                  </button>
                </div>
              </div>
            </div>

            {/* Account Credentials */}
            <div className="bg-[#0D1421]/60 backdrop-blur-xl border border-[#1E3A5F]/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-xs uppercase tracking-wider">Profile Credentials</h3>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-bold mt-0.5">Manage login email and password locks</p>
                </div>
              </div>

              {authMessage && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold leading-relaxed mb-6">
                  ✓ {authMessage}
                </div>
              )}

              {authErrorMsg && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold leading-relaxed mb-6">
                  ⚠️ {authErrorMsg}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-8">
                {/* Change Email */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Observatory Email Address</Label>
                    <p className="text-[10px] text-[#94A3B8] mb-2 font-semibold">Current login email: <strong className="text-white">{user?.email}</strong></p>
                    <Input 
                      type="email" 
                      placeholder="Enter new email address" 
                      value={emailUpdate}
                      onChange={e => setEmailUpdate(e.target.value)}
                      className="bg-[#060A12] border-[#1E3A5F]/50 h-11 focus-visible:ring-[#38BDF8]/35 text-white"
                    />
                  </div>
                  <button 
                    onClick={() => handleUpdateAuth('email')}
                    disabled={saving || !emailUpdate}
                    className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider border border-white/5 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Update Email Address
                  </button>
                </div>

                {/* Change Password */}
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Configure New Password</Label>
                      <Input 
                        type="password" 
                        placeholder="Type new secure password" 
                        value={passwordUpdate}
                        onChange={e => setPasswordUpdate(e.target.value)}
                        className="bg-[#060A12] border-[#1E3A5F]/50 h-11 focus-visible:ring-[#38BDF8]/35 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Verify New Password</Label>
                      <Input 
                        type="password" 
                        placeholder="Re-type new password to confirm" 
                        value={confirmPasswordUpdate}
                        onChange={e => setConfirmPasswordUpdate(e.target.value)}
                        className="bg-[#060A12] border-[#1E3A5F]/50 h-11 focus-visible:ring-[#38BDF8]/35 text-white"
                      />
                    </div>
                  </div>

                  {passwordUpdate && (
                    <div className="p-3 bg-[#060A12]/60 border border-white/5 rounded-xl flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span>Password Strength:</span>
                      <span className={cn('font-black', isPasswordStrong ? 'text-emerald-400' : 'text-[#F87171]')}>
                        {isPasswordStrong ? 'STRENGTH COMPLIANT ✓' : 'TOO WEAK ❌ (MIN 8 CHARS)'}
                      </span>
                    </div>
                  )}

                  <button 
                    onClick={() => handleUpdateAuth('password')}
                    disabled={saving || !passwordUpdate || passwordUpdate !== confirmPasswordUpdate || !isPasswordStrong}
                    className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider border border-white/5 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Update Password Lock
                  </button>
                </div>
              </div>
            </div>

            {/* DANGER ZONE */}
            <div className="bg-red-500/[0.01] border border-red-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-red-400 text-xs uppercase tracking-wider">Observatory Scrub Protocol (Danger Zone)</h3>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-bold mt-0.5">Permanent account deletion and data scrubbing</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-4">
                  <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-red-400 uppercase tracking-widest">IRREVERSIBLE scrubbing WARNING</h4>
                    <p className="text-[11px] text-red-200/80 leading-relaxed font-semibold mt-1">
                      Deleting your account is permanent. This wipes all database rows: connected MT5 servers, synced trade logs, journals, emotion metrics, and AI behavioral analysis reports. This cannot be undone under any circumstances.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 max-w-md">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8] uppercase tracking-wider font-black">Type your username (<span className="text-white font-mono">{profile.username}</span>) to verify:</Label>
                    <Input 
                      value={deleteConfirmation}
                      onChange={e => setDeleteConfirmation(e.target.value)}
                      placeholder="Enter username to verify delete"
                      className="bg-[#060A12] border-red-500/10 h-11 focus-visible:ring-red-500/25 text-white"
                    />
                  </div>
                  <button 
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount || deleteConfirmation !== profile.username}
                    className="px-6 py-3.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/15 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Scrub Account Permanently</>}
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
