import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://web-api.forexfactory.com/public/calendar/thisWeek.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch from Forex Factory: ${res.status}`)
    }

    const data = await res.json()
    
    // Sort and filter events: only HIGH or MEDIUM impact events for major currencies (USD, EUR, GBP, JPY, AUD)
    // Map them to the client format
    const filtered = data
      .filter((e: any) => {
        const currency = e.country?.toUpperCase()
        const isMajorCurrency = ['USD', 'EUR', 'GBP', 'JPY', 'AUD'].includes(currency)
        const isHighOrMedium = ['High', 'Medium'].includes(e.impact)
        
        // We only want events that are recent or upcoming (from yesterday onward)
        const eventDate = new Date(e.date)
        const isRecentOrUpcoming = eventDate.getTime() > Date.now() - 24 * 60 * 60 * 1000
        return isMajorCurrency && isHighOrMedium && isRecentOrUpcoming
      })
      .map((e: any) => {
        // Map "High" -> "HIGH", "Medium" -> "MEDIUM" to fit client type
        const impact = e.impact?.toUpperCase() === 'HIGH' ? 'HIGH' : 'MEDIUM'
        return {
          name: `${e.country} - ${e.title}`,
          date: e.date, // keep as ISO string, client parses it
          impact,
          forecast: e.forecast || '—',
          previous: e.previous || '—'
        }
      })
      // Sort by date ascending (closest events first)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10) // Limit to top 10 events for clean display

    return NextResponse.json(filtered)
  } catch (error: any) {
    console.error('Economic calendar API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
