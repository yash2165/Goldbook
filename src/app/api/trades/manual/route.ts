import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    account_id, symbol, direction, lot_size,
    entry_price, exit_price, open_time, close_time,
    sl, tp, notes, pre_trade_checklist,
    emotion_before, emotion_after, rating,
  } = body

  // Verify that the account belongs to the authenticated user to prevent parameter injection
  if (account_id) {
    const { data: acc } = await supabase
      .from('mt5_accounts')
      .select('user_id')
      .eq('id', account_id)
      .single()

    if (!acc || acc.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Account does not belong to user.' }, { status: 403 })
    }
  }

  // Calculate net profit for manual trades (simplified for XAUUSD: pip value ~$10/lot)
  let net_profit: number | null = null
  let pips: number | null = null

  if (entry_price && exit_price && lot_size) {
    if (symbol === 'XAUUSD') {
      // XAUUSD: 1 pip = $0.01 in price, value = $1 per 0.01 lot per pip
      const priceDiff = direction === 'buy'
        ? exit_price - entry_price
        : entry_price - exit_price
      pips = parseFloat((priceDiff * 10).toFixed(1))
      net_profit = parseFloat((priceDiff * lot_size * 100).toFixed(2))
    } else {
      const priceDiff = direction === 'buy'
        ? exit_price - entry_price
        : entry_price - exit_price
      net_profit = parseFloat((priceDiff * lot_size * 100000).toFixed(2))
    }
  }

  // Force manual trades to be closed
  const final_close_time = close_time ?? open_time

  // Duration in seconds
  let duration_seconds: number | null = null
  if (open_time && final_close_time) {
    duration_seconds = Math.floor(
      (new Date(final_close_time).getTime() - new Date(open_time).getTime()) / 1000
    )
  }

  // RR ratio
  let rr_ratio: number | null = null
  if (sl && tp && entry_price) {
    const risk = Math.abs(entry_price - sl)
    const reward = Math.abs(tp - entry_price)
    if (risk > 0) rr_ratio = parseFloat((reward / risk).toFixed(2))
  }

  const mt5_ticket = Date.now() // synthetic ticket for manual trades

  const { data, error } = await supabase.from('trades').insert({
    account_id: account_id ?? null,
    user_id: user.id,
    mt5_ticket,
    symbol,
    direction,
    lot_size,
    entry_price,
    exit_price,
    sl: sl ?? null,
    tp: tp ?? null,
    open_time,
    close_time: final_close_time,
    duration_seconds,
    net_profit,
    gross_profit: net_profit,
    commission: 0,
    swap: 0,
    pips,
    rr_ratio,
    status: 'closed',
    source: 'manual',
    notes: notes ?? null,
    pre_trade_checklist: pre_trade_checklist ?? null,
    emotion_before: emotion_before ?? null,
    emotion_after: emotion_after ?? null,
    rating: rating ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trade: data })
}
