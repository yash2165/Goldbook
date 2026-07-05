'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type MarketMode = 'forex' | 'indian'

interface MarketModeContextType {
  marketMode: MarketMode
  setMarketMode: (mode: MarketMode) => Promise<void>
  isIndian: boolean
  currencySymbol: string
  currencyCode: string
  defaultSymbols: string[]
  sessionLabels: string[]
  lotLabel: string
  pipLabel: string
  chargesVisible: boolean
  formatCurrency: (val: number, showSign?: boolean) => string
  loading: boolean
}

const MarketModeContext = createContext<MarketModeContextType | undefined>(undefined)

export function MarketModeProvider({ children }: { children: React.ReactNode }) {
  const [marketMode, setMarketModeState] = useState<MarketMode>('forex')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadMarketMode() {
      try {
        const localMode = localStorage.getItem('goldbook_market_mode') as MarketMode
        if (localMode === 'forex') {
          setMarketModeState('forex')
        } else {
          setMarketModeState('forex')
          localStorage.setItem('goldbook_market_mode', 'forex')
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('market_mode')
            .eq('id', user.id)
            .single()

          if (!error && data?.market_mode && data.market_mode === 'forex') {
            setMarketModeState('forex')
          }
        }
      } catch (err) {
        console.error('Error loading market mode:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMarketMode()
  }, [supabase])

  const setMarketMode = useCallback(async (mode: MarketMode) => {
    setMarketModeState(mode)
    localStorage.setItem('goldbook_market_mode', mode)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ market_mode: mode })
          .eq('id', user.id)
      }
    } catch (err) {
      console.error('Failed to save market mode changes:', err)
    }
  }, [supabase])

  const isIndian = marketMode === 'indian'
  const currencySymbol = isIndian ? '₹' : '$'
  const currencyCode = isIndian ? 'INR' : 'USD'
  
  const defaultSymbols = isIndian 
    ? ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK']
    : ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'BTCUSD', 'ETHUSD']

  const sessionLabels = isIndian
    ? ['Pre-Market', 'Open Bell', 'Mid-Session', 'Close Bell']
    : ['Asian Session', 'London Session', 'New York Session', 'Overnight']

  const lotLabel = isIndian ? 'Quantity / Lots' : 'Lot Size'
  const pipLabel = isIndian ? 'Points' : 'Pips'
  const chargesVisible = isIndian

  const formatCurrency = useCallback((val: number, showSign = true) => {
    const absVal = Math.abs(val)
    const formatted = absVal.toLocaleString(isIndian ? 'en-IN' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    
    const signStr = showSign ? (val >= 0 ? '+' : '-') : (val >= 0 ? '' : '-')
    
    if (isIndian) {
      return `${signStr}₹${formatted}`
    }
    return `${signStr}$${formatted}`
  }, [isIndian])

  return (
    <MarketModeContext.Provider
      value={{
        marketMode,
        setMarketMode,
        isIndian,
        currencySymbol,
        currencyCode,
        defaultSymbols,
        sessionLabels,
        lotLabel,
        pipLabel,
        chargesVisible,
        formatCurrency,
        loading,
      }}
    >
      {children}
    </MarketModeContext.Provider>
  )
}

export function useMarketMode() {
  const context = useContext(MarketModeContext)
  if (context === undefined) {
    throw new Error('useMarketMode must be used within a MarketModeProvider')
  }
  return context
}

