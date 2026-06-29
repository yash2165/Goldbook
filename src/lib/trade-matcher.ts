import { ExecutionLeg } from './csv-parsers'

export interface StandardTrade {
  symbol: string
  direction: 'buy' | 'sell'
  lot_size: number
  entry_price: number
  exit_price?: number | null
  open_time: string
  close_time?: string | null
  net_profit?: number | null
  gross_profit?: number | null
  status: 'open' | 'closed'
  source: 'csv_import'
  instrument_type: 'spot' | 'equity' | 'options' | 'futures'
  option_type?: 'CE' | 'PE' | null
  strike_price?: number | null
  expiry_date?: string | null
  brokerage?: number
  stt?: number
  other_charges?: number
}

// Lot size mapping based on 2026 regulations
const LOT_SIZES: Record<string, number> = {
  NIFTY: 65,
  BANKNIFTY: 30,
  FINNIFTY: 60,
  MIDCPNIFTY: 120,
  SENSEX: 20
}

/**
 * Pairs buy and sell execution legs using a FIFO matching engine.
 */
export function matchTradePairs(legs: ExecutionLeg[]): {
  completedTrades: StandardTrade[]
  openPositions: StandardTrade[]
} {
  const completedTrades: StandardTrade[] = []
  const openPositions: StandardTrade[] = []

  // Group legs by unique contract key
  // Group key: SYMBOL | TYPE | STRIKE | OPTION_TYPE | EXPIRY
  const groups: Record<string, ExecutionLeg[]> = {}
  
  for (const leg of legs) {
    const key = [
      leg.symbol,
      leg.instrument_type,
      leg.strike_price ?? '',
      leg.option_type ?? '',
      leg.expiry_date ?? ''
    ].join('_')
    
    if (!groups[key]) groups[key] = []
    groups[key].push(leg)
  }

  for (const key of Object.keys(groups)) {
    // Sort chronologically
    const sortedLegs = [...groups[key]].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    )

    const buyQueue: ExecutionLeg[] = []
    const sellQueue: ExecutionLeg[] = []

    for (const leg of sortedLegs) {
      if (leg.direction === 'buy') {
        // We have a BUY. Check if we have open SELLs to cover (Short cover)
        let remainingQty = leg.qty
        while (sellQueue.length > 0 && remainingQty > 0) {
          const sellLeg = sellQueue[0]
          const matchQty = Math.min(sellLeg.qty, remainingQty)
          
          // Calculate P&L for this matched chunk
          // Short trade: Entry is SELL rate, Exit is BUY rate
          const grossPnl = calculateLegPnl(
            'sell',
            sellLeg.price,
            leg.price,
            matchQty,
            leg.symbol,
            leg.instrument_type
          )

          const totalCharges = (leg.brokerage ?? 0) + (leg.stt ?? 0) + (leg.other_charges ?? 0)
            + (sellLeg.brokerage ?? 0) + (sellLeg.stt ?? 0) + (sellLeg.other_charges ?? 0)
          
          completedTrades.push({
            symbol: leg.symbol,
            direction: 'sell', // Short position originally
            lot_size: matchQty,
            entry_price: sellLeg.price,
            exit_price: leg.price,
            open_time: sellLeg.trade_date,
            close_time: leg.trade_date,
            gross_profit: grossPnl,
            net_profit: grossPnl - totalCharges,
            status: 'closed',
            source: 'csv_import',
            instrument_type: leg.instrument_type,
            option_type: leg.option_type,
            strike_price: leg.strike_price,
            expiry_date: leg.expiry_date,
            brokerage: (leg.brokerage ?? 0) + (sellLeg.brokerage ?? 0),
            stt: (leg.stt ?? 0) + (sellLeg.stt ?? 0),
            other_charges: (leg.other_charges ?? 0) + (sellLeg.other_charges ?? 0)
          })

          // Reduce quantities
          sellLeg.qty -= matchQty
          remainingQty -= matchQty
          if (sellLeg.qty === 0) sellQueue.shift()
        }

        // If still has remainder BUY qty, push to BUY queue
        if (remainingQty > 0) {
          buyQueue.push({ ...leg, qty: remainingQty })
        }
      } else {
        // We have a SELL. Check if we have open BUYs to close (Long sell)
        let remainingQty = leg.qty
        while (buyQueue.length > 0 && remainingQty > 0) {
          const buyLeg = buyQueue[0]
          const matchQty = Math.min(buyLeg.qty, remainingQty)

          // Calculate P&L
          // Long trade: Entry is BUY rate, Exit is SELL rate
          const grossPnl = calculateLegPnl(
            'buy',
            buyLeg.price,
            leg.price,
            matchQty,
            leg.symbol,
            leg.instrument_type
          )

          const totalCharges = (leg.brokerage ?? 0) + (leg.stt ?? 0) + (leg.other_charges ?? 0)
            + (buyLeg.brokerage ?? 0) + (buyLeg.stt ?? 0) + (buyLeg.other_charges ?? 0)

          completedTrades.push({
            symbol: leg.symbol,
            direction: 'buy', // Long position originally
            lot_size: matchQty,
            entry_price: buyLeg.price,
            exit_price: leg.price,
            open_time: buyLeg.trade_date,
            close_time: leg.trade_date,
            gross_profit: grossPnl,
            net_profit: grossPnl - totalCharges,
            status: 'closed',
            source: 'csv_import',
            instrument_type: leg.instrument_type,
            option_type: leg.option_type,
            strike_price: leg.strike_price,
            expiry_date: leg.expiry_date,
            brokerage: (leg.brokerage ?? 0) + (buyLeg.brokerage ?? 0),
            stt: (leg.stt ?? 0) + (buyLeg.stt ?? 0),
            other_charges: (leg.other_charges ?? 0) + (buyLeg.other_charges ?? 0)
          })

          // Reduce quantities
          buyLeg.qty -= matchQty
          remainingQty -= matchQty
          if (buyLeg.qty === 0) buyQueue.shift()
        }

        // If still has remainder SELL qty, push to SELL queue
        if (remainingQty > 0) {
          sellQueue.push({ ...leg, qty: remainingQty })
        }
      }
    }

    // Remaining items in queues are open positions
    for (const openLeg of buyQueue) {
      openPositions.push({
        symbol: openLeg.symbol,
        direction: 'buy',
        lot_size: openLeg.qty,
        entry_price: openLeg.price,
        exit_price: null,
        open_time: openLeg.trade_date,
        close_time: null,
        status: 'open',
        source: 'csv_import',
        instrument_type: openLeg.instrument_type,
        option_type: openLeg.option_type,
        strike_price: openLeg.strike_price,
        expiry_date: openLeg.expiry_date,
        brokerage: openLeg.brokerage ?? 0,
        stt: openLeg.stt ?? 0,
        other_charges: openLeg.other_charges ?? 0
      })
    }

    for (const openLeg of sellQueue) {
      openPositions.push({
        symbol: openLeg.symbol,
        direction: 'sell',
        lot_size: openLeg.qty,
        entry_price: openLeg.price,
        exit_price: null,
        open_time: openLeg.trade_date,
        close_time: null,
        status: 'open',
        source: 'csv_import',
        instrument_type: openLeg.instrument_type,
        option_type: openLeg.option_type,
        strike_price: openLeg.strike_price,
        expiry_date: openLeg.expiry_date,
        brokerage: openLeg.brokerage ?? 0,
        stt: openLeg.stt ?? 0,
        other_charges: openLeg.other_charges ?? 0
      })
    }
  }

  return { completedTrades, openPositions }
}

/**
 * Calculates correct P&L based on market math.
 */
function calculateLegPnl(
  direction: 'buy' | 'sell',
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  symbol: string,
  instrument_type: string
): number {
  const priceDiff = direction === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice
  
  if (instrument_type === 'options' || instrument_type === 'futures') {
    // For F&O: Quantity is number of contracts. 
    // In index options, lot size multiplier applies. e.g. 65 for Nifty.
    const cleanSym = symbol.toUpperCase()
    const lotMultiplier = LOT_SIZES[cleanSym] ?? 1 // If stock option, quantity is already absolute shares
    return parseFloat((priceDiff * quantity * lotMultiplier).toFixed(2))
  }
  
  // Equity: quantity is absolute shares
  return parseFloat((priceDiff * quantity).toFixed(2))
}
