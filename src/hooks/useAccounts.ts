'use client'

import { useEffect, useState } from 'react'
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
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<MT5Account[]>([])
  const [activeAccount, setActiveAccount] = useState<MT5Account | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchAccounts() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('mt5_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)

      const accs = (data as MT5Account[]) ?? []
      setAccounts(accs)
      if (accs.length > 0) setActiveAccount(accs[0])
      setLoading(false)
    }
    fetchAccounts()
  }, [])

  return { accounts, activeAccount, setActiveAccount, loading }
}
