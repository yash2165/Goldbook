'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface MT5Account {
  id: string
  nickname: string | null
  mt5_login: number
  broker_server: string
  broker_name: string | null
  account_currency: string
  initial_balance: number | null
  current_balance: number | null
  current_equity: number | null
  is_verified: boolean
  is_active: boolean
  last_synced_at: string | null
  last_error: string | null
  sync_token: string | null
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<MT5Account[]>([])
  const [activeAccount, setActiveAccount] = useState<MT5Account | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchAccounts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('mt5_accounts')
      .select('*')
      .eq('user_id', user.id)

    const accs = (data as MT5Account[]) ?? []
    setAccounts(accs)
    
    // Maintain active account selection if possible, otherwise default to first active account, or first account
    setActiveAccount(prev => {
      if (prev) {
        const updated = accs.find(a => a.id === prev.id)
        if (updated) return updated
      }
      const firstActive = accs.find(a => a.is_active)
      return firstActive || accs[0] || null
    })
    
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAccounts()

    let channel: any

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel('mt5_accounts_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mt5_accounts',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            // Trigger a re-fetch of accounts upon any Postgres change (INSERT, UPDATE, DELETE)
            fetchAccounts()
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase, fetchAccounts])

  return { 
    accounts, 
    activeAccount, 
    setActiveAccount, 
    loading, 
    refreshAccounts: fetchAccounts 
  }
}
