'use client'

import { useAccounts } from '@/hooks/useAccounts'
import { RefreshCcw, ChevronDown, User, LogOut, Settings, Bell } from 'lucide-react'
import { format } from 'date-fns'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'

export function TopBar() {
  const { accounts, activeAccount, setActiveAccount } = useAccounts()
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [profile, setProfile] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()
  const { warning } = useToast()

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const unreadNotifCount = notifications.filter(n => !n.is_read).length

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
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      if (res.ok && data.notifications) {
        setNotifications(data.notifications)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  // Realtime notification insert subscription
  useEffect(() => {
    let notifChannel: any

    async function initNotifRealtime() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      notifChannel = supabase
        .channel(`notifs-realtime:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          async (payload) => {
            // Fetch actor profile details
            const { data: actorProfile } = await supabase
              .from('profiles')
              .select('username, display_name, avatar_url')
              .eq('id', payload.new.actor_id)
              .single()

            const newNotif = {
              ...payload.new,
              actor: actorProfile
            }

            setNotifications(prev => [newNotif, ...prev])
          }
        )
        .subscribe()
    }

    initNotifRealtime()

    return () => {
      if (notifChannel) {
        supabase.removeChannel(notifChannel)
      }
    }
  }, [])

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', { method: 'PUT' })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleNotifClick = async (notif: any) => {
    setIsNotifOpen(false)
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notif.id })
      })
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
      router.push(notif.link)
    } catch (e) {
      console.error(e)
    }
  }


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
    <header className="h-14 border-b border-[#1E3A5F]/40 bg-[#060A12]/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 relative z-40">
      <div className="flex items-center gap-4">
        <div className="text-sm font-medium text-white/90">
          {displayDate} <span className="text-[#94A3B8] ml-2">{displayTime} {getTimezoneLabel(tz)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Sync status */}
        {activeAccount && (
          <div className="flex items-center gap-2 text-xs text-[#94A3B8] group relative cursor-help">
            <span className={`w-2 h-2 rounded-full ${isWorkerActive ? 'bg-[#34D399] animate-pulse shadow-[0_0_8px_#34D399]' : 'bg-[#F87171]'}`} />
            <span className="hidden sm:inline">
              {activeAccount.last_synced_at ? `Synced ${format(new Date(activeAccount.last_synced_at), 'HH:mm')}` : 'Never synced'}
            </span>
            <div className="absolute top-full mt-2 w-48 p-2 bg-[#0D1421] border border-[#1E3A5F]/50 rounded text-xs text-center hidden group-hover:block z-50 shadow-xl">
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
              <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
              <span className="font-medium">
                {activeAccount?.nickname ?? `MT5 #${activeAccount?.mt5_login}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </button>

            {accounts.length > 1 && isAccountOpen && (
              <div className="absolute right-0 top-full pt-1.5 w-56 z-50">
                <div className="bg-[#0D1421] border border-[#1E3A5F]/50 rounded-xl shadow-2xl py-1 relative z-10 overflow-hidden backdrop-blur-md bg-opacity-95">
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
                      <div className="text-xs text-[#94A3B8]">{acc.broker_server}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notification Bell Dropdown */}
        <div className="relative ml-2" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-all relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white font-black text-[9px] flex items-center justify-center animate-pulse">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 top-full pt-1.5 w-72 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="bg-[#0D1421] border border-[#1E3A5F]/50 rounded-xl shadow-2xl py-1.5 relative z-10 overflow-hidden backdrop-blur-md bg-opacity-95 flex flex-col max-h-80">
                <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white">Notifications</span>
                  {unreadNotifCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[9px] font-black uppercase text-primary hover:underline cursor-pointer">
                      Mark all read
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar py-1">
                  {notifications.length === 0 ? (
                    <p className="text-center text-[10px] text-[#64748B] uppercase tracking-wider font-bold py-8">No notifications yet.</p>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={cn(
                          'w-full px-4 py-2.5 text-left text-xs transition-colors hover:bg-white/5 flex gap-2.5 items-start border-b border-white/[0.02]',
                          !n.is_read && 'bg-primary/[0.02]'
                        )}
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 text-[10px] overflow-hidden border border-white/10 mt-0.5">
                          {n.actor?.avatar_url ? (
                            <img src={n.actor.avatar_url} alt="actor" className="w-full h-full object-cover" />
                          ) : (
                            n.actor?.username?.charAt(0).toUpperCase() || '?'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('leading-snug', !n.is_read ? 'text-white font-extrabold' : 'text-[#94A3B8]')}>
                            {n.body}
                          </p>
                          <span className="text-[8px] text-[#64748B] font-mono mt-0.5 block">
                            {format(new Date(n.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative ml-2" ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex items-center justify-center text-sm font-bold text-[#38BDF8] transition-transform hover:scale-105"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center bg-[#38BDF8]/20 text-[#38BDF8]">
                {profile?.username?.charAt(0).toUpperCase() || profile?.display_name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </button>
          
          {isProfileOpen && (
            <div className="absolute right-0 top-full pt-1.5 w-56 z-50">
              <div className="bg-[#0D1421] border border-[#1E3A5F]/50 rounded-xl shadow-2xl py-1 relative z-10 overflow-hidden backdrop-blur-md bg-opacity-95">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-sm font-bold truncate">{profile?.username || profile?.display_name || 'Trader'}</p>
                  <p className="text-xs text-[#94A3B8] truncate">{profile?.email}</p>
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
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#F87171] hover:bg-[#F87171]/10 transition-colors"
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
