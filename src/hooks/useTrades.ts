'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Trade } from '@/lib/calculations'

export function useTrades(accountId?: string) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchTrades = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('trades')
      .select('*')
      .is('is_deleted', false)
      .order('open_time', { ascending: false })

    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    const { data, error: err } = await query
    if (err) {
      setError(err.message)
    } else {
      setTrades((data as Trade[]) ?? [])
    }
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    fetchTrades()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('trades-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
        },
        () => {
          // Re-fetch on any change
          fetchTrades()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTrades])

  return { trades, loading, error, refetch: fetchTrades }
}
