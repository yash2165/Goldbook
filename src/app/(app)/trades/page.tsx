'use client'

import { useState } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { AddTradeModal } from '@/components/trades/AddTradeModal'
import { ImportTradesModal } from '@/components/trades/ImportTradesModal'
import { fmt, getClosedTrades, getOpenTrades } from '@/lib/calculations'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Plus, Link2, Filter, Trash2, ExternalLink, TrendingUp, TrendingDown, Clock, Edit3, Info, Upload } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useMarketMode } from '@/context/MarketModeContext'

export default function TradesPage() {
  const { activeAccount } = useAccounts()
  const { trades, loading, refetch } = useTrades(activeAccount?.id)
  const [showModal, setShowModal] = useState(false)
  const [editingTrade, setEditingTrade] = useState<any>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [filterDir, setFilterDir] = useState<'all' | 'buy' | 'sell'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()
  const { isIndian } = useMarketMode()

  const handleDelete = async (id: string) => {
    const trade = trades.find(t => t.id === id)
    if (trade && trade.source !== 'manual' && trade.source !== 'csv_import') {
      alert('MT5 verified trades are locked and cannot be deleted.')
      return
    }
    if (!confirm('Are you sure you want to delete this trade?')) return
    setDeletingId(id)
    await supabase.from('trades').update({ is_deleted: true }).eq('id', id)
    setDeletingId(null)
    refetch()
  }

  const handleEditClick = (trade: any) => {
    setEditingTrade(trade)
    setShowModal(true)
  }

  const filtered = trades.filter(t => {
    if (filterDir !== 'all' && t.direction !== filterDir) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    return true
  })

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Trades</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
              activeAccount?.is_verified
                ? 'bg-[#22C55E]/10 text-[#22C55E]'
                : 'bg-white/5 text-[#64748B]'
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', activeAccount?.is_verified ? 'bg-[#22C55E] animate-pulse' : 'bg-[#334155]')} />
              {activeAccount?.is_verified ? 'MT5 Connected' : 'Not connected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg text-sm font-medium transition-colors cursor-pointer text-slate-200"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <Link href="/connect">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg text-sm font-medium transition-colors cursor-pointer text-slate-200">
              <Link2 className="w-4 h-4" /> Connect MT4/MT5
            </button>
          </Link>
          <button
            onClick={() => { setEditingTrade(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-primary/20 cursor-pointer text-black"
          >
            <Plus className="w-4 h-4" /> Add Trade
          </button>
        </div>
      </div>

      {/* Centralized Analysis Notification Banner */}
      <div className="bg-[#0D1421] border border-primary/20 p-4 rounded-xl flex items-center justify-between gap-4 shadow-lg shadow-primary/[0.02] animate-in fade-in slide-in-from-top-3 duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Info className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Looking for complete trade review logs, emotional analysis, or charts?</p>
            <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">
              Visit our centralized <Link href="/analysis/trade-analysis" className="text-primary hover:underline font-bold">Trade Analysis console</Link> to view detailed historical journals, checklist metrics, emotions, and run premium <strong>Trade Replay</strong> simulators.
            </p>
          </div>
        </div>
        <Link href="/analysis/trade-analysis">
          <button className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 rounded-lg text-xs font-bold text-primary transition-all active:scale-95 whitespace-nowrap cursor-pointer">
            View Analytics
          </button>
        </Link>
      </div>

      {/* Trade History */}
      <div className="bg-[#0D1421] border border-white/5 rounded-xl">
        {/* Subheader */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-sm">Trade History</h2>
            <span className="text-xs text-[#64748B]">{filtered.length} of {trades.length} trades</span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            {/* Status filter */}
            <div className="flex bg-white/5 rounded-lg p-1 gap-1 text-xs">
              {(['all', 'open', 'closed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    'px-3 py-1 rounded-md font-medium transition-all capitalize cursor-pointer',
                    filterStatus === s ? 'bg-primary text-black font-semibold' : 'text-[#64748B] hover:text-foreground'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            {/* Direction filter */}
            <div className="flex bg-white/5 rounded-lg p-1 gap-1 text-xs">
              {(['all', 'buy', 'sell'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setFilterDir(d)}
                  className={cn(
                    'px-3 py-1 rounded-md font-medium transition-all capitalize cursor-pointer',
                    filterDir === d ? 'bg-primary text-black font-semibold' : 'text-[#64748B] hover:text-foreground'
                  )}
                >
                  {d === 'buy' ? 'Long' : d === 'sell' ? 'Short' : 'All'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#64748B] mt-3">Loading trades...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4 text-[#334155]">
            <div className="w-16 h-16 rounded-2xl bg-white/3 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-[#64748B]" />
            </div>
            <div className="text-center">
              <p className="font-medium text-[#64748B]">No trades yet</p>
              <p className="text-sm mt-1 text-[#64748B]">Add your first trade, upload a CSV or connect your MT5 account</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-semibold transition-colors cursor-pointer text-white"
              >
                <Upload className="w-4 h-4" /> Import CSV
              </button>
              <button
                onClick={() => { setEditingTrade(null); setShowModal(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-semibold transition-colors cursor-pointer text-black"
              >
                <Plus className="w-4 h-4" /> Add Trade
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#64748B] border-b border-white/5 font-bold">
                  <th className="text-left px-6 py-3 font-medium">Open / Close</th>
                  <th className="text-left px-6 py-3 font-medium">Symbol</th>
                  <th className="text-left px-6 py-3 font-medium">Type</th>
                  <th className="text-left px-6 py-3 font-medium">Entry</th>
                  <th className="text-left px-6 py-3 font-medium">Exit</th>
                  <th className="text-left px-6 py-3 font-medium">Size</th>
                  <th className="text-right px-6 py-3 font-medium">P&L</th>
                  <th className="text-left px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.map(trade => {
                  const symSign = trade.currency === 'EUR' ? '€' : trade.currency === 'GBP' ? '£' : '$'
                  const isManualLike = trade.source === 'manual' || trade.source === 'csv_import'
                  
                  return (
                    <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-3.5">
                        <div className="text-xs text-[#64748B]">
                          <div>Open: {trade.open_time ? format(new Date(trade.open_time), 'MMM dd HH:mm') : '—'}</div>
                          {trade.close_time && (
                            <div className="mt-0.5">Close: {format(new Date(trade.close_time), 'MMM dd HH:mm')}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <span className="text-[9px] font-black uppercase">
                              {trade.instrument_type === 'options' ? 'OPT' : trade.instrument_type === 'futures' ? 'FUT' : trade.instrument_type === 'equity' ? 'EQ' : 'SPOT'}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {trade.symbol}
                              {trade.instrument_type === 'options' && trade.strike_price && trade.option_type && !trade.symbol.includes(trade.option_type) && (
                                <span className={cn(
                                  'text-[9px] px-1 py-0.5 rounded font-black',
                                  trade.option_type === 'CE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-red-500/10 text-red-400 border border-red-500/15'
                                )}>
                                  {trade.strike_price}{trade.option_type}
                                </span>
                              )}
                            </div>
                            {trade.expiry_date && (
                              <div className="text-[9px] text-[#64748B] font-mono leading-none mt-0.5">
                                Exp: {trade.expiry_date}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded font-semibold',
                          trade.direction === 'buy'
                            ? 'bg-[#22C55E]/10 text-[#22C55E]'
                            : 'bg-[#EF4444]/10 text-[#EF4444]'
                        )}>
                          {trade.direction === 'buy'
                            ? <><TrendingUp className="w-3 h-3" /> Long</>
                            : <><TrendingDown className="w-3 h-3" /> Short</>}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-[#94A3B8]">
                        {symSign}{trade.entry_price?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-[#94A3B8]">
                        {trade.exit_price ? `${symSign}${trade.exit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : (
                          <span className="text-xs text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded">Open</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-[#94A3B8] font-mono">{trade.lot_size ?? '—'}</td>
                      <td className="px-6 py-3.5 text-right">
                        <span className={cn(
                          'font-bold tabular-nums font-mono',
                          (trade.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                        )}>
                          {trade.net_profit !== null ? fmt(trade.net_profit, true, symSign) : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide',
                          isManualLike
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-primary/10 text-primary'
                        )}>
                          {trade.source === 'csv_import' ? '🗎 CSV Import' : trade.source === 'manual' ? '✎ Manual' : '⚡ MT5'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        {isManualLike ? (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity justify-end">
                            <button
                              onClick={() => handleEditClick(trade)}
                              className="p-1.5 text-[#64748B] hover:text-foreground hover:bg-white/5 rounded transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(trade.id)}
                              disabled={deletingId === trade.id}
                              className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/5 rounded transition-colors cursor-pointer" 
                              title="Delete"
                            >
                              <Trash2 className={cn("w-3.5 h-3.5", deletingId === trade.id && "animate-pulse text-[#EF4444]")} />
                            </button>
                          </div>
                        ) : (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 rounded border border-white/5 bg-white/[0.02] whitespace-nowrap">
                              Verified Locked
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AddTradeModal
          accountId={activeAccount?.id}
          trade={editingTrade}
          onClose={() => { setShowModal(false); setEditingTrade(null) }}
          onSaved={() => { setShowModal(false); setEditingTrade(null); refetch() }}
        />
      )}

      {showImportModal && (
        <ImportTradesModal
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); refetch() }}
        />
      )}
    </div>
  )
}
