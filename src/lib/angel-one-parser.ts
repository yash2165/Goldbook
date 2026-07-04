import { parseNSEDerivativesSymbol } from './csv-parsers'
import { StandardTrade } from './trade-matcher'

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

/**
 * Parses raw text extracted from Angel One P&L Tax PDF or CSV reports.
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
        // Look for string in current or next line
        const parts = lines[i].split(/\s{2,}|\t|:/)
        if (parts.length > 1 && parts[parts.length - 1].trim()) {
          return parts[parts.length - 1].trim()
        }
        if (lines[i + 1]) return lines[i + 1].trim()
      }
    }
    return defaultVal
  }

  // 1. Client Basic Information
  const client_name = getString(/Client Name/i, 'Trader')
  const client_id = getString(/Client Id|Client Code/i, '')
  const pan = getString(/PAN/i, '')

  // 2. Date Range
  const financial_year = getString(/Financial Year/i, '2026-2027')
  const from_date = getString(/From Date/i, '')
  const to_date = getString(/To Date/i, '')

  // 3. Ledger Summary
  const ledger_opening_balance = getValue(/Ledger Opening/i, 0)
  const ledger_closing_balance = getValue(/Ledger Closing/i, 0)

  // 4. P&L Summary
  const total_taxable_pnl = getValue(/Total Taxable P&L/i, 0)
  const delivery_ltcg_pnl = getValue(/Taxable Delivery P&L.*LTCG/i, 0)
  const delivery_stcg_pnl = getValue(/Taxable Delivery P&L.*STCG/i, 0)
  const intraday_speculative_pnl = getValue(/Taxable Intraday/i, 0)
  const futures_pnl = getValue(/Taxable Futures P&L/i, 0)
  const options_pnl = getValue(/Taxable Options P&L/i, 0)
  
  const futures_turnover = getValue(/Future Turnover/i, 0)
  const options_turnover = getValue(/Options Turnover/i, 0)

  const total_charges = getValue(/Total Charges and Statutory Levies/i, 0)
  const total_stt = getValue(/Total STT/i, 0)
  const additional_brokerage = getValue(/Additional Brokerage/i, 0)

  const non_trade_dp_charges = getValue(/Total DP Charges/i, 0)
  const non_trade_amc_charges = getValue(/Account Maintenance Charges/i, 0)
  const non_trade_interest_charges = getValue(/Interest Charges/i, 0)

  // 5. Extract Trade-Wise Details
  const trades: StandardTrade[] = []

  // Extract Options & Equity trade rows
  // Options pattern example: BANKNIFTY 28/04/2026 56500 PE 30 ...
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Option row match (e.g. BANKNIFTY or NIFTY with Strike & Type)
    const optMatch = line.match(/(BANKNIFTY|NIFTY|FINNIFTY|MIDCPNIFTY|SENSEX)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(PE|CE)\s+(\d+)/i)
    if (optMatch) {
      const symbolBase = optMatch[1].toUpperCase()
      const expiry = optMatch[2]
      const strike = parseFloat(optMatch[3])
      const optType = optMatch[4].toUpperCase() as 'CE' | 'PE'
      const qty = parseInt(optMatch[5], 10)

      // Look ahead for prices & dates in subsequent tokens or line
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
        notes: `Angel One Tax P&L | Segment: Options (Non-Speculative)`
      })
    }

    // Equity / Intraday row match (e.g., BANKBEES 100 08/06/2026 560.67 559.27 -207.88)
    const eqMatch = line.match(/([A-Z0-9]{3,15})\s+(\d+)\s+(\d{2}\/\d{2}\/\d{4})/i)
    if (eqMatch && !line.includes('BANKNIFTY') && !line.includes('NIFTY')) {
      const scrip = eqMatch[1].toUpperCase()
      const qty = parseInt(eqMatch[2], 10)
      const dateStr = eqMatch[3]

      const nums = (line + ' ' + (lines[i + 1] || '')).match(/[-+]?\d*\.?\d+/g)
      if (nums && nums.length >= 3) {
        const buyPrice = parseFloat(nums[nums.length - 3]) || 0
        const sellPrice = parseFloat(nums[nums.length - 2]) || 0
        const pnl = parseFloat(nums[nums.length - 1]) || 0

        trades.push({
          symbol: scrip,
          direction: sellPrice >= buyPrice ? 'buy' : 'sell',
          instrument_type: 'equity',
          lot_size: qty,
          entry_price: buyPrice,
          exit_price: sellPrice,
          net_profit: pnl,
          status: 'closed',
          open_time: dateStr,
          close_time: dateStr,
          source: 'csv_import',
          notes: `Angel One Tax P&L | Segment: Intraday`
        })
      }
    }
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
