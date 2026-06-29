import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { trades } = body // Array of StandardTrade objects

    if (!Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ error: 'Invalid trades payload' }, { status: 400 })
    }

    // Find min/max time to load database trades for deduplication
    const times = trades.map(t => new Date(t.open_time).getTime())
    const minTime = new Date(Math.min(...times) - 86400000).toISOString() // 1 day buffer
    const maxTime = new Date(Math.max(...times) + 86400000).toISOString() // 1 day buffer

    // Fetch existing trades in that window
    const { data: existing } = await supabase
      .from('trades')
      .select('symbol, direction, lot_size, entry_price, open_time')
      .eq('user_id', user.id)
      .gte('open_time', minTime)
      .lte('open_time', maxTime)

    const existingMap = new Set(
      (existing || []).map(e => {
        const timeKey = new Date(e.open_time).getTime()
        const qtyKey = Number(e.lot_size).toFixed(4)
        const priceKey = Number(e.entry_price).toFixed(4)
        return `${e.symbol.toUpperCase()}_${e.direction}_${qtyKey}_${priceKey}_${timeKey}`
      })
    )

    // Filter out duplicates and prepare insert payload
    const toInsert = trades
      .filter(t => {
        const timeKey = new Date(t.open_time).getTime()
        const qtyKey = Number(t.lot_size).toFixed(4)
        const priceKey = Number(t.entry_price).toFixed(4)
        const key = `${t.symbol.toUpperCase()}_${t.direction}_${qtyKey}_${priceKey}_${timeKey}`
        return !existingMap.has(key)
      })
      .map(t => {
        // Calculate duration
        let duration_seconds: number | null = null
        if (t.status === 'closed' && t.open_time && t.close_time) {
          duration_seconds = Math.max(0, Math.floor(
            (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 1000
          ))
        }

        // RR ratio calculation if target/SL provided
        let rr_ratio: number | null = null
        if (t.sl && t.tp && t.entry_price) {
          const risk = Math.abs(t.entry_price - t.sl)
          const reward = Math.abs(t.tp - t.entry_price)
          if (risk > 0) rr_ratio = parseFloat((reward / risk).toFixed(2))
        }

        // Generate a synthetic position ID for manual trades to satisfy check constraints
        const syntheticPositionId = -Math.floor(Date.now() + Math.random() * 100000)
        const mt5_ticket = Date.now() + Math.floor(Math.random() * 1000)

        return {
          user_id: user.id,
          position_id: syntheticPositionId,
          mt5_ticket,
          symbol: t.symbol.toUpperCase(),
          direction: t.direction,
          lot_size: t.lot_size,
          entry_price: t.entry_price,
          exit_price: t.exit_price ?? null,
          open_time: t.open_time,
          close_time: t.close_time ?? null,
          duration_seconds,
          net_profit: t.net_profit ?? null,
          gross_profit: t.gross_profit ?? null,
          commission: 0,
          swap: 0,
          status: t.status,
          source: 'manual', // Set source as manual so they are fully editable
          instrument_type: t.instrument_type || 'equity',
          option_type: t.option_type ?? null,
          strike_price: t.strike_price ?? null,
          expiry_date: t.expiry_date ?? null,
          brokerage: t.brokerage ?? 0,
          stt: t.stt ?? 0,
          other_charges: t.other_charges ?? 0,
          currency: 'INR',
          rr_ratio
        }
      })

    if (toInsert.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'All trades in CSV are already imported.' })
    }

    const { data, error } = await supabase.from('trades').insert(toInsert).select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: toInsert.length, trades: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'An error occurred during bulk import parsing.' }, { status: 500 })
  }
}
