'use client'

import { Globe, TrendingUp, TrendingDown, RefreshCcw, Loader2, Clock, Calculator, Calendar } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAccounts } from '@/hooks/useAccounts'
import { format } from 'date-fns'

interface TickerData {
  symbol: string
  name: string
  tvSymbol: string
  binanceSymbol: string
  price: number | null
  change: number | null
  high: number | null
  low: number | null
}

const INITIAL_TICKERS: TickerData[] = [
  { symbol: 'XAUUSD', name: 'Gold Spot', tvSymbol: 'OANDA:XAUUSD', binanceSymbol: 'PAXGUSDT', price: null, change: null, high: null, low: null },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', tvSymbol: 'OANDA:EURUSD', binanceSymbol: 'EURUSDT', price: null, change: null, high: null, low: null },
  { symbol: 'GBPUSD', name: 'Pound / US Dollar', tvSymbol: 'OANDA:GBPUSD', binanceSymbol: 'GBPUSDT', price: null, change: null, high: null, low: null },
  { symbol: 'BTCUSD', name: 'Bitcoin Spot', tvSymbol: 'BINANCE:BTCUSDT', binanceSymbol: 'BTCUSDT', price: null, change: null, high: null, low: null },
  { symbol: 'ETHUSD', name: 'Ethereum Spot', tvSymbol: 'BINANCE:ETHUSDT', binanceSymbol: 'ETHUSDT', price: null, change: null, high: null, low: null }
]

export default function MarketPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tickers, setTickers] = useState<TickerData[]>(INITIAL_TICKERS)
  const [activeTicker, setActiveTicker] = useState<TickerData>(INITIAL_TICKERS[0])
  const [loadingPrice, setLoadingPrice] = useState(false)
  const widgetRef = useRef<any>(null)

  // Interactive Timeframe State
  const [timeframe, setTimeframe] = useState<string>("60")

  // Sidebar Tab Layout State
  const [sidebarTab, setSidebarTab] = useState<'assets' | 'calc' | 'news'>('assets')

  // Position Calculator States
  const { activeAccount } = useAccounts()
  const [calcBalance, setCalcBalance] = useState<string>("10000")
  const [calcRisk, setCalcRisk] = useState<string>("1")
  const [calcSl, setCalcSl] = useState<string>("20")

  // Sync active account balance with calculator if loaded
  useEffect(() => {
    if (activeAccount?.current_balance) {
      setCalcBalance(activeAccount.current_balance.toString())
    } else {
      setCalcBalance("10000")
    }
  }, [activeAccount])

  // Economic Calendar News States
  const [news, setNews] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNews(data)
      })
      .catch(console.error)
  }, [])

  // 1. Fetch live quotes for all tickers from public Binance API on mount & interval
  useEffect(() => {
    let active = true

    async function fetchQuotes() {
      if (!active) return
      
      try {
        const updated = await Promise.all(tickers.map(async (t) => {
          try {
            // Fetch ticker price & 24hr change statistics from public Binance ticker API
            const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${t.binanceSymbol}`)
            if (res.ok) {
              const data = await res.json()
              return {
                ...t,
                price: parseFloat(data.lastPrice),
                change: parseFloat(data.priceChangePercent),
                high: parseFloat(data.highPrice),
                low: parseFloat(data.lowPrice)
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch quote for ${t.symbol}:`, e)
          }
          return t
        }))

        if (active) {
          setTickers(updated)
        }
      } catch (err) {
        console.error('Error fetching global tickers:', err)
      }
    }

    fetchQuotes()
    const interval = setInterval(fetchQuotes, 6000) // update every 6 seconds
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  // 2. Inject & Re-Initialize TradingView Chart Widget when active ticker shifts
  useEffect(() => {
    if (!containerRef.current) return

    // Clear previous widget content to prevent container duplicates
    containerRef.current.innerHTML = '<div id="tv_chart_container" class="absolute inset-0" />'

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = () => {
      if (window.TradingView && containerRef.current) {
        widgetRef.current = new window.TradingView.widget({
          autosize: true,
          symbol: activeTicker.tvSymbol,
          interval: timeframe,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          backgroundColor: "#0D1421",
          gridColor: "rgba(255, 255, 255, 0.05)",
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: "tv_chart_container"
        })
      }
    }
    
    containerRef.current.appendChild(script)

    return () => {
      if (widgetRef.current) {
        widgetRef.current = null
      }
    }
  }, [activeTicker, timeframe])

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Market Terminal</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] font-black border border-[#22C55E]/20 uppercase tracking-widest animate-pulse">Live Feed</span>
        </div>
        <span className="text-[9px] text-[#64748B] font-mono hidden sm:block uppercase tracking-wider">Synced with Global liquidity Pools</span>
      </div>

      {/* Main Terminal Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0 overflow-hidden items-stretch">
        
        {/* LEFT COLUMN: Currency, Commodity, Calculator sidebar */}
        <div className="col-span-1 bg-[#0D1421] border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-2xl h-full">
          {/* TAB SELECTION ROW */}
          <div className="flex border-b border-white/5 p-1 bg-white/[0.01] gap-1 text-[10px] uppercase font-black shrink-0">
            {[
              { id: 'assets', label: 'Market Assets', icon: Globe },
              { id: 'calc', label: 'Risk Calc', icon: Calculator },
              { id: 'news', label: 'Calendar', icon: Calendar }
            ].map((tab) => {
              const TabIcon = tab.icon
              const isSelected = sidebarTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setSidebarTab(tab.id as any)}
                  className={cn(
                    "flex-1 py-2 rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95",
                    isSelected 
                      ? "bg-primary text-black shadow-md shadow-primary/10 font-black" 
                      : "text-[#64748B] hover:text-white"
                  )}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* PANEL CONTENTS */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            
            {/* PANEL 1: Market Assets Tickers */}
            {sidebarTab === 'assets' && (
              <div className="space-y-2.5 animate-in fade-in duration-200">
                {tickers.map((t) => {
                  const isActive = t.symbol === activeTicker.symbol
                  const hasPrice = t.price !== null
                  const isUp = t.change !== null && t.change >= 0

                  return (
                    <div
                      key={t.symbol}
                      onClick={() => setActiveTicker(t)}
                      className={cn(
                        "p-3.5 rounded-xl cursor-pointer transition-all duration-300 border relative group",
                        isActive 
                          ? "bg-[#09090E] border-[#F59E0B]/50 shadow-[0_0_15px_rgba(245,159,11,0.05)]" 
                          : "bg-[#0F0F18]/40 border-white/[0.02] hover:bg-[#0F0F18] hover:border-white/10"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r" />
                      )}

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-black text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {t.symbol}
                            {isActive && <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />}
                          </span>
                          <span className="text-[9px] text-[#64748B] font-semibold block">{t.name}</span>
                        </div>

                        <div className="text-right space-y-0.5">
                          {hasPrice ? (
                            <>
                              <span className="text-xs font-extrabold font-mono text-white block">
                                ${t.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className={cn(
                                "text-[9px] font-black font-mono inline-flex items-center gap-0.5 px-1 py-0.2 rounded",
                                isUp ? "text-[#22C55E] bg-[#22C55E]/10" : "text-[#EF4444] bg-[#EF4444]/10"
                              )}>
                                {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                {t.change?.toFixed(2)}%
                              </span>
                            </>
                          ) : (
                            <div className="flex items-center gap-1 text-[9px] text-[#64748B] font-mono">
                              <Loader2 className="w-3 h-3 animate-spin text-primary" /> quote sync
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* PANEL 2: Position Size Calculator */}
            {sidebarTab === 'calc' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-white">Risk Calculator</h4>
                  <p className="text-[10px] text-[#64748B]">Calculate recommended contract lots instantly.</p>
                </div>

                <div className="space-y-3.5 bg-white/[0.01] border border-white/5 rounded-xl p-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Account Balance ($)</label>
                    <input 
                      type="number" 
                      value={calcBalance}
                      onChange={(e) => setCalcBalance(e.target.value)}
                      className="w-full bg-[#09090E] border border-white/5 rounded-lg py-2 px-3 text-xs font-bold text-white focus:outline-none focus:border-primary/50 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Risk (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={calcRisk}
                      onChange={(e) => setCalcRisk(e.target.value)}
                      className="w-full bg-[#09090E] border border-white/5 rounded-lg py-2 px-3 text-xs font-bold text-white focus:outline-none focus:border-primary/50 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Stop Loss (Pips)</label>
                    <input 
                      type="number" 
                      value={calcSl}
                      onChange={(e) => setCalcSl(e.target.value)}
                      className="w-full bg-[#09090E] border border-white/5 rounded-lg py-2 px-3 text-xs font-bold text-white focus:outline-none focus:border-primary/50 font-mono"
                    />
                  </div>
                </div>

                {/* Calculation Outputs Card */}
                {(() => {
                  const bal = parseFloat(calcBalance) || 10000
                  const riskPct = parseFloat(calcRisk) || 1
                  const slPips = parseFloat(calcSl) || 20
                  
                  const riskAmt = bal * (riskPct / 100)
                  // Standard Gold contract multiplier or FX scaling
                  const calculatedLots = slPips > 0 ? (riskAmt / (slPips * 10)) : 0

                  return (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-2.5 shadow-md shadow-primary/[0.02]">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-[#64748B] uppercase tracking-widest font-black block">Recommended Position Size</span>
                        <span className="text-2xl font-black text-primary font-mono tracking-tight block">
                          {calculatedLots.toFixed(2)} <span className="text-xs font-bold">Lots</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-primary/10 pt-2 text-[10px] text-[#64748B] font-mono">
                        <span>Risk Amount: ${riskAmt.toFixed(2)}</span>
                        <span>SL Value: 1.0 Lot = ${slPips * 10}</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* PANEL 3: Economic News Calendar list */}
            {sidebarTab === 'news' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-white">Upcoming News Events</h4>
                  <p className="text-[10px] text-[#64748B]">High-Impact global economic releases today.</p>
                </div>

                <div className="space-y-2.5 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                  {news.length === 0 ? (
                    <p className="text-[10px] text-[#64748B] italic text-center py-6">No high-impact releases logged today.</p>
                  ) : (
                    news.map((n, idx) => {
                      const dateStr = format(new Date(n.date), 'HH:mm')
                      return (
                        <div key={idx} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] px-2 py-0.5 bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] rounded font-black uppercase tracking-wider scale-90 origin-left">
                              HIGH IMPACT
                            </span>
                            <span className="text-[10px] text-[#64748B] font-mono font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {dateStr}
                            </span>
                          </div>
                          <div className="space-y-0.5 text-left">
                            <span className="text-[10px] text-white font-extrabold block leading-snug">{n.title}</span>
                            <span className="text-[9px] text-[#64748B] font-black tracking-wider uppercase block">{n.country} • Impact</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* RIGHT COLUMN: Re-injectable TradingView Advanced chart frame */}
        <div className="col-span-1 lg:col-span-3 bg-[#0D1421] border border-white/5 rounded-2xl overflow-hidden relative shadow-2xl h-full flex flex-col">
          <div className="p-3 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Active Terminal:</span>
              <span className="text-xs font-black text-white uppercase tracking-wider bg-white/5 border border-white/5 px-2 py-0.5 rounded">
                {activeTicker.tvSymbol}
              </span>
            </div>

            {/* Timeframe selector toolbar */}
            <div className="flex bg-white/5 rounded-lg p-1 gap-1 text-[10px] uppercase font-black border border-white/5">
              {[
                { label: '5M', value: '5' },
                { label: '15M', value: '15' },
                { label: '1H', value: '60' },
                { label: '4H', value: '240' },
                { label: '1D', value: 'D' },
              ].map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-center transition-all duration-200 active:scale-95',
                    timeframe === tf.value
                      ? 'bg-primary text-black font-extrabold shadow-md shadow-primary/10'
                      : 'text-[#64748B] hover:text-white'
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <span className="text-[9px] text-[#64748B] font-mono hidden md:block">
              Interval: {timeframe === 'D' ? '1 Day' : timeframe === '240' ? '4 Hours' : timeframe === '60' ? '1 Hour' : `${timeframe}m`}
            </span>
          </div>

          {/* Interactive Chart Canvas */}
          <div className="flex-1 relative" ref={containerRef}>
            <div id="tv_chart_container" className="absolute inset-0" />
          </div>
        </div>

      </div>

    </div>
  )
}

declare global {
  interface Window {
    TradingView: any;
  }
}
