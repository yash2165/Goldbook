'use client'

import { useTrades } from '@/hooks/useTrades'
import { useAccounts } from '@/hooks/useAccounts'
import { getClosedTrades, fmt } from '@/lib/calculations'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Clock, Target, Hash } from 'lucide-react'

export default function TradeAnalysisPage() {
  const { activeAccount } = useAccounts()
  const { trades, loading } = useTrades(activeAccount?.id)
  const closed = getClosedTrades(trades)

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trade Analysis</h1>
        <p className="text-sm text-[#64748B] mt-1">Deep dive into each trade's performance</p>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : closed.length === 0 ? (
        <div className="bg-[#12121a] border border-white/5 rounded-xl py-20 text-center">
          <Hash className="w-10 h-10 mx-auto text-[#334155] mb-3" />
          <p className="text-[#64748B]">No closed trades to analyze yet</p>
        </div>
      ) : (
        <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#334155] border-b border-white/5 bg-white/2">
                <th className="text-left px-6 py-3">#</th>
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-left px-6 py-3">Symbol</th>
                <th className="text-left px-6 py-3">Direction</th>
                <th className="text-left px-6 py-3">Entry</th>
                <th className="text-left px-6 py-3">Exit</th>
                <th className="text-left px-6 py-3">Size</th>
                <th className="text-left px-6 py-3">Duration</th>
                <th className="text-left px-6 py-3">R:R</th>
                <th className="text-right px-6 py-3">P&L</th>
                <th className="text-left px-6 py-3">Setup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {closed.map((t, i) => {
                const durationMin = t.duration_seconds ? Math.round(t.duration_seconds / 60) : null
                const durationStr = durationMin
                  ? durationMin < 60 ? `${durationMin}m`
                    : durationMin < 1440 ? `${Math.round(durationMin / 60)}h`
                    : `${Math.round(durationMin / 1440)}d`
                  : '—'

                return (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5 text-[#334155] font-mono text-xs">{i + 1}</td>
                    <td className="px-6 py-3.5 text-xs text-[#64748B]">
                      {t.close_time ? format(new Date(t.close_time), 'MMM dd, HH:mm') : '—'}
                    </td>
                    <td className="px-6 py-3.5 font-bold">{t.symbol}</td>
                    <td className="px-6 py-3.5">
                      <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold',
                        t.direction === 'buy' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]')}>
                        {t.direction === 'buy' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t.direction === 'buy' ? 'Long' : 'Short'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[#94A3B8] text-xs">{t.entry_price?.toFixed(2) ?? '—'}</td>
                    <td className="px-6 py-3.5 font-mono text-[#94A3B8] text-xs">{t.exit_price?.toFixed(2) ?? '—'}</td>
                    <td className="px-6 py-3.5 text-[#94A3B8] text-xs">{t.lot_size ?? '—'}</td>
                    <td className="px-6 py-3.5 text-xs text-[#64748B] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {durationStr}
                    </td>
                    <td className="px-6 py-3.5 text-xs">
                      {t.rr_ratio != null ? (
                        <span className={cn('font-bold', t.rr_ratio >= 1 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                          1:{t.rr_ratio.toFixed(2)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className={cn('font-bold tabular-nums', (t.net_profit ?? 0) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                        {t.net_profit !== null ? fmt(t.net_profit) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {t.setup_tag ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">{t.setup_tag}</span>
                      ) : <span className="text-[#334155]">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
