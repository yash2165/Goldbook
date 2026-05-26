/**
 * Deterministic Candlestick Seeder for XAUUSD & BankNifty.
 * Generates highly realistic, mathematically sound 5-minute historical charts
 * with accurate session volumes, daily volatility cycles, news catalysts, opening gaps, 
 * and weekend closures.
 */

interface Candle {
  time: number // unix timestamp in seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Deterministic Pseudo-Random Generator (to ensure identical chart patterns for all users)
class SeededRandom {
  private seed: number
  
  constructor(seed: number = 42) {
    this.seed = seed
  }

  // Returns a float between 0 and 1
  next(): number {
    const x = Math.sin(this.seed++) * 10000
    return x - Math.floor(x)
  }

  // Returns a value between min and max
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  // Returns standard normal distribution (Box-Muller transform)
  normal(): number {
    let u = 0, v = 0
    while(u === 0) u = this.next()
    while(v === 0) v = this.next()
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  }
}

export function generateHistoricalCandles(
  symbol: 'XAUUSD' | 'BANKNIFTY',
  count: number = 4000
): Candle[] {
  const rand = new SeededRandom(symbol === 'XAUUSD' ? 2026 : 51200)
  const candles: Candle[] = []
  
  // Starting parameters
  let currentTime = Math.floor((Date.now() - count * 5 * 60 * 1000) / 1000)
  // Round to nearest 5-minute boundary
  currentTime = Math.floor(currentTime / 300) * 300
  
  let basePrice = symbol === 'XAUUSD' ? 2320.00 : 50800.00
  let currentPrice = basePrice
  let trendSlope = symbol === 'XAUUSD' ? 0.002 : 0.08 // Long term upward drift
  
  let index = 0
  
  while (candles.length < count) {
    const date = new Date(currentTime * 1000)
    const day = date.getUTCDay()
    const hour = date.getUTCHours()
    const minute = date.getUTCMinutes()

    // ── 1. SYMBOL SPECIFIC SESSION HOUR FILTERS ──
    
    if (symbol === 'XAUUSD') {
      // Gold operates 24 hours, but closes on weekends (Saturday & Sunday UTC)
      if (day === 6 || day === 0) {
        currentTime += 300
        continue
      }
    } else {
      // BankNifty operates strictly during NSE Indian Hours: 09:15 AM to 03:30 PM IST
      // In UTC: 03:45 AM to 10:00 AM UTC
      // Also closed on weekends
      if (day === 6 || day === 0) {
        currentTime += 300
        continue
      }
      
      const minutesUTC = hour * 60 + minute
      const marketOpenUTC = 3 * 60 + 45 // 03:45 UTC
      const marketCloseUTC = 10 * 60    // 10:00 UTC
      
      if (minutesUTC < marketOpenUTC || minutesUTC >= marketCloseUTC) {
        // Market is closed, skip 5 minutes
        currentTime += 300
        continue
      }
    }

    // ── 2. VOLATILITY & VOLUME SESSIONS (London, NY, News, India Open) ──
    
    let volFactor = 1.0
    let sessionBias = 0.0
    let volumeBase = symbol === 'XAUUSD' ? 120 : 800

    if (symbol === 'XAUUSD') {
      // Gold Session Volatility Cycle (UTC)
      if (hour >= 7 && hour < 12) {
        // London Session (07:00 to 12:00 UTC)
        volFactor = 1.4
        sessionBias = rand.range(-0.05, 0.08)
        volumeBase = 250
      } else if (hour >= 12 && hour < 17) {
        // New York Session & London Overlap (12:00 to 17:00 UTC)
        volFactor = 2.2
        sessionBias = rand.range(-0.15, 0.20)
        volumeBase = 450
        
        // News Spikes (Macro triggers e.g., US CPI releases at 13:30 UTC)
        if (hour === 13 && minute >= 30 && minute <= 45) {
          volFactor = 5.5
          sessionBias = rand.range(-0.8, 1.2) // Violent expansion candle
          volumeBase = 1200
        }
      } else {
        // Asian Consolidation Session (17:00 to 07:00 UTC)
        volFactor = 0.5
        sessionBias = rand.range(-0.02, 0.02)
        volumeBase = 60
      }
    } else {
      // BankNifty Session Volatility (UTC minutes)
      const minutesUTC = hour * 60 + minute
      
      if (minutesUTC >= 3 * 60 + 45 && minutesUTC <= 4 * 60 + 15) {
        // Opening session volatility (09:15 to 09:45 AM IST)
        volFactor = 2.8
        sessionBias = rand.range(-0.4, 0.5)
        volumeBase = 2000
      } else if (minutesUTC >= 7 * 60 && minutesUTC <= 8 * 60 + 30) {
        // Mid-day London Open overlap (12:30 to 02:00 PM IST)
        volFactor = 1.3
        sessionBias = rand.range(-0.1, 0.15)
        volumeBase = 900
      } else if (minutesUTC >= 9 * 60 + 30) {
        // Closing hour rush (03:00 to 03:30 PM IST)
        volFactor = 1.8
        sessionBias = rand.range(-0.3, 0.4)
        volumeBase = 1600
      } else {
        // Quiet mid-day consolidation
        volFactor = 0.7
        sessionBias = rand.range(-0.05, 0.05)
        volumeBase = 400
      }
    }

    // ── 3. CANDLESTICK CALCULATIONS ──
    
    // Add drift and randomness
    const drift = trendSlope + sessionBias
    const noise = rand.normal() * (symbol === 'XAUUSD' ? 0.35 : 8.5) * volFactor
    const priceChange = drift + noise
    
    const open = currentPrice
    const close = currentPrice + priceChange
    
    // Calculate High & Low based on volatility
    const spread = Math.abs(priceChange)
    const wickTop = rand.range(0.05, 0.4) * (symbol === 'XAUUSD' ? 0.45 : 12.0) * volFactor
    const wickBottom = rand.range(0.05, 0.4) * (symbol === 'XAUUSD' ? 0.45 : 12.0) * volFactor
    
    const high = Math.max(open, close) + wickTop
    const low = Math.min(open, close) - wickBottom
    
    const volume = Math.floor(volumeBase * rand.range(0.6, 1.4))
    
    // Accumulate
    candles.push({
      time: currentTime,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    })
    
    // Set next base
    currentPrice = close
    currentTime += 300 // step 5 minutes
    index++
    
    // Periodically add massive macro gaps on BankNifty daily opens
    if (symbol === 'BANKNIFTY' && hour === 3 && minute === 45) {
      // Overnight gap of 50 to 300 points
      const gapDirection = rand.next() > 0.45 ? 1 : -1
      const gapSize = rand.range(40, 220) * gapDirection
      currentPrice += gapSize
    }
  }
  
  return candles
}
