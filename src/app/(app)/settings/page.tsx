'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User, Bell, Shield, CheckCircle2, MonitorSmartphone, Settings as SettingsIcon, Globe, Clock, TrendingUp, Link as LinkIcon, Edit3, Loader2, Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/context/ToastContext'

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
  const [profile, setProfile] = useState({ 
    username: '', 
    display_name: '', 
    trading_style: '', 
    country: '', 
    bio: '',
    timezone: 'UTC',
    pre_trade_checklist: DEFAULT_CHECKLIST,
    trading_setups: [] as { name: string, description: string }[]
  })
  const [rules, setRules] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  const [newChecklist, setNewChecklist] = useState('')
  const [newSetupName, setNewSetupName] = useState('')
  const [newSetupDesc, setNewSetupDesc] = useState('')
  
  // Security form states
  const [emailUpdate, setEmailUpdate] = useState('')
  const [passwordUpdate, setPasswordUpdate] = useState('')
  const [authMessage, setAuthMessage] = useState('')

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
          trading_style: data.trading_style ?? '',
          country: data.country ?? '',
          bio: data.bio ?? '',
          timezone: data.timezone ?? 'UTC',
          pre_trade_checklist: data.pre_trade_checklist || DEFAULT_CHECKLIST,
          trading_setups: data.trading_setups || []
        })
      }

      // Load active rules
      const { data: rulesData } = await supabase
        .from('trading_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
      
      if (rulesData) setRules(rulesData)
    }
    load()
  }, [])

  const save = async () => {
    if (!user) return
    setSaving(true)
    
    // Sanitize values to lowercase/null to satisfy check constraints and prevent database crashes
    const sanitizedTradingStyle = profile.trading_style ? profile.trading_style.toLowerCase().trim() : null
    const sanitizedCountry = profile.country ? profile.country.trim() : null
    const sanitizedBio = profile.bio ? profile.bio.trim() : null
    const sanitizedDisplayName = profile.display_name ? profile.display_name.trim() : null
    const sanitizedUsername = profile.username ? profile.username.trim() : null

    const { error } = await supabase
      .from('profiles')
      .update({ 
        username: sanitizedUsername || null,
        display_name: sanitizedDisplayName || null,
        trading_style: sanitizedTradingStyle || null,
        country: sanitizedCountry || null,
        bio: sanitizedBio || null,
        timezone: profile.timezone,
        pre_trade_checklist: profile.pre_trade_checklist,
        trading_setups: profile.trading_setups,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      
    setSaving(false)
    if (!error) {
      setSaved(true)
      showSuccess('Profile Updated Successfully', 'Your preferences, custom checklist, and setups have been saved.')
      setTimeout(() => setSaved(false), 2500)
    } else {
      console.error(error)
      showError('Failed to save profile', error.message || 'Make sure you have run the SQL update in Supabase.')
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
    setAuthMessage('Updating...')
    let error = null
    if (type === 'email' && emailUpdate) {
      const res = await supabase.auth.updateUser({ email: emailUpdate })
      error = res.error
    } else if (type === 'password' && passwordUpdate) {
      const res = await supabase.auth.updateUser({ password: passwordUpdate })
      error = res.error
    }
    
    if (error) {
      setAuthMessage(error.message)
    } else {
      setAuthMessage('Success! Check your email if required.')
      setEmailUpdate('')
      setPasswordUpdate('')
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile & Preferences', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      
      {/* Top Banner equivalent */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage your account preferences and security.</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-white/5 pb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              tab === t.id ? 'bg-primary/10 text-primary' : 'text-[#64748B] hover:text-white hover:bg-white/5'
            )}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-6 pb-20">
        {tab === 'profile' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Trading Rules Summary */}
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-white text-sm">Active Trading Rules</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">Your personal risk ceiling and conditions.</p>
                  </div>
                </div>
                <Link href="/rules">
                  <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-xs font-bold text-white transition-colors">
                    <Edit3 className="w-3 h-3" /> Edit Rules
                  </button>
                </Link>
              </div>
              
              {rules.length === 0 ? (
                <div className="p-4 bg-white/5 rounded-xl text-sm text-[#64748B] text-center">
                  You have no active trading rules. Set them up to let AI coach track your discipline.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {rules.map(r => {
                    let val = r.value_str || r.value?.toString() || 'Active'
                    if (r.rule_type === 'min_rr_ratio' && r.value) val = `1:${r.value}`
                    if (r.rule_type === 'daily_loss_limit' && r.value) val = `$${r.value}`
                    
                    return (
                      <div key={r.id} className="bg-[#0d1017] border border-white/5 rounded-xl p-3">
                        <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest flex items-center gap-1 truncate" title={r.label}>
                          <span className="text-primary">*</span> {r.label}
                        </p>
                        <p className="text-lg font-black mt-2 truncate">{val}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Preferences */}
              <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Globe className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-white text-sm">Preferences</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">Localisation and display settings</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#64748B] uppercase tracking-wider">Country</Label>
                    <select
                      value={profile.country}
                      onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
                      className="w-full bg-[#0d1017] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark] text-white appearance-none"
                    >
                      <option value="">Select Country</option>
                      {Array.from(new Set([...COUNTRIES, profile.country])).filter(Boolean).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#64748B] uppercase tracking-wider">Timezone</Label>
                    <select
                      value={profile.timezone}
                      onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}
                      className="w-full bg-[#0d1017] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark] text-white appearance-none"
                    >
                      {Array.from(new Set([...TIMEZONES, profile.timezone])).filter(Boolean).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <User className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-white text-sm">Personal Details</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">How you appear to others</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#64748B] uppercase tracking-wider">Username</Label>
                    <Input value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} className="bg-[#0d1017] border-white/10 h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#64748B] uppercase tracking-wider">Display Name</Label>
                    <Input value={profile.display_name} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} className="bg-[#0d1017] border-white/10 h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#64748B] uppercase tracking-wider">Trading Style</Label>
                    <select
                      value={profile.trading_style}
                      onChange={e => setProfile(p => ({ ...p, trading_style: e.target.value }))}
                      className="w-full bg-[#0d1017] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark] text-white appearance-none h-11"
                    >
                      <option value="">Select Trading Style (None)</option>
                      <option value="scalper">Scalper</option>
                      <option value="swing">Swing</option>
                      <option value="intraday">Intraday</option>
                      <option value="position">Position</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#64748B] uppercase tracking-wider">Bio</Label>
                    <textarea 
                      value={profile.bio} 
                      onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} 
                      placeholder="Share a short bio..." 
                      className="w-full bg-[#0d1017] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors text-white h-24 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pre-Trade Checklist customizer */}
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-white text-sm">Pre-Trade Checklist</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">Customize the checklist you see before opening a trade.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {profile.pre_trade_checklist.length === 0 ? (
                  <div className="text-sm text-[#64748B]">No checklist items. Add some below.</div>
                ) : (
                  profile.pre_trade_checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#0d1017] border border-white/5 rounded-lg">
                      <span className="text-sm font-medium">{item}</span>
                      <button onClick={() => removeChecklistItem(idx)} className="text-[#EF4444] text-xs hover:underline">Remove</button>
                    </div>
                  ))
                )}

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                  <Input 
                    value={newChecklist} 
                    onChange={e => setNewChecklist(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                    placeholder="E.g. Wait for 5m candle close..." 
                    className="bg-[#0d1017] border-white/10 flex-1"
                  />
                  <button onClick={addChecklistItem} className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm font-bold transition-colors">
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Trading Setups customizer */}
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-white text-sm">Trading Setups</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">Define your custom setups to tag trades easily.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {profile.trading_setups?.length === 0 ? (
                  <div className="text-sm text-[#64748B]">No setups defined. Add some below.</div>
                ) : (
                  profile.trading_setups?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#0d1017] border border-white/5 rounded-lg">
                      <div>
                        <p className="text-sm font-bold text-white">{item.name}</p>
                        {item.description && <p className="text-xs text-[#64748B] mt-0.5">{item.description}</p>}
                      </div>
                      <button onClick={() => removeSetupItem(idx)} className="text-[#EF4444] text-xs hover:underline">Remove</button>
                    </div>
                  ))
                )}

                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/5">
                  <div className="flex gap-2">
                    <Input 
                      value={newSetupName} 
                      onChange={e => setNewSetupName(e.target.value)} 
                      placeholder="Setup Name (e.g. Liquidity Sweep)" 
                      className="bg-[#0d1017] border-white/10 flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      value={newSetupDesc} 
                      onChange={e => setNewSetupDesc(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && addSetupItem()}
                      placeholder="Description (Optional)" 
                      className="bg-[#0d1017] border-white/10 flex-1"
                    />
                    <button onClick={addSetupItem} className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm font-bold transition-colors">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* User details save */}
            <div className="flex justify-end pt-4">
              <button
                onClick={save}
                disabled={saving}
                className={cn(
                  'flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold transition-all',
                  saved ? 'bg-[#22C55E] text-white' : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'
                )}
              >
                {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved Successfully!</> : saving ? <><Loader2 className="w-4 h-4 animate-spin"/> Saving...</> : <><Save className="w-4 h-4" /> Save Profile</>}
              </button>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Session Security */}
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-white text-sm mb-1">Session Security</h3>
              <p className="text-xs text-[#64748B] mb-6">Manage your active sessions</p>
              
              <div className="flex items-center justify-between py-4 border-b border-white/5">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Session Alerts</p>
                  <p className="text-xs text-[#64748B]">Get notified of new login attempts</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="mt-6">
                <p className="text-sm font-bold mb-4">Active Sessions</p>
                <div className="bg-[#0d1017] border border-white/5 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <MonitorSmartphone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">Current Browser</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase">Current</span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">Active now</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Credentials */}
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-white text-sm mb-1">Account Credentials</h3>
              <p className="text-xs text-[#64748B] mb-6">Update your login email and password.</p>

              {authMessage && (
                <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">
                  {authMessage}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <Label className="text-xs text-[#64748B] uppercase tracking-wider mb-2 block">Change Email</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="email" 
                      placeholder="New Email Address" 
                      value={emailUpdate}
                      onChange={e => setEmailUpdate(e.target.value)}
                      className="bg-[#0d1017] border-white/10 max-w-sm"
                    />
                    <button 
                      onClick={() => handleUpdateAuth('email')}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm font-bold transition-colors"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-[#64748B] uppercase tracking-wider mb-2 block">Change Password</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="password" 
                      placeholder="New Password" 
                      value={passwordUpdate}
                      onChange={e => setPasswordUpdate(e.target.value)}
                      className="bg-[#0d1017] border-white/10 max-w-sm"
                    />
                    <button 
                      onClick={() => handleUpdateAuth('password')}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm font-bold transition-colors"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2FA */}
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-white text-sm mb-1">Two-Factor Authentication</h3>
              <p className="text-xs text-[#64748B] mb-6">Add an extra layer of security to your account</p>
              
              <p className="text-sm text-[#64748B] mb-4">Protect your account with phone-based two-factor authentication. You'll receive an SMS code on each login.</p>
              
              <button className="px-4 py-2 border border-primary text-primary hover:bg-primary/10 rounded-lg text-sm font-bold transition-colors">
                Enable 2FA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
