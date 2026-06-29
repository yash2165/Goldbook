import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lot sizes for index F&O mapping
const LOT_SIZES: Record<string, number> = {
  NIFTY: 65,
  BANKNIFTY: 30,
  FINNIFTY: 60,
  MIDCPNIFTY: 120,
  SENSEX: 20
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      tradeId,
      symbol,
      direction,
      lot_size,
      entry_price,
      exit_price,
      open_time,
      close_time,
      sl,
      tp,
      notes,
      pre_trade_checklist,
      emotion_before,
      emotion_after,
      rating,
      instrument_type,
      option_type,
      strike_price,
      expiry_date,
      brokerage,
      stt,
      other_charges,
      manual_pnl,
      currency
    } = body

    if (!tradeId) {
      return NextResponse.json({ error: 'Trade ID is required' }, { status: 400 })
    }

    // 1. Load the trade and verify ownership + manual source
    const { data: trade, error: fetchError } = await supabase
      .from('trades')
      .select('id, user_id, source')
      .eq('id', tradeId)
      .single()

    if (fetchError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    if (trade.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (trade.source !== 'manual') {
      return NextResponse.json({ error: 'Only manually logged trades can be edited' }, { status: 400 })
    }

    // 2. Perform recalculations
    const cleanSymbol = symbol ? symbol.toUpperCase() : ''
    const cleanDirection = direction === 'buy' ? 'buy' : 'sell'
    const cleanQty = lot_size ? parseFloat(lot_size) : 0
    const cleanEntry = entry_price ? parseFloat(entry_price) : 0
    const cleanExit = exit_price ? parseFloat(exit_price) : null
    const isClosed = cleanExit !== null && cleanExit > 0

    let net_profit: number | null = null
    let gross_profit: number | null = null
    let pips: number | null = null

    // P&L Recalculation
    if (cleanEntry && isClosed && cleanQty) {
      const parsedExit = cleanExit as number
      
      if (manual_pnl !== undefined && manual_pnl !== null && manual_pnl !== '') {
        // Direct manual override
        gross_profit = parseFloat(manual_pnl)
        net_profit = gross_profit - (brokerage ? parseFloat(brokerage) : 0) - (stt ? parseFloat(stt) : 0) - (other_charges ? parseFloat(other_charges) : 0)
      } else {
        // Automated calculations based on segment
        const priceDiff = cleanDirection === 'buy' ? parsedExit - cleanEntry : cleanEntry - parsedExit
        
        if (currency === 'INR') {
          // Indian Markets F&O vs Equity
          if (instrument_type === 'options' || instrument_type === 'futures') {
            const lotMultiplier = LOT_SIZES[cleanSymbol] ?? 1 // if stock options, qty is already absolute shares
            gross_profit = parseFloat((priceDiff * cleanQty * lotMultiplier).toFixed(2))
          } else {
            // Equity
            gross_profit = parseFloat((priceDiff * cleanQty).toFixed(2))
          }
          
          net_profit = gross_profit - (brokerage ? parseFloat(brokerage) : 0) - (stt ? parseFloat(stt) : 0) - (other_charges ? parseFloat(other_charges) : 0)
        } else {
          // Forex Math
          if (cleanSymbol === 'XAUUSD') {
            pips = parseFloat((priceDiff * 10).toFixed(1))
            gross_profit = parseFloat((priceDiff * cleanQty * 100).toFixed(2))
          } else {
            pips = parseFloat((priceDiff * 10000).toFixed(1))
            gross_profit = parseFloat((priceDiff * cleanQty * 100000).toFixed(2))
          }
          net_profit = gross_profit
        }
      }
    }

    // Duration in seconds
    let duration_seconds: number | null = null
    if (isClosed && open_time && close_time) {
      duration_seconds = Math.max(0, Math.floor(
        (new Date(close_time).getTime() - new Date(open_time).getTime()) / 1000
      ))
    }

    // R:R Ratio
    let rr_ratio: number | null = null
    if (sl && tp && cleanEntry) {
      const risk = Math.abs(cleanEntry - parseFloat(sl))
      const reward = Math.abs(parseFloat(tp) - cleanEntry)
      if (risk > 0) rr_ratio = parseFloat((reward / risk).toFixed(2))
    }

    // 3. Update the database record
    const { data: updatedTrade, error: updateError } = await supabase
      .from('trades')
      .update({
        symbol: cleanSymbol,
        direction: cleanDirection,
        lot_size: cleanQty,
        entry_price: cleanEntry,
        exit_price: isClosed ? cleanExit : null,
        sl: sl ? parseFloat(sl) : null,
        tp: tp ? parseFloat(tp) : null,
        open_time: open_time ? new Date(open_time).toISOString() : null,
        close_time: isClosed && close_time ? new Date(close_time).toISOString() : null,
        duration_seconds,
        net_profit: isClosed ? net_profit : null,
        gross_profit: isClosed ? gross_profit : null,
        pips,
        rr_ratio,
        status: isClosed ? 'closed' : 'open',
        notes: notes ?? null,
        pre_trade_checklist: pre_trade_checklist ?? null,
        emotion_before: emotion_before ?? null,
        emotion_after: emotion_after ?? null,
        rating: rating ? parseInt(rating) : null,
        instrument_type: instrument_type || 'spot',
        option_type: option_type ?? null,
        strike_price: strike_price ? parseFloat(strike_price) : null,
        expiry_date: expiry_date || null,
        brokerage: brokerage ? parseFloat(brokerage) : 0,
        stt: stt ? parseFloat(stt) : 0,
        other_charges: other_charges ? parseFloat(other_charges) : 0,
        currency: currency || 'USD'
      })
      .eq('id', tradeId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, trade: updatedTrade })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'An error occurred during update.' }, { status: 500 })
  }
}
