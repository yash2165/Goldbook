'use client'

import { useAccounts } from '@/hooks/useAccounts'
import { RefreshCcw, ChevronDown, User, LogOut, Settings } from 'lucide-react'
import { format } from 'date-fns'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/context/ToastContext'

export function TopBar() {
  const { accounts, activeAccount, setActiveAccount } = useAccounts()
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [profile, setProfile] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()
  const { warning } = useToast()

  // Dropdown states and refs
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Listen for outside clicks to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Clock ticking
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load profile and subscribe to realtime profile updates for timezone sync
  useEffect(() => {
    let profileChannel: any

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data || { email: user.email })

        // Subscribe to live profile changes (timezone update)
        profileChannel = supabase
          .channel(`profile-updates:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              setProfile(payload.new)
            }
          )
          .subscribe()
      }
    }

    loadProfile()

    return () => {
      if (profileChannel) {
        supabase.removeChannel(profileChannel)
      }
    }
  }, [])

  // Subscribe to live trading rule violations
  useEffect(() => {
    let violationsChannel: any

    async function initViolationsRealtime() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      violationsChannel = supabase
        .channel(`violations-realtime:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'rule_violations',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const violation = payload.new as any
            warning('Discipline Breach! ⚠️', violation.description)
          }
        )
        .subscribe()
    }

    initViolationsRealtime()

    return () => {
      if (violationsChannel) {
        supabase.removeChannel(violationsChannel)
      }
    }
  }, [warning])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Calculate if worker is active (synced in last 3 minutes)
  const isWorkerActive = activeAccount?.last_synced_at 
    ? (new Date().getTime() - new Date(activeAccount.last_synced_at).getTime()) < 3 * 60 * 1000
    : false

  // Format Timezone Label
  const tz = profile?.timezone || 'UTC'
  
  function getTimezoneLabel(timezoneStr: string) {
    if (timezoneStr === 'Asia/Kolkata') return 'IST'
    if (timezoneStr === 'America/New_York') return 'EST'
    if (timezoneStr === 'Europe/London') return 'GMT'
    if (timezoneStr === 'Asia/Tokyo') return 'JST'
    if (timezoneStr === 'Australia/Sydney') return 'AEST'
    if (timezoneStr === 'Asia/Dubai') return 'GST'
    return timezoneStr.split('/').pop()?.replace('_', ' ') || timezoneStr
  }

  let displayTime = ''
  let displayDate = ''
  try {
    displayTime = currentTime.toLocaleTimeString('en-US', { 
      timeZone: tz, 
      hour12: true, 
      hour: 'numeric', 
      minute: '2-digit', 
      second: '2-digit' 
    })
    displayDate = currentTime.toLocaleDateString('en-US', { 
      timeZone: tz, 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  } catch (err) {
    // Fallback to UTC clock
    displayTime = currentTime.toLocaleTimeString('en-US', { 
      timeZone: 'UTC', 
      hour12: true, 
      hour: 'numeric', 
      minute: '2-digit', 
      second: '2-digit' 
    })
    displayDate = currentTime.toLocaleDateString('en-US', { 
      timeZone: 'UTC', 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <header className="h-14 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 relative z-40">
      <div className="flex items-center gap-4">
        <div className="text-sm font-medium text-white/90">
          {displayDate} <span className="text-[#64748B] ml-2">{displayTime} {getTimezoneLabel(tz)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Sync status */}
        {activeAccount && (
          <div className="flex items-center gap-2 text-xs text-[#64748B] group relative cursor-help">
            <span className={`w-2 h-2 rounded-full ${isWorkerActive ? 'bg-[#22C55E] animate-pulse shadow-[0_0_8px_#22C55E]' : 'bg-[#EF4444]'}`} />
            <span className="hidden sm:inline">
              {activeAccount.last_synced_at ? `Synced ${format(new Date(activeAccount.last_synced_at), 'HH:mm')}` : 'Never synced'}
            </span>
            <div className="absolute top-full mt-2 w-48 p-2 bg-[#12121a] border border-white/10 rounded text-xs text-center hidden group-hover:block z-50">
              {isWorkerActive ? 'Worker is running locally and syncing MT5.' : 'Worker might be offline. Run poll.py.'}
            </div>
          </div>
        )}

        {/* Account selector */}
        {accounts.length > 0 && (
          <div className="relative" ref={accountRef}>
            <button 
              onClick={() => setIsAccountOpen(!isAccountOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/8 rounded-lg border border-white/5 text-sm transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="font-medium">
                {activeAccount?.nickname ?? `MT5 #${activeAccount?.mt5_login}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </button>

            {accounts.length > 1 && isAccountOpen && (
              <div className="absolute right-0 top-full pt-1.5 w-56 z-50">
                <div className="bg-[#12121a] border border-white/10 rounded-xl shadow-2xl py-1 relative z-10 overflow-hidden backdrop-blur-md bg-opacity-95">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setActiveAccount(acc)
                        setIsAccountOpen(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                    >
                      <div className="font-medium">{acc.nickname ?? `MT5 #${acc.mt5_login}`}</div>
                      <div className="text-xs text-[#64748B]">{acc.broker_server}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile Dropdown */}
        <div className="relative ml-2" ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary transition-transform hover:scale-105"
          >
            {profile?.username?.charAt(0).toUpperCase() || profile?.display_name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase() || '?'}
          </button>
          
          {isProfileOpen && (
            <div className="absolute right-0 top-full pt-1.5 w-56 z-50">
              <div className="bg-[#12121a] border border-white/10 rounded-xl shadow-2xl py-1 relative z-10 overflow-hidden backdrop-blur-md bg-opacity-95">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-sm font-bold truncate">{profile?.username || profile?.display_name || 'Trader'}</p>
                  <p className="text-xs text-[#64748B] truncate">{profile?.email}</p>
                </div>
                <Link 
                  href="/profile" 
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-foreground transition-colors"
                >
                  <User className="w-4 h-4" /> View Profile
                </Link>
                <Link 
                  href="/settings" 
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5 hover:text-foreground transition-colors"
                >
                  <Settings className="w-4 h-4" /> Settings
                </Link>
                <button 
                  onClick={() => {
                    setIsProfileOpen(false)
                    handleSignOut()
                  }} 
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
