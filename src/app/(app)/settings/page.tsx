'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User, Bell, Shield, Trash2, Save, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Tab = 'profile' | 'notifications' | 'security'

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
    } else {
      console.error('Profile save error:', error.message)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Tab nav */}
      <div className="flex gap-1 bg-[#12121a] border border-white/5 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-primary/10 text-primary' : 'text-[#64748B] hover:text-foreground'
            )}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold">Profile Information</h2>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-black text-primary">
              {profile.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-[#64748B] mt-0.5">Avatar is based on your initials</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Username</Label>
              <Input value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} placeholder="goldtrader99" className="bg-white/5 border-white/10 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Display Name</Label>
              <Input value={profile.display_name} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} placeholder="John Smith" className="bg-white/5 border-white/10 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Country</Label>
              <Input value={profile.country} onChange={e => setProfile(p => ({ ...p, country: e.target.value }))} placeholder="United States" className="bg-white/5 border-white/10 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#64748B] uppercase tracking-wider">Trading Style</Label>
              <select
                value={profile.trading_style}
                onChange={e => setProfile(p => ({ ...p, trading_style: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 h-11 text-sm focus:outline-none focus:border-primary/50 transition-colors"
              >
                <option value="">Select style...</option>
                <option value="scalper">Scalper</option>
                <option value="intraday">Intraday</option>
                <option value="swing">Swing</option>
                <option value="position">Position</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[#64748B] uppercase tracking-wider">Bio</Label>
            <textarea
              value={profile.bio}
              onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
              placeholder="Tell the community about your trading approach..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
              saved ? 'bg-[#22C55E] text-white' : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'
            )}
          >
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold">Notification Preferences</h2>
          <div className="space-y-4">
            {[
              { title: 'Weekly AI Report', desc: 'Receive your AI performance analysis every Monday' },
              { title: 'Trade Sync Alerts', desc: 'Get notified when new trades are synced from MT5' },
              { title: 'Community Mentions', desc: 'Notifications when someone mentions you in chat' },
              { title: 'Drawdown Alerts', desc: 'Alert when drawdown exceeds your set threshold' },
            ].map(n => (
              <div key={n.title} className="flex items-center justify-between p-4 bg-white/2 border border-white/5 rounded-xl">
                <div>
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{n.desc}</p>
                </div>
                <button className="relative w-11 h-6 bg-primary rounded-full flex items-center px-1">
                  <div className="w-4 h-4 bg-white rounded-full ml-auto shadow transition-all" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold">Security</h2>
          <div className="p-4 bg-white/2 border border-white/5 rounded-xl">
            <p className="text-sm font-medium">Email</p>
            <p className="text-sm text-[#64748B] mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.resetPasswordForEmail(user?.email, {
                redirectTo: `${window.location.origin}/auth/reset`,
              })
              alert('Password reset email sent!')
            }}
            className="w-full text-left px-4 py-3 bg-white/2 border border-white/5 rounded-xl text-sm hover:bg-white/5 transition-colors"
          >
            <p className="font-medium">Change Password</p>
            <p className="text-xs text-[#64748B] mt-0.5">Send a password reset link to your email</p>
          </button>
          <div className="pt-4 border-t border-white/5">
            <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-3">Danger Zone</p>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/20 rounded-xl text-[#EF4444] text-sm font-medium transition-colors">
              <Trash2 className="w-4 h-4" /> Delete Account
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
