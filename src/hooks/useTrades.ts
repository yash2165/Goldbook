'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Trade } from '@/lib/calculations'

export function useTrades(accountId?: string) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchTrades = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
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
    // Initial fetch shows loading state
    fetchTrades(true)

    let active = true
    // Subscribe to real-time changes
    const channelId = `trades_realtime_${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
        },
        () => {
          // Re-fetch silently in the background on realtime table updates
          if (active) fetchTrades(false)
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [fetchTrades])

  return { trades, loading, error, refetch: () => fetchTrades(true) }
}
