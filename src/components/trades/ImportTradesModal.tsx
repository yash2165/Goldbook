'use client'

import { useState, useRef } from 'react'
import { X, Upload, Check, AlertTriangle, Loader2, ArrowRight, Table, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Portal } from '@/components/ui/Portal'
import { parseCSVData } from '@/lib/csv-parsers'
import { matchTradePairs, StandardTrade } from '@/lib/trade-matcher'
import { format } from 'date-fns'


interface ImportTradesModalProps {
  onClose: () => void
  onImported: () => void
}

const BROKERS = [
  { id: 'mt4_mt5', name: 'MetaTrader 4 / 5 (MT4 / MT5)', desc: 'Upload HTML or CSV statement exported from MT4/MT5' },
  { id: 'ctrader', name: 'cTrader / TradeLocker', desc: 'Upload Trade History CSV' },
  { id: 'ftmo', name: 'FTMO / FundedNext / Prop Firms', desc: 'Upload Prop Account Trade Log CSV' },
  { id: 'tradingview', name: 'TradingView', desc: 'Upload Strategy Tester List of Trades CSV' },
  { id: 'myfxbook', name: 'Myfxbook', desc: 'Upload Myfxbook History CSV' },
  { id: 'generic', name: 'Custom Forex CSV', desc: 'Map columns from any Forex statement CSV' },
]

export function ImportTradesModal({ onClose, onImported }: ImportTradesModalProps) {
  const [broker, setBroker] = useState<string>('mt4_mt5')
  const [step, setStep] = useState<1 | 2 | 3>(1) // 1: Broker & Upload, 2: Column Mapping (generic only), 3: Review & Confirm
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)

  // CSV Parsing states
  const [headers, setHeaders] = useState<string[]>([])
  const [csvLines, setCsvLines] = useState<string[][]>([])
  
  // Mapping state for generic broker
  const [mappings, setMappings] = useState<Record<string, string>>({
    date: '',
    symbol: '',
    direction: '',
    qty: '',
    price: '',
    brokerage: '',
    stt: '',
    other_charges: '',
  })

  // Review states
  const [matchedTrades, setMatchedTrades] = useState<StandardTrade[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseRawCsv = (text: string): string[][] => {
    const lines: string[][] = []
    let row: string[] = []
    let inQuotes = false
    let entry = ''

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const nextChar = text[i + 1]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        row.push(entry.trim())
        entry = ''
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++ // Skip '\n'
        }
        row.push(entry.trim())
        if (row.some(c => c.length > 0)) {
          lines.push(row)
        }
        row = []
        entry = ''
      } else {
        entry += char
      }
    }
    if (entry || row.length > 0) {
      row.push(entry.trim())
      lines.push(row)
    }
    return lines
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile)
      setError(null)
    } else {
      setError('Please upload a valid CSV file.')
    }
  }

  const handleProcessFile = async () => {
    if (!file) return
    setParsing(true)
    setError(null)

    try {
      const text = await file.text()
      const parsedLines = parseRawCsv(text)
      
      if (parsedLines.length < 2) {
        throw new Error('CSV file is empty or contains no trade data.')
      }

      setCsvLines(parsedLines)
      const parsedHeaders = parsedLines[0].map(h => h.trim())
      setHeaders(parsedHeaders)

      if (broker === 'generic') {
        // Guess mappings
        const guessed: Record<string, string> = { ...mappings }
        parsedHeaders.forEach(h => {
          const lower = h.toLowerCase()
          if (lower.includes('date') || lower.includes('time')) guessed.date = h
          if (lower.includes('symbol') || lower.includes('scrip') || lower.includes('stock')) guessed.symbol = h
          if (lower.includes('buy') || lower.includes('sell') || lower.includes('side') || lower.includes('type') || lower.includes('direction')) guessed.direction = h
          if (lower.includes('qty') || lower.includes('quantity') || lower.includes('size')) guessed.qty = h
          if (lower.includes('price') || lower.includes('rate') || lower.includes('avg') || lower.includes('value')) guessed.price = h
          if (lower.includes('brokerage') || lower.includes('fee')) guessed.brokerage = h
          if (lower.includes('stt') || lower.includes('tax')) guessed.stt = h
          if (lower.includes('charges') || lower.includes('other') || lower.includes('gst')) guessed.other_charges = h
        })
        setMappings(guessed)
        setStep(2)
      } else {
        // Run preset parser directly
        const legs = parseCSVData(parsedLines, broker)
        const { completedTrades, openPositions } = matchTradePairs(legs)
        setMatchedTrades([...completedTrades, ...openPositions])
        setStep(3)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV file.')
    } finally {
      setParsing(false)
    }
  }

  const handleApplyMappings = () => {
    // Validate required mappings
    if (!mappings.date || !mappings.symbol || !mappings.direction || !mappings.qty || !mappings.price) {
      setError('Please map all required columns (Date, Symbol, Direction, Quantity, and Price).')
      return
    }

    setError(null)
    const legs = parseCSVData(csvLines, 'generic', mappings)
    const { completedTrades, openPositions } = matchTradePairs(legs)
    setMatchedTrades([...completedTrades, ...openPositions])
    setStep(3)
  }

  const handleImport = async () => {
    setImporting(true)
    setError(null)

    try {
      const res = await fetch('/api/trades/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: matchedTrades }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to import trades.')

      setSuccessCount(data.count)
      setTimeout(() => {
        onImported()
      }, 2500)
    } catch (err: any) {
      setError(err.message || 'An error occurred during trade import.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-xl bg-[#0D1421] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Import Trade Book
            </h2>
            <button onClick={onClose} className="text-[#64748B] hover:text-foreground transition-colors cursor-pointer" disabled={importing}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 max-h-[85vh] overflow-y-auto space-y-6">
            
            {/* Step 1: Broker Selection & File Upload */}
            {step === 1 && !successCount && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#64748B] uppercase tracking-wider font-bold">Select Broker</Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {BROKERS.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBroker(b.id)}
                        className={cn(
                          'p-3 text-left rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-20',
                          broker === b.id
                            ? 'border-primary bg-primary/5 text-white shadow-md shadow-primary/5'
                            : 'border-white/5 bg-white/2 hover:bg-white/5 text-[#64748B]'
                        )}
                      >
                        <span className="font-bold text-xs text-slate-100">{b.name}</span>
                        <span className="text-[9px] text-[#64748B] leading-snug">{b.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-[#64748B] uppercase tracking-wider font-bold">Upload Trade Book CSV File</Label>
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed border-white/10 hover:border-primary/50 transition-colors rounded-2xl p-8 text-center bg-[#09090e]/30 flex flex-col items-center justify-center space-y-3 cursor-pointer',
                      file && 'border-primary/50 bg-primary/[0.01]'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white/95">
                        {file ? file.name : 'Drag & drop tradebook CSV here'}
                      </p>
                      <p className="text-[10px] text-[#64748B] mt-0.5">
                        {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Or click to select a file from your device'}
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1 border-white/10 bg-transparent cursor-pointer" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={!file || parsing}
                    onClick={handleProcessFile}
                    className="flex-1 bg-primary hover:bg-primary/90 cursor-pointer text-black font-bold flex items-center justify-center gap-2"
                  >
                    {parsing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Continue <ArrowRight className="w-4 h-4" /></>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Generic Column Mapping UI */}
            {step === 2 && !successCount && (
              <div className="space-y-5">
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    ⚙️ <strong>Column Mapping:</strong> Match columns in your custom CSV to GoldBook trade fields. Required columns are marked with an asterisk (*).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'date', label: 'Trade Date *' },
                    { key: 'symbol', label: 'Symbol / Instrument Name *' },
                    { key: 'direction', label: 'Buy / Sell Side *' },
                    { key: 'qty', label: 'Quantity / Lots *' },
                    { key: 'price', label: 'Execution Price *' },
                    { key: 'brokerage', label: 'Brokerage Fees (₹)' },
                    { key: 'stt', label: 'STT Charges (₹)' },
                    { key: 'other_charges', label: 'Other Levies / GST (₹)' },
                  ].map(field => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-[11px] text-[#64748B] uppercase tracking-wider font-bold">{field.label}</Label>
                      <select
                        value={mappings[field.key]}
                        onChange={e => setMappings(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full bg-[#060A12] border border-[#1E3A5F]/50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary/50 text-white appearance-none cursor-pointer [color-scheme:dark]"
                      >
                        <option value="">-- Choose Column --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1 border-white/10 bg-transparent cursor-pointer" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleApplyMappings}
                    className="flex-1 bg-primary hover:bg-primary/90 cursor-pointer text-black font-bold"
                  >
                    Apply Mapping
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Review Table & Confirmation */}
            {step === 3 && !successCount && (
              <div className="space-y-5">
                <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Trades Matched & Paired</h3>
                    <p className="text-[10px] text-[#64748B] mt-0.5 leading-snug">
                      We paired {matchedTrades.filter(t => t.status === 'closed').length} completed trades and {matchedTrades.filter(t => t.status === 'open').length} open positions.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-primary text-black font-black text-xs rounded-full">
                    {matchedTrades.length} Trades
                  </span>
                </div>

                <div className="overflow-x-auto border border-white/5 rounded-xl bg-[#09090e]/60 max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/2 text-[9px] text-[#64748B] uppercase tracking-wider font-bold">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Symbol</th>
                        <th className="py-2 px-3">Side</th>
                        <th className="py-2 px-3">Qty</th>
                        <th className="py-2 px-3">Entry</th>
                        <th className="py-2 px-3">Exit</th>
                        <th className="py-2 px-3 text-right">P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03] font-mono text-[11px] text-slate-300">
                      {matchedTrades.map((t, idx) => {
                        const isWin = (t.net_profit ?? 0) >= 0
                        return (
                          <tr key={idx} className="hover:bg-white/[0.01]">
                            <td className="py-2 px-3 whitespace-nowrap">
                              {format(new Date(t.open_time), 'MMM dd HH:mm')}
                            </td>
                            <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                              {t.symbol}
                              {t.instrument_type === 'options' && (
                                <span className="text-[9px] font-black text-primary/80 ml-1">
                                  {t.strike_price}{t.option_type}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className={cn(
                                'font-bold uppercase text-[9px]',
                                t.direction === 'buy' ? 'text-emerald-400' : 'text-red-400'
                              )}>
                                {t.direction === 'buy' ? 'Long' : 'Short'}
                              </span>
                            </td>
                            <td className="py-2 px-3">{t.lot_size}</td>
                            <td className="py-2 px-3">₹{t.entry_price}</td>
                            <td className="py-2 px-3">
                              {t.status === 'closed' ? `₹${t.exit_price}` : <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1 rounded font-bold uppercase">Open</span>}
                            </td>
                            <td className={cn(
                              'py-2 px-3 text-right font-bold whitespace-nowrap',
                              t.status === 'closed' ? (isWin ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'
                            )}>
                              {t.status === 'closed' ? `₹${t.net_profit?.toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1 border-white/10 bg-transparent cursor-pointer" onClick={() => setStep(broker === 'generic' ? 2 : 1)} disabled={importing}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={importing}
                    onClick={handleImport}
                    className="flex-1 bg-primary hover:bg-primary/90 cursor-pointer text-black font-bold flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Import {matchedTrades.length} Trades</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Success confirmation screen */}
            {successCount !== null && (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-white">Import Complete!</h3>
                  <p className="text-xs text-[#64748B] max-w-xs mx-auto leading-relaxed">
                    Successfully imported <strong className="text-white">{successCount}</strong> new trades to your journal dossiers. Already imported trades were automatically skipped.
                  </p>
                </div>
                <p className="text-[10px] text-primary animate-pulse font-bold">Refreshing workspace dashboard in a moment...</p>
              </div>
            )}

          </div>

        </div>
      </div>
    </Portal>
  )
}
