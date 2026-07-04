import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { report, broker = 'angel_one' } = body

    if (!report) {
      return NextResponse.json({ error: 'Report payload missing' }, { status: 400 })
    }

    // 1. Insert into tax_pnl_reports table
    const { data: reportRow, error: reportErr } = await supabase
      .from('tax_pnl_reports')
      .insert({
        user_id: user.id,
        broker,
        client_name: report.client_name || null,
        client_id: report.client_id || null,
        pan: report.pan || null,
        financial_year: report.financial_year || null,
        from_date: report.from_date || null,
        to_date: report.to_date || null,
        ledger_opening_balance: report.ledger_opening_balance || 0,
        ledger_closing_balance: report.ledger_closing_balance || 0,
        total_taxable_pnl: report.total_taxable_pnl || 0,
        delivery_ltcg_pnl: report.delivery_ltcg_pnl || 0,
        delivery_stcg_pnl: report.delivery_stcg_pnl || 0,
        intraday_speculative_pnl: report.intraday_speculative_pnl || 0,
        futures_pnl: report.futures_pnl || 0,
        options_pnl: report.options_pnl || 0,
        futures_turnover: report.futures_turnover || 0,
        options_turnover: report.options_turnover || 0,
        total_charges: report.total_charges || 0,
        total_stt: report.total_stt || 0,
        additional_brokerage: report.additional_brokerage || 0,
        non_trade_dp_charges: report.non_trade_dp_charges || 0,
        non_trade_amc_charges: report.non_trade_amc_charges || 0,
        non_trade_interest_charges: report.non_trade_interest_charges || 0,
        raw_json: report
      })
      .select()
      .single()

    if (reportErr) {
      console.error('Tax report insert error:', reportErr)
      return NextResponse.json({ error: reportErr.message }, { status: 500 })
    }

    // 2. Insert any parsed trades if present
    let insertedTradesCount = 0
    if (Array.isArray(report.trades) && report.trades.length > 0) {
      const toInsert = report.trades.map((t: any) => ({
        user_id: user.id,
        symbol: t.symbol || 'NIFTY',
        direction: t.direction || 'buy',
        instrument_type: t.instrument_type || 'options',
        lot_size: t.lot_size || 1,
        entry_price: t.entry_price || 0,
        exit_price: t.exit_price || 0,
        net_profit: t.net_profit || 0,
        status: 'closed',
        open_time: t.open_time ? new Date(t.open_time).toISOString() : new Date().toISOString(),
        close_time: t.close_time ? new Date(t.close_time).toISOString() : new Date().toISOString(),
        notes: t.notes || `Tax P&L Import (${broker})`
      }))

      const { data: inserted, error: tradesErr } = await supabase
        .from('trades')
        .insert(toInsert)
        .select('id')

      if (!tradesErr && inserted) {
        insertedTradesCount = inserted.length
      }
    }

    return NextResponse.json({
      success: true,
      reportId: reportRow.id,
      insertedTradesCount
    })
  } catch (err: any) {
    console.error('Tax report import error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
