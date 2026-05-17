'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User, Bell, Shield, Trash2, Save, CheckCircle2, MonitorSmartphone, Settings as SettingsIcon, CreditCard, Link as LinkIcon, ExternalLink, Moon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'

type Tab = 'profile' | 'mt5' | 'settings' | 'billing' | 'security'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState({ username: '', display_name: '', trading_style: '', country: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile({
        username: data.username ?? '',
        display_name: data.display_name ?? '',
        trading_style: data.trading_style ?? '',
        country: data.country ?? '',
        bio: data.bio ?? '',
      })
    }
    load()
  }, [])

  const save = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...profile, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'mt5', label: 'MT5/MT4', icon: LinkIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      
      {/* Top Banner equivalent */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-sm text-[#64748B] mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
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

      <div className="space-y-6">
        {tab === 'profile' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* AI Report Promo */}
            <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">AI-Powered Trading Reports</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Personalised insights and analysis drawn from your trading patterns.</p>
                </div>
              </div>
              <Link href="/ai-report">
                <button className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-xs font-bold text-white transition-colors">
                  Upgrade to Pro
                </button>
              </Link>
            </div>

            {/* Trading Rules Summary */}
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-white text-sm">Trading Rules</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">Your personal risk ceiling - locked after onboarding</p>
                  </div>
                </div>
                <Link href="/rules">
                  <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-xs font-bold text-white transition-colors">
                    <Pencil className="w-3 h-3" /> Edit Rules
                  </button>
                </Link>
              </div>
              
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: 'MAX RISK / TRADE', value: '2%' },
                  { label: 'MAX TRADES / DAY', value: '5' },
                  { label: 'MAX DAILY LOSS', value: '5%' },
                  { label: 'LOSING STREAK', value: '3 in a row' },
                  { label: 'RISK / REWARD', value: '1:2' },
                ].map(r => (
                  <div key={r.label} className="bg-[#0d1017] border border-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest flex items-center gap-1">
                      <span className="text-primary">*</span> {r.label}
                    </p>
                    <p className="text-lg font-black mt-2">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Trading Preferences */}
              <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Globe className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-bold text-white text-sm">Trading Preferences</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">Sessions and pairs you focus on</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> SESSIONS
                    </p>
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold">London</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> FAVORITE PAIRS
                    </p>
                    <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold">EUR/USD</span>
                  </div>
                </div>
              </div>

              {/* Display Settings */}
              <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <MonitorSmartphone className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="font-bold text-white text-sm">Display</h3>
                      <p className="text-xs text-[#64748B] mt-0.5">How values render across the app</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0d1017] border border-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest">CURRENCY</p>
                      <p className="text-sm font-bold mt-2 flex items-center gap-2"><span className="text-primary">$</span> USD</p>
                    </div>
                    <div className="bg-[#0d1017] border border-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest">TIMEZONE</p>
                      <p className="text-sm font-bold mt-2 flex items-center gap-2"><Globe className="w-3 h-3 text-primary"/> UTC</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-between items-center text-xs text-[#64748B]">
                  <p>Edit in the Settings tab</p>
                  <button onClick={() => setTab('settings')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                    <SettingsIcon className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* User details save (moved to bottom) */}
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-white text-sm mb-4">Personal Details</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#64748B] uppercase tracking-wider">Username</Label>
                  <Input value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} className="bg-white/5 border-white/10 h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#64748B] uppercase tracking-wider">Display Name</Label>
                  <Input value={profile.display_name} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} className="bg-white/5 border-white/10 h-11" />
                </div>
              </div>
              <button
                onClick={save}
                disabled={saving}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  saved ? 'bg-[#22C55E] text-white' : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'
                )}
              >
                {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Details</>}
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
                      <p className="text-sm font-bold text-white">Chrome on Unknown</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase">Current</span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">Active now • Mumbai, IN</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-white text-sm mb-1">Password</h3>
              <p className="text-xs text-[#64748B] mb-6">Update your account password</p>

              <div className="bg-[#0d1017] border border-white/5 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Signed in with Google</p>
                  <p className="text-xs text-[#64748B] mt-0.5">Password is not required for your account</p>
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

        {/* Placeholders for other tabs */}
        {(tab === 'mt5' || tab === 'settings' || tab === 'billing') && (
          <div className="bg-[#12121a] border border-white/5 rounded-2xl p-10 text-center animate-in fade-in">
            <SettingsIcon className="w-10 h-10 text-[#334155] mx-auto mb-4" />
            <p className="text-sm font-medium text-white">This section is under construction</p>
            <p className="text-xs text-[#64748B] mt-1">Check back later.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Bot(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  )
}
function Pencil(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}
function Globe(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}
function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function TrendingUp(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}
