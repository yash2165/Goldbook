import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { sync_token, type } = body

  if (!sync_token) {
    return NextResponse.json({ error: 'Missing sync_token' }, { status: 400 })
  }

  // Authenticate via sync_token — resolves to the account row
  const { data: account, error: accErr } = await supabase
    .from('mt5_accounts')
    .select('id, user_id, initial_balance, is_active')
    .eq('sync_token', sync_token)
    .single()

  if (accErr || !account) {
    return NextResponse.json({ error: 'Invalid sync_token' }, { status: 401 })
  }

  if (!account.is_active) {
    return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
  }

  // ── Account balance ──────────────────────────────────────────────────────
  if (type === 'account') {
    const { balance, equity, margin, free_margin } = body

    // Only set initial_balance on the very first successful sync (or if it is 0)
    const extra = (account.initial_balance == null || account.initial_balance === 0) ? { initial_balance: balance } : {}

    const { error } = await supabase
      .from('mt5_accounts')
      .update({
        current_balance: balance,
        current_equity: equity,
        is_verified: true,
        last_error: null,
        last_synced_at: new Date().toISOString(),
        ...extra,
      })
      .eq('id', account.id)

    if (error) {
      console.error('account update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Equity snapshot for the curve
    await supabase.from('equity_snapshots').insert({
      account_id: account.id,
      balance,
      equity,
      floating_pnl: equity - balance,
    })

    return NextResponse.json({ success: true })
  }

  // ── Closed trades ────────────────────────────────────────────────────────
  // NOTE: position_id is the stable identifier that links an open position
  // to its closing deal. mt5_ticket differs between the two, so we use
  // position_id as the upsert key to UPDATE the existing row instead of
  // inserting a duplicate.
  if (type === 'trades') {
    const { trades } = body as { trades: any[] }
    if (!trades?.length) return NextResponse.json({ success: true, count: 0 })

    const rows = trades.map((t) => ({
      account_id:   account.id,
      user_id:      account.user_id,
      position_id:  t.position_id,          // stable key — same for open & closed
      mt5_ticket:   t.mt5_ticket,           // the closing deal ticket (OUT)
      symbol:       t.symbol,
      direction:    t.direction,
      lot_size:     t.lot_size,
      entry_price:  t.entry_price,
      exit_price:   t.exit_price ?? null,
      open_time:    t.open_time  ? new Date(t.open_time  * 1000).toISOString() : null,
      close_time:   t.close_time ? new Date(t.close_time * 1000).toISOString() : null,
      gross_profit: t.gross_profit ?? null,
      commission:   t.commission ?? 0,
      swap:         t.swap ?? 0,
      net_profit:   t.net_profit ?? null,
      status:       'closed',
      source:       'mt5',
    }))

    const { error } = await supabase
      .from('trades')
      .upsert(rows, { onConflict: 'account_id,position_id', ignoreDuplicates: false })

    if (error) {
      console.error('trades upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: rows.length })
  }

  // ── Open positions ────────────────────────────────────────────────────────
  if (type === 'positions') {
    const { positions } = body as { positions: any[] }

    if (positions?.length > 0) {
      // Use position_id (stable) to detect which open positions are gone
      const openPositionIds = positions.map((p) => p.position_id)

      // Any open row whose position_id is no longer in the live list = closed
      await supabase
        .from('trades')
        .update({ status: 'closed' })
        .eq('account_id', account.id)
        .eq('status', 'open')
        .not('position_id', 'in', `(${openPositionIds.join(',')})`)

      const rows = positions.map((p) => ({
        account_id:  account.id,
        user_id:     account.user_id,
        position_id: p.position_id,         // stable identifier for upsert
        mt5_ticket:  p.mt5_ticket,          // position ticket (same as position_id in MT5)
        symbol:      p.symbol,
        direction:   p.direction,
        lot_size:    p.lot_size,
        entry_price: p.entry_price,
        sl:          p.sl   || null,
        tp:          p.tp   || null,
        net_profit:  p.net_profit,
        commission:  p.commission ?? 0,
        swap:        p.swap ?? 0,
        open_time:   p.open_time ? new Date(p.open_time * 1000).toISOString() : null,
        status:      'open',
        source:      'mt5',
      }))

      const { error } = await supabase
        .from('trades')
        .upsert(rows, { onConflict: 'account_id,position_id', ignoreDuplicates: false })

      if (error) {
        console.error('positions upsert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      // Empty positions list → all open trades for this account are now closed
      await supabase
        .from('trades')
        .update({ status: 'closed' })
        .eq('account_id', account.id)
        .eq('status', 'open')
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
