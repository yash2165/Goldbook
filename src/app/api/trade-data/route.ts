import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const secret = req.headers.get('worker_secret') || ''
  
  const body = await req.json()
  const { worker_secret } = body

  // Check against env variable
  if (worker_secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (body.type === 'account') {
    const { account_id, balance, equity } = body
    
    // Get existing account to check initial_balance
    const { data: existing } = await supabase.from('mt5_accounts').select('initial_balance').eq('id', account_id).single()
    
    // Update account balances
    await supabase.from('mt5_accounts').update({
      current_balance: balance,
      current_equity: equity,
      is_verified: true,
      ...(existing?.initial_balance == null ? { initial_balance: balance } : {}),
      last_synced_at: new Date().toISOString()
    }).eq('id', account_id)

    // Create equity snapshot
    await supabase.from('equity_snapshots').insert({
      account_id,
      balance,
      equity,
      floating_pnl: equity - balance
    })

    return NextResponse.json({ success: true })
  }

  if (body.type === 'account_error') {
    const { account_id } = body
    
    // Mark as failed verification and disable
    await supabase.from('mt5_accounts').update({
      is_verified: false,
      is_active: false
    }).eq('id', account_id)

    return NextResponse.json({ success: true })
  }

  if (body.type === 'trades') {
    const { trades } = body
    
    // Upsert trades
    const { error } = await supabase.from('trades').upsert(trades, {
      onConflict: 'account_id, mt5_ticket'
    })

    if (error) {
      console.error('Error upserting trades:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: trades.length })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
