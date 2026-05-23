'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Camera, 
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  Star, 
  Check, 
  Save, 
  Loader2,
  Trash2,
  Calendar
} from 'lucide-react'
import Link from 'next/link'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { fmt } from '@/lib/calculations'
import { createChart, ColorType } from 'lightweight-charts'

interface MockCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export default function TradeDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const supabase = createClient()
  const { success: showSuccess, error: showError } = useToast()

  const [trade, setTrade] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [savingJournal, setSavingJournal] = useState(false)
  const [setupsList, setSetupsList] = useState<string[]>([])

  // Journal form state
  const [setupTag, setSetupTag] = useState('')
  const [emotionBefore, setEmotionBefore] = useState('')
  const [emotionAfter, setEmotionAfter] = useState('')
  const [rating, setRating] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')

  // Replay simulator state
  const [candles, setCandles] = useState<MockCandle[]>([])
  const [currentStep, setCurrentStep] = useState(15) // start with "before" candles showing
  const [isPlaying, setIsPlaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState(1000) // ms per candle
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Load trade details & user setups list
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          showError('Unauthorized', 'Please log in to review this trade.')
          router.push('/login')
          return
        }

        // Fetch trade
        const { data: tradeData, error: tErr } = await supabase
          .from('trades')
          .select('*')
          .eq('id', id)
          .single()

        if (tErr || !tradeData) {
          showError('Not Found', 'This trade record does not exist.')
          router.push('/trades')
          return
        }

        setTrade(tradeData)
        setSetupTag(tradeData.setup_tag || '')
        setEmotionBefore(tradeData.emotion_before || '')
        setEmotionAfter(tradeData.emotion_after || '')
        setRating(tradeData.rating || 0)
        setNotes(tradeData.notes || '')
        setScreenshotUrl(tradeData.screenshot_url || '')

        // Generate mock candlesticks
        const generated = generateMockCandles(tradeData)
        setCandles(generated)

        // Load custom setups from profile to populate select
        const { data: pData } = await supabase
          .from('profiles')
          .select('trading_setups')
          .eq('id', user.id)
          .single()

        if (pData?.trading_setups) {
          const list = pData.trading_setups.map((s: any) => s.name)
          setSetupsList(list)
        }
      } catch (err: any) {
        console.error(err)
        showError('Load Error', 'An error occurred loading trade data.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id])

  // 2. Play/Pause Replay Logic
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= candles.length) {
            setIsPlaying(false)
            showSuccess('Replay Finished', 'The entire trade progression has run successfully.')
            return prev
          }
          return prev + 1
        })
      }, replaySpeed)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, candles, replaySpeed])

  // 3. Mount Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0 || !trade) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090e' },
        textColor: '#64748B',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
      },
    })

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderUpColor: '#22C55E',
      borderDownColor: '#EF4444',
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    })

    // Display candles only up to the current simulated step
    const visibleData = candles.slice(0, currentStep)
    candlestickSeries.setData(visibleData as any)

    // Markers for Entry & Exit
    const markers: any[] = []
    const entryIndex = 15 // Entry candle
    const exitIndex = 40  // Exit candle

    if (currentStep > entryIndex && candles[entryIndex]) {
      markers.push({
        time: candles[entryIndex].time,
        position: 'belowBar',
        color: '#F59E0B',
        shape: 'arrowUp',
        text: `BUY ENTRY @ ${Number(trade.entry_price).toFixed(2)}`,
      })
    }

    if (currentStep > exitIndex && candles[exitIndex] && trade.exit_price) {
      markers.push({
        time: candles[exitIndex].time,
        position: 'aboveBar',
        color: '#EF4444',
        shape: 'arrowDown',
        text: `EXIT @ ${Number(trade.exit_price).toFixed(2)}`,
      })
    }

    candlestickSeries.setMarkers(markers as any)
    chart.timeScale().fitContent()

    return () => {
      chart.remove()
    }
  }, [candles, currentStep, trade])

  // 4. Ctrl+V Paste Listener for TradingView screenshots
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file.type.startsWith('image/')) {
          e.preventDefault()
          await uploadScreenshot(file)
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [trade])

  // Generator of highly realistic mock candlestick datasets
  const generateMockCandles = (t: any): MockCandle[] => {
    const entry = Number(t.entry_price)
    const exit = Number(t.exit_price || t.entry_price * (t.direction === 'buy' ? 1.01 : 0.99))
    const isBuy = t.direction === 'buy'
    
    // Base times
    const openTime = new Date(t.open_time || Date.now()).getTime()
    const closeTime = new Date(t.close_time || openTime + 60 * 60000).getTime()
    const totalDuration = closeTime - openTime
    
    const numTradeCandles = 25
    const numBeforeCandles = 15
    const numAfterCandles = 15
    
    const timeStep = Math.max(60000, Math.floor(totalDuration / numTradeCandles))
    
    const candlesList: MockCandle[] = []
    let currentPrice = entry * (isBuy ? 0.992 : 1.008)

    // A. Before trade
    for (let i = numBeforeCandles; i > 0; i--) {
      const timeMs = openTime - i * timeStep
      const close = currentPrice + (Math.random() - 0.5) * (entry * 0.0015)
      const open = currentPrice
      const high = Math.max(open, close) + Math.random() * (entry * 0.0006)
      const low = Math.min(open, close) - Math.random() * (entry * 0.0006)
      candlesList.push({
        time: Math.floor(timeMs / 1000),
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 500)
      })
      currentPrice = close
    }

    // Force perfect alignment to entry price
    currentPrice = entry

    // B. During trade (interpolating towards exit)
    for (let i = 0; i <= numTradeCandles; i++) {
      const timeMs = openTime + i * timeStep
      const progress = i / numTradeCandles
      const target = entry + (exit - entry) * progress
      // Add wiggle room
      const close = target + (Math.random() - 0.5) * (entry * 0.002) * (1 - progress)
      const open = i === 0 ? entry : candlesList[candlesList.length - 1].close
      const high = Math.max(open, close) + Math.random() * (entry * 0.0009)
      const low = Math.min(open, close) - Math.random() * (entry * 0.0009)
      candlesList.push({
        time: Math.floor(timeMs / 1000),
        open,
        high,
        low,
        close: i === numTradeCandles ? exit : close,
        volume: Math.floor(Math.random() * 1000)
      })
    }

    currentPrice = exit

    // C. After trade
    for (let i = 1; i <= numAfterCandles; i++) {
      const timeMs = closeTime + i * timeStep
      const close = currentPrice + (Math.random() - 0.5) * (entry * 0.0015)
      const open = currentPrice
      const high = Math.max(open, close) + Math.random() * (entry * 0.0006)
      const low = Math.min(open, close) - Math.random() * (entry * 0.0006)
      candlesList.push({
        time: Math.floor(timeMs / 1000),
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 400)
      })
      currentPrice = close
    }

    return candlesList
  }

  // Upload file API handler
  const uploadScreenshot = async (file: File) => {
    setUploadingScreenshot(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tradeId', id)

    try {
      const res = await fetch('/api/trades/upload-screenshot', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok && data.screenshotUrl) {
        setScreenshotUrl(data.screenshotUrl)
        showSuccess('Chart Linked Successfully', 'Pasted TradingView screenshot has been linked to your journal entry.')
      } else {
        showError('Upload Failed', data.error || 'Failed to upload pasted screenshot.')
      }
    } catch (err: any) {
      console.error(err)
      showError('Upload Failed', 'An error occurred during file upload.')
    } finally {
      setUploadingScreenshot(false)
    }
  }

  // Delete Screenshot url
  const deleteScreenshot = async () => {
    try {
      const { error } = await supabase
        .from('trades')
        .update({ screenshot_url: null })
        .eq('id', id)

      if (error) throw error
      setScreenshotUrl('')
      showSuccess('Deleted', 'Screenshot reference removed.')
    } catch (err: any) {
      showError('Failed', err.message)
    }
  }

  // Save Journal Form
  const saveJournal = async () => {
    setSavingJournal(true)
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          setup_tag: setupTag || null,
          emotion_before: emotionBefore || null,
          emotion_after: emotionAfter || null,
          rating: rating || null,
          notes: notes || null
        })
        .eq('id', id)

      if (error) throw error
      showSuccess('Saved', 'Journal entries updated successfully!')
    } catch (err: any) {
      showError('Failed to Save', err.message)
    } finally {
      setSavingJournal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-[#64748B]">Retrieving trade log telemetry...</p>
      </div>
    )
  }

  if (!trade) return null

  const isBuy = trade.direction === 'buy'
  const isProfit = (trade.net_profit ?? 0) >= 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      
      {/* Back button */}
      <Link href="/trades" className="flex items-center gap-2 text-xs font-bold text-[#64748B] hover:text-white uppercase tracking-wider transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Return to Trade Logs
      </Link>

      {/* Top Header Card */}
      <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center border",
            isBuy 
              ? "bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]" 
              : "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]"
          )}>
            {isBuy ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">{trade.symbol}</h1>
              <span className={cn(
                "text-[9px] px-2 py-0.5 rounded font-black tracking-widest uppercase border",
                isBuy 
                  ? "bg-[#22C55E]/15 border-[#22C55E]/30 text-[#22C55E]" 
                  : "bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]"
              )}>
                {trade.direction === 'buy' ? 'Long' : 'Short'}
              </span>
              <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded font-black tracking-widest text-[#94A3B8] uppercase">
                {trade.status}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {trade.open_time ? new Date(trade.open_time).toLocaleString() : 'Date N/A'}
            </p>
          </div>
        </div>

        {/* Big PnL glow */}
        <div className="text-right">
          <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Net Trade Returns</p>
          <p className={cn(
            "text-3xl font-black font-mono mt-1",
            isProfit ? "text-[#22C55E] drop-shadow-[0_0_20px_rgba(34,197,94,0.15)]" : "text-[#EF4444] drop-shadow-[0_0_20px_rgba(239,68,68,0.15)]"
          )}>
            {trade.net_profit !== null ? fmt(trade.net_profit) : '—'}
          </p>
        </div>
      </div>

      {/* Grid of Key Telemetry Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#12121a]/60 border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Volume (Lots)</p>
          <p className="text-lg font-black text-white font-mono mt-1">{trade.lot_size ? trade.lot_size.toFixed(2) : '—'}</p>
        </div>
        <div className="bg-[#12121a]/60 border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Pips Gained/Lost</p>
          <p className={cn("text-lg font-black font-mono mt-1", (trade.pips ?? 0) >= 0 ? "text-[#22C55E]" : "text-[#EF4444]")}>
            {trade.pips !== null ? `${trade.pips >= 0 ? '+' : ''}${trade.pips.toFixed(1)}` : 'N/A'}
          </p>
        </div>
        <div className="bg-[#12121a]/60 border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Risk-to-Reward (R:R)</p>
          <p className="text-lg font-black text-primary font-mono mt-1">
            {trade.rr_ratio ? `1:${trade.rr_ratio.toFixed(2)}` : 'N/A'}
          </p>
        </div>
        <div className="bg-[#12121a]/60 border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-black">Execution Details</p>
          <div className="text-[10px] text-white/90 font-mono mt-1 space-y-0.5">
            <div>Entry: ${trade.entry_price ? Number(trade.entry_price).toFixed(2) : '—'}</div>
            {trade.exit_price && <div>Exit: ${Number(trade.exit_price).toFixed(2)}</div>}
          </div>
        </div>
      </div>

      {/* Main Splits layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Replay & Screenshot */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Interactive Trade Replay Engine */}
          <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">Free High-Fidelity Replay Engine</h3>
                <p className="text-[10px] text-[#64748B] mt-0.5">Animate your exact entry, ticks and exit progression offline.</p>
              </div>
              <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded border border-white/10 text-[9px] font-black text-primary uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping mr-1" /> SIMULATOR ACTIVE
              </div>
            </div>

            {/* Replay Screen */}
            <div className="h-64 rounded-xl border border-white/5 bg-[#09090e] overflow-hidden shadow-inner relative" ref={chartContainerRef}>
              {candles.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-[#64748B] font-semibold">
                  Compiling pricing feeds...
                </div>
              )}
            </div>

            {/* Replay Controller Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-[#0d1017] rounded-xl border border-white/5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/95 text-white flex items-center justify-center transition-all hover:scale-105"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                </button>
                
                <button
                  onClick={() => {
                    setIsPlaying(false)
                    setCurrentStep(15)
                  }}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-[#64748B] hover:text-white flex items-center justify-center transition-all"
                  title="Reset Replay"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                
                <span className="text-[10px] font-mono text-[#64748B] ml-2">
                  Progress: {Math.min(100, Math.floor(((currentStep - 15) / 25) * 100))}%
                </span>
              </div>

              {/* Speed Slider */}
              <div className="flex items-center gap-3">
                <Sliders className="w-3.5 h-3.5 text-[#64748B]" />
                <Label className="text-[9px] uppercase tracking-wider font-bold text-[#64748B]">Speed</Label>
                <select
                  value={replaySpeed}
                  onChange={e => setReplaySpeed(Number(e.target.value))}
                  className="bg-[#09090e] border border-white/10 rounded px-2 py-1 text-[10px] font-bold text-white focus:outline-none"
                >
                  <option value={1500}>0.5x Slow</option>
                  <option value={1000}>1.0x Normal</option>
                  <option value={500}>2.0x Fast</option>
                  <option value={200}>5.0x Extreme</option>
                </select>
              </div>
            </div>
          </div>

          {/* Screenshot Upload / Paste Panel */}
          <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">TradingView Chart Screenshot</h3>
              <p className="text-[10px] text-[#64748B] mt-0.5">Simply click Copy Chart Image in TradingView and press CTRL+V here to link chart instantly.</p>
            </div>

            {screenshotUrl ? (
              <div className="relative group rounded-xl overflow-hidden border border-white/5 bg-[#09090e] shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshotUrl} alt="Trade screenshot chart" className="w-full h-auto object-contain max-h-96" />
                
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                  <button
                    onClick={deleteScreenshot}
                    className="px-4 py-2 bg-[#EF4444] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Screenshot
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/10 hover:border-primary/40 transition-colors rounded-xl p-8 text-center bg-[#09090e]/50 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Camera className="w-6 h-6" />
                </div>
                {uploadingScreenshot ? (
                  <div className="flex items-center gap-2 text-xs text-[#64748B]">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" /> Uploading chart from clipboard...
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-white/90">Paste TradingView image (CTRL + V)</p>
                    <p className="text-[10px] text-[#64748B] mt-1">Or click to select an image from your device</p>
                    
                    <input 
                      type="file" 
                      id="screenshot-file-input" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadScreenshot(file)
                      }}
                    />
                    <button
                      onClick={() => document.getElementById('screenshot-file-input')?.click()}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white border border-white/10 mt-3 transition-all"
                    >
                      Select File
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Journal & Emotions Form */}
        <div className="space-y-6">
          <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
            <div>
              <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">Journal & Emotions</h3>
              <p className="text-[10px] text-[#64748B] mt-0.5">Track setups, rating, and mental state to master discipline.</p>
            </div>

            {/* Setups Tag */}
            <div className="space-y-2">
              <Label className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Trade setup pattern</Label>
              <select
                value={setupTag}
                onChange={e => setSetupTag(e.target.value)}
                className="w-full bg-[#0d1017] border border-white/10 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:border-primary/50 text-white select-none appearance-none"
              >
                <option value="">Select Setup Tag (None)</option>
                {setupsList.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            {/* Emotion before trade */}
            <div className="space-y-2.5">
              <Label className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Emotion Before Entry</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {['confident', 'neutral', 'nervous', 'excited', 'fearful', 'greedy'].map(emo => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => setEmotionBefore(emo)}
                    className={cn(
                      "px-1 py-2 text-[10px] font-bold uppercase tracking-wider border rounded-lg transition-all capitalize",
                      emotionBefore === emo 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "bg-[#0d1017] border-white/5 text-[#64748B] hover:text-white"
                    )}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>

            {/* Emotion after trade */}
            <div className="space-y-2.5">
              <Label className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Emotion After Exit</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {['satisfied', 'neutral', 'regret', 'relieved', 'frustrated', 'proud'].map(emo => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => setEmotionAfter(emo)}
                    className={cn(
                      "px-1 py-2 text-[10px] font-bold uppercase tracking-wider border rounded-lg transition-all capitalize",
                      emotionAfter === emo 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "bg-[#0d1017] border-white/5 text-[#64748B] hover:text-white"
                    )}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating Stars */}
            <div className="space-y-2">
              <Label className="text-[10px] text-[#64748B] uppercase tracking-widest font-black">Execute Discipline Rating</Label>
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star className={cn(
                      "w-6 h-6",
                      rating >= star 
                        ? "fill-[#FFD700] text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,213,0,0.4)]" 
                        : "text-[#334155]"
                    )} />
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-[10px] text-[#64748B] uppercase tracking-widest font-black font-sans">Setup Review Notes</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Why did you take this setup? Did you follow your trading plan? Document your entry exit notes..."
                className="w-full bg-[#0d1017] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors h-32 resize-none leading-relaxed"
              />
            </div>

            {/* Save Button */}
            <button
              onClick={saveJournal}
              disabled={savingJournal}
              className="w-full h-11 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-transform hover:scale-102 disabled:opacity-50"
            >
              {savingJournal ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Save className="w-4 h-4" /> Save Journal Entry</>
              )}
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}
