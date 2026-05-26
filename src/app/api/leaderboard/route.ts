import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // 1. Query all closed trades with their owner's username and avatar
    const { data: trades, error: tradesError } = await supabaseAdmin
      .from('trades')
      .select('user_id, symbol, net_profit, profiles(username, avatar_url)')
      .eq('status', 'closed')

    if (tradesError) {
      console.error('Error fetching trades for leaderboard:', tradesError)
      return NextResponse.json({ error: tradesError.message }, { status: 500 })
    }

    if (!trades || trades.length === 0) {
      return NextResponse.json([])
    }

    // 2. Aggregate telemetry per user
    const byUser: Record<string, {
      username: string;
      avatar_url: string;
      pnl: number;
      trades: number;
      wins: number;
      instruments: Record<string, number>;
    }> = {}

    for (const t of trades as any[]) {
      const uid = t.user_id
      if (!uid) continue

      if (!byUser[uid]) {
        byUser[uid] = {
          username: t.profiles?.username ?? 'Anonymous',
          avatar_url: t.profiles?.avatar_url ?? '',
          pnl: 0,
          trades: 0,
          wins: 0,
          instruments: {}
        }
      }

      const pnlVal = Number(t.net_profit ?? 0)
      byUser[uid].pnl += pnlVal
      byUser[uid].trades++
      if (pnlVal > 0) {
        byUser[uid].wins++
      }

      const sym = t.symbol || 'XAUUSD'
      byUser[uid].instruments[sym] = (byUser[uid].instruments[sym] || 0) + 1
    }

    // 3. Map aggregates to final standings and compute metrics
    const sorted = Object.entries(byUser)
      .map(([uid, v]) => {
        // Determine the most traded instrument
        let mostTraded = 'XAUUSD'
        let maxCount = 0
        Object.entries(v.instruments).forEach(([sym, count]) => {
          if (count > maxCount) {
            maxCount = count
            mostTraded = sym
          }
        })

        const winRate = v.trades > 0 ? Math.round((v.wins / v.trades) * 100) : 0

        return {
          uid,
          username: v.username,
          avatar_url: v.avatar_url,
          pnl: v.pnl,
          trades: v.trades,
          winRate,
          mostTraded
        }
      })
      // Sort by PnL descending (highest gains first)
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 25) // Top 25 leaderboard standings

    return NextResponse.json(sorted)

  } catch (error: any) {
    console.error('Leaderboard API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
