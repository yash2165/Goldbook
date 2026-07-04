import { parseNSEDerivativesSymbol } from './csv-parsers'
import { StandardTrade, matchTradePairs } from './trade-matcher'
import { ExecutionLeg } from './csv-parsers'

export interface AngelOneTaxSummary {
  client_name: string
  client_id: string
  pan: string
  financial_year: string
  from_date: string
  to_date: string
  ledger_opening_balance: number
  ledger_closing_balance: number
  total_taxable_pnl: number
  delivery_ltcg_pnl: number
  delivery_stcg_pnl: number
  intraday_speculative_pnl: number
  futures_pnl: number
  options_pnl: number
  futures_turnover: number
  options_turnover: number
  total_charges: number
  total_stt: number
  additional_brokerage: number
  non_trade_dp_charges: number
  non_trade_amc_charges: number
  non_trade_interest_charges: number
  trades: StandardTrade[]
}

function cleanDateString(str: string): string {
  if (!str) return ''
  const isoMatch = str.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (isoMatch) return isoMatch[1]

  const slashMatch = str.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/)
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`

  try {
    const firstPart = str.trim().split(/\s+/)[0]
    const d = new Date(firstPart)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  } catch {}

  return ''
}

/**
 * Parses raw text extracted from Angel One P&L Tax PDF, TradeBook PDF or CSV exports.
 */
export function parseAngelOneTaxReportText(rawText: string): AngelOneTaxSummary {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)

  const getValue = (pattern: RegExp, defaultVal = 0): number => {
    for (const line of lines) {
      if (pattern.test(line)) {
        const match = line.match(/[-+]?\d*\.?\d+/)
        if (match) return parseFloat(match[0])
      }
    }
    return defaultVal
  }

  const getString = (pattern: RegExp, defaultVal = ''): string => {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        const parts = lines[i].split(/\s{2,}|\t|:/)
        if (parts.length > 1 && parts[parts.length - 1].trim()) {
          return parts[parts.length - 1].trim()
        }
        if (lines[i + 1]) return lines[i + 1].trim()
      }
    }
    return defaultVal
  }

  // 1. Client Basic Information & Metadata
  const client_name = getString(/Client Name/i, 'Trader')
  const client_id = getString(/ClientCode|Client Id|Client Code/i, '')
  const pan = getString(/PAN/i, '')

  // 2. Date Range
  const financial_year = getString(/Financial Year/i, '2026-2027')
  let from_date = ''
  let to_date = ''
  const dateMatches = rawText.match(/\b(\d{4}-\d{2}-\d{2})\b/g)
  if (dateMatches && dateMatches.length >= 2) {
    from_date = dateMatches[0]
    to_date = dateMatches[1]
  } else {
    from_date = cleanDateString(getString(/From Date|StartDate/i, ''))
    to_date = cleanDateString(getString(/To Date|EndDate/i, ''))
  }

  // 3. Ledger Balances & Summaries
  const ledger_opening_balance = getValue(/Ledger Opening/i, 0)
  const ledger_closing_balance = getValue(/Ledger Closing/i, 0)

  // 4. P&L & Charges Summaries
  let total_taxable_pnl = getValue(/Total Taxable P&L/i, 0)
  const delivery_ltcg_pnl = getValue(/Taxable Delivery P&L.*LTCG/i, 0)
  const delivery_stcg_pnl = getValue(/Taxable Delivery P&L.*STCG/i, 0)
  const intraday_speculative_pnl = getValue(/Taxable Intraday/i, 0)
  const futures_pnl = getValue(/Taxable Futures P&L/i, 0)
  const options_pnl = getValue(/Taxable Options P&L/i, 0)
  
  const futures_turnover = getValue(/Future Turnover/i, 0)
  const options_turnover = getValue(/Options Turnover/i, 0)

  const total_charges = getValue(/Total Charges/i, 0)
  const total_stt = getValue(/\bSTT\b/i, 0)
  const additional_brokerage = getValue(/Brokerage/i, 0)

  const non_trade_dp_charges = getValue(/Total DP Charges|DP Charges/i, 0)
  const non_trade_amc_charges = getValue(/Account Maintenance|Monthly Account Maintenance/i, 0)
  const non_trade_interest_charges = getValue(/Interest Charges/i, 0)

  const trades: StandardTrade[] = []
  const executionLegs: ExecutionLeg[] = []

  // Extract TradeBook Execution Legs (Official Angel One TradeBook PDF/Excel format)
  // Example line: OPTIDX BANKNIFTY Mar 30 2026 61000.00 CE (BT) Buy 889.8
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check Angel One TradeBook contract line pattern
    const tbMatch = line.match(/(OPTIDX|OPTSTK|FUTIDX|FUTSTK)\s+([A-Z0-9]+)\s+([A-Za-z]{3}\s+\d{1,2}\s+\d{4})\s*(?:(\d+(?:\.\d+)?)\s+(CE|PE))?\s*(?:\([^)]*\))?\s+(Buy|Sell)\s+([-+]?\d*\.?\d+)/i)
    if (tbMatch) {
      const typePrefix = tbMatch[1].toUpperCase()
      const symbol = tbMatch[2].toUpperCase()
      const expiryStr = tbMatch[3]
      const strike = tbMatch[4] ? parseFloat(tbMatch[4]) : null
      const optType = tbMatch[5] ? (tbMatch[5].toUpperCase() as 'CE' | 'PE') : null
      const dir = tbMatch[6].toLowerCase() === 'buy' ? 'buy' : 'sell'
      const price = parseFloat(tbMatch[7]) || 0

      // Look in current or next lines for quantity number (e.g. 30, 65, 60, 20)
      let qty = 30
      if (symbol === 'NIFTY') qty = 65
      else if (symbol === 'FINNIFTY') qty = 60
      else if (symbol === 'SENSEX') qty = 20

      const numbers = (line + ' ' + (lines[i + 1] || '')).match(/\b\d+\b/g)
      if (numbers) {
        for (const n of numbers) {
          const val = parseInt(n, 10)
          if ([15, 20, 25, 30, 50, 60, 65, 75, 100, 120, 150].includes(val)) {
            qty = val
            break
          }
        }
      }

      let expiry_date: string | null = null
      try {
        const d = new Date(expiryStr)
        if (!isNaN(d.getTime())) expiry_date = d.toISOString().split('T')[0]
      } catch {}

      executionLegs.push({
        trade_date: expiry_date || new Date().toISOString(),
        symbol,
        direction: dir,
        instrument_type: typePrefix.startsWith('OPT') ? 'options' : 'futures',
        qty,
        price,
        option_type: optType,
        strike_price: strike,
        expiry_date
      })
      continue
    }

    // Option summary format: BANKNIFTY 28/04/2026 56500 PE 30 560.67 559.27 -207.88
    const optMatch = line.match(/(BANKNIFTY|NIFTY|FINNIFTY|MIDCPNIFTY|SENSEX)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(PE|CE)\s+(\d+)/i)
    if (optMatch) {
      const symbolBase = optMatch[1].toUpperCase()
      const expiry = optMatch[2]
      const strike = parseFloat(optMatch[3])
      const optType = optMatch[4].toUpperCase() as 'CE' | 'PE'
      const qty = parseInt(optMatch[5], 10)

      const numbers = (line + ' ' + (lines[i + 1] || '')).match(/[-+]?\d*\.?\d+/g)
      let buyPrice = 0
      let sellPrice = 0
      let pnl = 0

      if (numbers && numbers.length >= 4) {
        buyPrice = parseFloat(numbers[numbers.length - 4]) || 0
        sellPrice = parseFloat(numbers[numbers.length - 3]) || 0
        pnl = parseFloat(numbers[numbers.length - 1]) || 0
      }

      const fullSymbol = `${symbolBase} ${strike} ${optType}`
      trades.push({
        symbol: fullSymbol,
        direction: sellPrice >= buyPrice ? 'buy' : 'sell',
        instrument_type: 'options',
        lot_size: qty,
        entry_price: buyPrice,
        exit_price: sellPrice,
        net_profit: pnl,
        status: 'closed',
        open_time: expiry,
        close_time: expiry,
        option_type: optType,
        strike_price: strike,
        source: 'csv_import',
        notes: `Angel One Tax P&L | Options`
      })
    }
  }

  // If execution legs were extracted from Angel One TradeBook, match them into completed trades via FIFO!
  if (executionLegs.length > 0) {
    const matched = matchTradePairs(executionLegs)
    trades.push(...matched.completedTrades)
  }

  // Calculate total taxable P&L if not explicitly in header
  if (total_taxable_pnl === 0 && trades.length > 0) {
    total_taxable_pnl = trades.reduce((sum, t) => sum + (t.net_profit ?? 0), 0)
  }

  return {
    client_name,
    client_id,
    pan,
    financial_year,
    from_date,
    to_date,
    ledger_opening_balance,
    ledger_closing_balance,
    total_taxable_pnl,
    delivery_ltcg_pnl,
    delivery_stcg_pnl,
    intraday_speculative_pnl,
    futures_pnl,
    options_pnl,
    futures_turnover,
    options_turnover,
    total_charges,
    total_stt,
    additional_brokerage,
    non_trade_dp_charges,
    non_trade_amc_charges,
    non_trade_interest_charges,
    trades
  }
}
