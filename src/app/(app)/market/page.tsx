'use client'

import { Globe } from 'lucide-react'
import { useEffect, useRef } from 'react'

export default function MarketPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Inject TradingView Advanced Chart Widget
    if (containerRef.current && containerRef.current.children.length === 0) {
      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/tv.js'
      script.async = true
      script.onload = () => {
        if (window.TradingView) {
          new window.TradingView.widget({
            autosize: true,
            symbol: "OANDA:XAUUSD",
            interval: "60",
            timezone: "Etc/UTC",
            theme: "dark",
            style: "1",
            locale: "en",
            enable_publishing: false,
            backgroundColor: "#12121a",
            gridColor: "rgba(255, 255, 255, 0.05)",
            hide_top_toolbar: false,
            hide_legend: false,
            save_image: false,
            container_id: "tv_chart_container"
          })
        }
      }
      containerRef.current.appendChild(script)
    }
  }, [])

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center gap-3 shrink-0">
        <Globe className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Market Analysis</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] font-medium">Live</span>
      </div>

      <div className="flex-1 bg-[#12121a] border border-white/5 rounded-xl overflow-hidden relative">
        <div id="tv_chart_container" className="absolute inset-0" ref={containerRef} />
      </div>
    </div>
  )
}

declare global {
  interface Window {
    TradingView: any;
  }
}
