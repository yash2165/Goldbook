/**
 * calculations.ts
 * All pure math functions for trade analytics.
 * Zero side effects — takes raw trade arrays, returns computed stats.
 */

export interface Trade {
  id: string
  symbol: string
  direction: 'buy' | 'sell'
  lot_size: number | null
  entry_price: number | null
  exit_price: number | null
  open_time: string | null
  close_time: string | null
  net_profit: number | null
  gross_profit: number | null
  commission: number | null
  swap: number | null
  pips: number | null
  rr_ratio: number | null
  status: 'open' | 'closed'
  source: 'mt5' | 'manual'
  emotion_before?: string | null
  emotion_after?: string | null
  rating?: number | null
  setup_tag?: string | null
  notes?: string | null
  followed_plan?: boolean | null
  pre_trade_checklist?: Record<string, boolean> | null
  duration_seconds?: number | null
}

export interface PerformanceStats {
  totalPnl: number
  realizedPnl: number
  unrealizedPnl: number
  winRate: number
  totalTrades: number
  openTrades: number
  closedTrades: number
  winningTrades: number
  losingTrades: number
  profitFactor: number
  expectancy: number
  avgWin: number
  avgLoss: number
  bestTrade: number
  worstTrade: number
  winStreak: number
  lossStreak: number
  currentStreak: number
  avgRR: number
  totalCommissions: number
  longTrades: number
  shortTrades: number
  longWinRate: number
  shortWinRate: number
  longPnl: number
  shortPnl: number
  maxDrawdown: number
  maxDrawdownPct: number
}

export interface SessionStat {
  trades: number
  winRate: number
  avgTrade: number
  volume: number
  pnl: number
}

export interface DayStat {
  day: string
  trades: number
  pnl: number
  winRate: number
}

export function getClosedTrades(trades: Trade[]): Trade[] {
  return trades.filter(t => t.status === 'closed' && t.net_profit !== null)
}

export function getOpenTrades(trades: Trade[]): Trade[] {
  return trades.filter(t => t.status === 'open')
}

export function computeStats(trades: Trade[]): PerformanceStats {
  const closed = getClosedTrades(trades)
  const open = getOpenTrades(trades)

  const wins = closed.filter(t => (t.net_profit ?? 0) > 0)
  const losses = closed.filter(t => (t.net_profit ?? 0) <= 0)

  const totalPnl = closed.reduce((s, t) => s + (t.net_profit ?? 0), 0)
  const unrealizedPnl = open.reduce((s, t) => s + (t.net_profit ?? 0), 0)

  const grossWins = wins.reduce((s, t) => s + (t.net_profit ?? 0), 0)
  const grossLosses = Math.abs(losses.reduce((s, t) => s + (t.net_profit ?? 0), 0))

  const avgWin = wins.length > 0 ? grossWins / wins.length : 0
  const avgLoss = losses.length > 0 ? grossLosses / losses.length : 0
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0
  const expectancy = avgWin * (winRate / 100) - avgLoss * (1 - winRate / 100)

  const profits = closed.map(t => t.net_profit ?? 0)
  const bestTrade = profits.length > 0 ? Math.max(...profits) : 0
  const worstTrade = profits.length > 0 ? Math.min(...profits) : 0

  // Streaks
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0, current = 0
  for (const t of closed) {
    if ((t.net_profit ?? 0) > 0) {
      curWin++; curLoss = 0
      maxWin = Math.max(maxWin, curWin)
    } else {
      curLoss++; curWin = 0
      maxLoss = Math.max(maxLoss, curLoss)
    }
  }
  if (closed.length > 0) {
    const last = closed[closed.length - 1]
    current = (last.net_profit ?? 0) > 0 ? curWin : -curLoss
  }

  // Long vs short
  const longs = closed.filter(t => t.direction === 'buy')
  const shorts = closed.filter(t => t.direction === 'sell')
  const longWins = longs.filter(t => (t.net_profit ?? 0) > 0)
  const shortWins = shorts.filter(t => (t.net_profit ?? 0) > 0)

  // Max drawdown from equity curve
  const { maxDrawdown, maxDrawdownPct } = computeMaxDrawdown(closed)

  const totalCommissions = closed.reduce((s, t) => s + Math.abs(t.commission ?? 0), 0)

  const rrValues = closed.filter(t => t.rr_ratio !== null).map(t => t.rr_ratio!)
  const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0

  return {
    totalPnl,
    realizedPnl: totalPnl,
    unrealizedPnl,
    winRate,
    totalTrades: closed.length,
    openTrades: open.length,
    closedTrades: closed.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    profitFactor,
    expectancy,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
    winStreak: maxWin,
    lossStreak: maxLoss,
    currentStreak: current,
    avgRR,
    totalCommissions,
    longTrades: longs.length,
    shortTrades: shorts.length,
    longWinRate: longs.length > 0 ? (longWins.length / longs.length) * 100 : 0,
    shortWinRate: shorts.length > 0 ? (shortWins.length / shorts.length) * 100 : 0,
    longPnl: longs.reduce((s, t) => s + (t.net_profit ?? 0), 0),
    shortPnl: shorts.reduce((s, t) => s + (t.net_profit ?? 0), 0),
    maxDrawdown,
    maxDrawdownPct,
  }
}

export function computeEquityCurve(trades: Trade[], initialBalance = 0): { time: string; equity: number; drawdown: number }[] {
  const closed = getClosedTrades(trades).sort((a, b) =>
    new Date(a.close_time!).getTime() - new Date(b.close_time!).getTime()
  )

  let equity = initialBalance
  let peak = initialBalance
  const curve: { time: string; equity: number; drawdown: number }[] = []

  for (const t of closed) {
    equity += t.net_profit ?? 0
    peak = Math.max(peak, equity)
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0
    curve.push({
      time: t.close_time!.split('T')[0],
      equity: parseFloat(equity.toFixed(2)),
      drawdown: parseFloat(drawdown.toFixed(2)),
    })
  }

  return curve
}

export function computeMaxDrawdown(trades: Trade[]): { maxDrawdown: number; maxDrawdownPct: number } {
  let peak = 0, equity = 0, maxDrawdown = 0, maxDrawdownPct = 0
  for (const t of trades) {
    equity += t.net_profit ?? 0
    peak = Math.max(peak, equity)
    const dd = peak - equity
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0
    if (dd > maxDrawdown) { maxDrawdown = dd; maxDrawdownPct = ddPct }
  }
  return { maxDrawdown, maxDrawdownPct }
}

/** Determine trading session from UTC open time */
export function getSession(utcHour: number): 'Asian' | 'London' | 'New York' {
  if (utcHour >= 0 && utcHour < 8) return 'Asian'
  if (utcHour >= 8 && utcHour < 13) return 'London'
  return 'New York'
}

export function computeSessionStats(trades: Trade[]): Record<string, SessionStat> {
  const closed = getClosedTrades(trades)
  const sessions: Record<string, Trade[]> = { Asian: [], London: [], 'New York': [] }

  for (const t of closed) {
    if (!t.open_time) continue
    const hour = new Date(t.open_time).getUTCHours()
    const sess = getSession(hour)
    sessions[sess].push(t)
  }

  const result: Record<string, SessionStat> = {}
  for (const [name, ts] of Object.entries(sessions)) {
    const wins = ts.filter(t => (t.net_profit ?? 0) > 0)
    const pnl = ts.reduce((s, t) => s + (t.net_profit ?? 0), 0)
    result[name] = {
      trades: ts.length,
      winRate: ts.length > 0 ? (wins.length / ts.length) * 100 : 0,
      avgTrade: ts.length > 0 ? pnl / ts.length : 0,
      volume: ts.reduce((s, t) => s + (t.lot_size ?? 0), 0),
      pnl,
    }
  }
  return result
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function computeDayStats(trades: Trade[]): DayStat[] {
  const closed = getClosedTrades(trades)
  const days: Record<number, Trade[]> = {}

  for (const t of closed) {
    if (!t.close_time) continue
    const day = new Date(t.close_time).getDay()
    if (!days[day]) days[day] = []
    days[day].push(t)
  }

  return [1, 2, 3, 4, 5].map(d => {
    const ts = days[d] ?? []
    const wins = ts.filter(t => (t.net_profit ?? 0) > 0)
    const pnl = ts.reduce((s, t) => s + (t.net_profit ?? 0), 0)
    return {
      day: DAY_NAMES[d],
      trades: ts.length,
      pnl,
      winRate: ts.length > 0 ? (wins.length / ts.length) * 100 : 0,
    }
  })
}

/** Group trades by calendar date for heatmap */
export function computeDailyPnl(trades: Trade[]): Record<string, number> {
  const closed = getClosedTrades(trades)
  const daily: Record<string, number> = {}
  for (const t of closed) {
    if (!t.close_time) continue
    const date = t.close_time.split('T')[0]
    daily[date] = (daily[date] ?? 0) + (t.net_profit ?? 0)
  }
  return daily
}

export function computeTopSymbols(trades: Trade[]): { symbol: string; pnl: number; trades: number; winRate: number }[] {
  const closed = getClosedTrades(trades)
  const bySymbol: Record<string, Trade[]> = {}
  for (const t of closed) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = []
    bySymbol[t.symbol].push(t)
  }
  return Object.entries(bySymbol)
    .map(([symbol, ts]) => {
      const wins = ts.filter(t => (t.net_profit ?? 0) > 0)
      return {
        symbol,
        pnl: ts.reduce((s, t) => s + (t.net_profit ?? 0), 0),
        trades: ts.length,
        winRate: ts.length > 0 ? (wins.length / ts.length) * 100 : 0,
      }
    })
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
}

export function fmt(val: number, showSign = true): string {
  const sign = val >= 0 ? '+' : ''
  return `${showSign ? sign : ''}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtPct(val: number): string {
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(1)}%`
}
