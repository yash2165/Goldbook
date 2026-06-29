export interface ExecutionLeg {
  trade_date: string
  symbol: string
  direction: 'buy' | 'sell'
  instrument_type: 'spot' | 'equity' | 'options' | 'futures'
  qty: number
  price: number
  option_type?: 'CE' | 'PE' | null
  strike_price?: number | null
  expiry_date?: string | null
  spot_price?: number | null
  brokerage?: number
  stt?: number
  other_charges?: number
}

/**
 * Standardize and parse an NSE option/futures/stock symbol.
 * Example weekly options: NIFTY2462724500CE -> NIFTY, Options, CE, 24500, Expiry 2024-06-27
 * Example monthly options: BANKNIFTY26JAN52000PE -> BANKNIFTY, Options, PE, 52000, Expiry 2026-01-28
 * Example futures: NIFTY24JUNFUT -> NIFTY, Futures, Expiry 2024-06-28
 */
export function parseNSEDerivativesSymbol(symbolStr: string): {
  symbol: string
  instrument_type: 'equity' | 'options' | 'futures' | 'spot'
  option_type?: 'CE' | 'PE' | null
  strike_price?: number | null
  expiry_date?: string | null
} {
  const clean = symbolStr.replace(/[^A-Z0-9.\-\/]/g, '').toUpperCase()
  
  // 1. Standard weekly option pattern (e.g. NIFTY2462724500CE or NIFTY24O1652000PE)
  // Let's match: SYMBOL (letters), YEAR (2 digits), Month+Day (weekly/monthly, alpha/numeric), STRIKE (digits), CE/PE
  const optionMatch = clean.match(/^([A-Z]+)(\d{2})([A-Z0-9]{3,4}?)(\d+(?:\.\d+)?)(CE|PE|CALL|PUT)$/)
  if (optionMatch) {
    const symbol = optionMatch[1]
    const yy = optionMatch[2]
    const datePart = optionMatch[3]
    const strike_price = parseFloat(optionMatch[4])
    const optType = optionMatch[5]
    const option_type = (optType.startsWith('C') ? 'CE' : 'PE') as 'CE' | 'PE'
    
    let expiry_date: string | null = null
    const monthMap: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    }

    if (datePart.length === 3 && monthMap[datePart]) {
      // Monthly: e.g. 26JAN
      expiry_date = `20${yy}-${monthMap[datePart]}-28` // Generic monthly expiry fallback
    } else if (datePart.length === 3) {
      // Weekly: e.g. 627 (Jun 27)
      // Month digit (1-9, O, N, D) + Day (2 digits)
      const m = datePart[0]
      const dd = datePart.substring(1)
      const mm = m === 'O' ? '10' : m === 'N' ? '11' : m === 'D' ? '12' : `0${m}`.slice(-2)
      expiry_date = `20${yy}-${mm}-${dd}`
    } else if (datePart.length === 4) {
      // Weekly with 2 digit month: e.g. 1024 (Oct 24)
      const mm = datePart.substring(0, 2)
      const dd = datePart.substring(2, 4)
      expiry_date = `20${yy}-${mm}-${dd}`
    }

    return {
      symbol,
      instrument_type: 'options',
      option_type,
      strike_price,
      expiry_date
    }
  }

  // 2. Standard Futures pattern (e.g. NIFTY24JUNFUT or BANKNIFTY24FUT)
  const futMatch = clean.match(/^([A-Z]+)(\d{2})([A-Z0-9]*?)(FUT|FUTURES)$/)
  if (futMatch) {
    const symbol = futMatch[1]
    const yy = futMatch[2]
    const datePart = futMatch[3]
    let expiry_date: string | null = null
    const monthMap: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    }
    if (datePart && monthMap[datePart]) {
      expiry_date = `20${yy}-${monthMap[datePart]}-28`
    } else {
      expiry_date = `20${yy}-01-01`
    }
    return {
      symbol,
      instrument_type: 'futures',
      expiry_date
    }
  }

  // 3. Fallback Option Check (e.g. CE / PE tag anywhere in string)
  if (clean.includes('CE') || clean.includes('PE') || clean.includes('CALL') || clean.includes('PUT')) {
    const optType = (clean.includes('CE') || clean.includes('CALL')) ? 'CE' : 'PE'
    // Extract any number block of 3 or more digits as the strike price
    const numbers = clean.match(/\d{3,}/)
    const strike_price = numbers ? parseFloat(numbers[0]) : null
    
    // Strip numeric parts to get symbol prefix
    const symbolMatch = clean.match(/^[A-Z]+/);
    const symbol = symbolMatch ? symbolMatch[0] : clean;
    
    return {
      symbol,
      instrument_type: 'options',
      option_type: optType,
      strike_price,
      expiry_date: null
    }
  }

  // 4. Fallback Futures Check
  if (clean.includes('FUT') || clean.includes('FUTURES') || clean.includes('CONTINUOUS')) {
    const symbolMatch = clean.match(/^[A-Z]+/);
    const symbol = symbolMatch ? symbolMatch[0] : clean;
    return {
      symbol,
      instrument_type: 'futures',
      expiry_date: null
    }
  }

  // 5. Default is Equity
  return {
    symbol: clean,
    instrument_type: 'equity'
  }
}

/**
 * Standardize CSV row parser values.
 */
function cleanDirection(directionStr: string): 'buy' | 'sell' {
  const dir = directionStr.trim().toLowerCase()
  if (dir.startsWith('b') || dir === 'buy' || dir === 'long' || dir === '1') return 'buy'
  return 'sell'
}

function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0
  if (typeof val === 'number') return val
  const clean = String(val).replace(/[^0-9.-]/g, '')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

function parseDateTimeString(dateStr: string): string {
  try {
    // Try to format standard YYYY-MM-DD HH:MM
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  } catch {}
  return new Date().toISOString()
}

/**
 * Parse CSV file lines based on raw headers map.
 */
export function parseCSVData(
  lines: string[][],
  broker: string,
  mappings?: Record<string, string>
): ExecutionLeg[] {
  if (lines.length < 2) return []
  
  const headers = lines[0].map(h => h.trim().toLowerCase())
  const rows = lines.slice(1).filter(r => r.length > 0 && r.some(c => c.trim().length > 0))

  // 1. Custom Mappings / Generic Parser
  if (broker === 'generic' && mappings) {
    const getVal = (row: string[], field: string) => {
      const idx = headers.indexOf(mappings[field]?.toLowerCase() || '')
      return idx !== -1 ? row[idx] : ''
    }

    return rows.map(r => {
      const rawSymbol = getVal(r, 'symbol')
      const derivatives = parseNSEDerivativesSymbol(rawSymbol)
      
      return {
        trade_date: parseDateTimeString(getVal(r, 'date')),
        symbol: derivatives.symbol,
        direction: cleanDirection(getVal(r, 'direction')),
        instrument_type: derivatives.instrument_type,
        qty: parseNumber(getVal(r, 'qty')),
        price: parseNumber(getVal(r, 'price')),
        option_type: derivatives.option_type,
        strike_price: derivatives.strike_price,
        expiry_date: derivatives.expiry_date,
        brokerage: parseNumber(getVal(r, 'brokerage')),
        stt: parseNumber(getVal(r, 'stt')),
        other_charges: parseNumber(getVal(r, 'other_charges'))
      }
    })
  }

  // 2. Zerodha Console
  if (broker === 'zerodha') {
    // Expected headers: trade_date, symbol, trade_type, quantity, price
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('time'))
    const symIdx = headers.findIndex(h => h === 'symbol')
    const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('side'))
    const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity'))
    const priceIdx = headers.findIndex(h => h === 'price' || h.includes('rate') || h.includes('average'))

    return rows.map(r => {
      const rawSymbol = symIdx !== -1 ? r[symIdx] : ''
      const derivatives = parseNSEDerivativesSymbol(rawSymbol)
      
      return {
        trade_date: parseDateTimeString(dateIdx !== -1 ? r[dateIdx] : ''),
        symbol: derivatives.symbol,
        direction: cleanDirection(typeIdx !== -1 ? r[typeIdx] : 'buy'),
        instrument_type: derivatives.instrument_type,
        qty: parseNumber(qtyIdx !== -1 ? r[qtyIdx] : 0),
        price: parseNumber(priceIdx !== -1 ? r[priceIdx] : 0),
        option_type: derivatives.option_type,
        strike_price: derivatives.strike_price,
        expiry_date: derivatives.expiry_date
      }
    })
  }

  // 3. Dhan
  if (broker === 'dhan') {
    // Expected headers: Date & Time/Trade Time, Trading Symbol, Buy/Sell, Quantity, Price, Segment/Instrument
    const dateIdx = headers.findIndex(h => h.includes('time') || h.includes('date'))
    const symIdx = headers.findIndex(h => h.includes('symbol'))
    const typeIdx = headers.findIndex(h => h.includes('buy/sell') || h.includes('side') || h.includes('transaction'))
    const qtyIdx = headers.findIndex(h => h.includes('quantity') || h.includes('qty'))
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('rate'))
    const instIdx = headers.findIndex(h => h.includes('instrument') || h.includes('segment'))

    return rows.map(r => {
      const rawSymbol = symIdx !== -1 ? r[symIdx] : ''
      const derivatives = parseNSEDerivativesSymbol(rawSymbol)
      const rawInst = instIdx !== -1 ? r[instIdx].toUpperCase() : ''
      
      let instType = derivatives.instrument_type
      if (rawInst.includes('OPT')) instType = 'options'
      else if (rawInst.includes('FUT')) instType = 'futures'
      else if (rawInst.includes('EQ') || rawInst.includes('STOCK')) instType = 'equity'

      return {
        trade_date: parseDateTimeString(dateIdx !== -1 ? r[dateIdx] : ''),
        symbol: derivatives.symbol,
        direction: cleanDirection(typeIdx !== -1 ? r[typeIdx] : 'buy'),
        instrument_type: instType,
        qty: parseNumber(qtyIdx !== -1 ? r[qtyIdx] : 0),
        price: parseNumber(priceIdx !== -1 ? r[priceIdx] : 0),
        option_type: derivatives.option_type,
        strike_price: derivatives.strike_price,
        expiry_date: derivatives.expiry_date
      }
    })
  }

  // 4. Angel One
  if (broker === 'angel') {
    // Expected headers: Trade Date, Script Name, Buy/Sell, Quantity, Price/Rate
    const dateIdx = headers.findIndex(h => h.includes('date'))
    const symIdx = headers.findIndex(h => h.includes('name') || h.includes('script') || h.includes('symbol'))
    const typeIdx = headers.findIndex(h => h.includes('buy') || h.includes('sell') || h.includes('transaction'))
    const qtyIdx = headers.findIndex(h => h.includes('quantity') || h.includes('qty'))
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('rate') || h.includes('net rate'))

    return rows.map(r => {
      const rawSymbol = symIdx !== -1 ? r[symIdx] : ''
      const derivatives = parseNSEDerivativesSymbol(rawSymbol)

      return {
        trade_date: parseDateTimeString(dateIdx !== -1 ? r[dateIdx] : ''),
        symbol: derivatives.symbol,
        direction: cleanDirection(typeIdx !== -1 ? r[typeIdx] : 'buy'),
        instrument_type: derivatives.instrument_type,
        qty: parseNumber(qtyIdx !== -1 ? r[qtyIdx] : 0),
        price: parseNumber(priceIdx !== -1 ? r[priceIdx] : 0),
        option_type: derivatives.option_type,
        strike_price: derivatives.strike_price,
        expiry_date: derivatives.expiry_date
      }
    })
  }

  // 5. Upstox
  if (broker === 'upstox') {
    // Expected headers: Symbol, Buy/Sell, Quantity, Price, Trade Date/Execution Time
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('time'))
    const symIdx = headers.findIndex(h => h === 'symbol')
    const typeIdx = headers.findIndex(h => h.includes('buy') || h.includes('sell') || h.includes('transaction') || h.includes('side'))
    const qtyIdx = headers.findIndex(h => h.includes('quantity') || h.includes('qty'))
    const priceIdx = headers.findIndex(h => h === 'price' || h.includes('rate') || h.includes('average'))

    return rows.map(r => {
      const rawSymbol = symIdx !== -1 ? r[symIdx] : ''
      const derivatives = parseNSEDerivativesSymbol(rawSymbol)

      return {
        trade_date: parseDateTimeString(dateIdx !== -1 ? r[dateIdx] : ''),
        symbol: derivatives.symbol,
        direction: cleanDirection(typeIdx !== -1 ? r[typeIdx] : 'buy'),
        instrument_type: derivatives.instrument_type,
        qty: parseNumber(qtyIdx !== -1 ? r[qtyIdx] : 0),
        price: parseNumber(priceIdx !== -1 ? r[priceIdx] : 0),
        option_type: derivatives.option_type,
        strike_price: derivatives.strike_price,
        expiry_date: derivatives.expiry_date
      }
    })
  }

  // Fallback: simple header matching for Groww, 5paisa, Fyers, etc.
  const dIdx = headers.findIndex(h => h.includes('date') || h.includes('time'))
  const sIdx = headers.findIndex(h => h.includes('symbol') || h.includes('scrip') || h.includes('stock') || h.includes('name'))
  const dirIdx = headers.findIndex(h => h.includes('type') || h.includes('buy') || h.includes('sell') || h.includes('side') || h.includes('transaction'))
  const qIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('shares') || h.includes('lots'))
  const pIdx = headers.findIndex(h => h.includes('price') || h.includes('rate') || h.includes('avg') || h.includes('cost'))

  return rows.map(r => {
    const rawSymbol = sIdx !== -1 ? r[sIdx] : ''
    const derivatives = parseNSEDerivativesSymbol(rawSymbol)

    return {
      trade_date: parseDateTimeString(dIdx !== -1 ? r[dIdx] : ''),
      symbol: derivatives.symbol,
      direction: cleanDirection(dirIdx !== -1 ? r[dirIdx] : 'buy'),
      instrument_type: derivatives.instrument_type,
      qty: parseNumber(qIdx !== -1 ? r[qIdx] : 0),
      price: parseNumber(pIdx !== -1 ? r[pIdx] : 0),
      option_type: derivatives.option_type,
      strike_price: derivatives.strike_price,
      expiry_date: derivatives.expiry_date
    }
  })
}
