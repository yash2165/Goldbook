import { NextResponse } from 'next/server'

export async function GET() {
  const jsonUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
  const xmlUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }

  let rawEvents: any[] = []
  let source = 'json'

  try {
    // Attempt standard JSON calendar first
    const res = await fetch(jsonUrl, {
      headers,
      next: { revalidate: 14400 } // Cache for 4 hours to strictly prevent 429 rate limiting
    })

    if (!res.ok) {
      throw new Error(`JSON feed error: ${res.status}`)
    }

    rawEvents = await res.json()
  } catch (jsonErr) {
    console.warn('JSON news feed failed, falling back to XML feed:', jsonErr)
    source = 'xml'
    
    try {
      const res = await fetch(xmlUrl, {
        headers,
        next: { revalidate: 14400 }
      })

      if (!res.ok) {
        throw new Error(`XML feed error: ${res.status}`)
      }

      const xmlText = await res.text()
      const eventRegex = /<event>([\s\S]*?)<\/event>/g
      let match

      while ((match = eventRegex.exec(xmlText)) !== null) {
        const content = match[1]
        
        const titleMatch = content.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)
        const countryMatch = content.match(/<country>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/country>/)
        const dateMatch = content.match(/<date><!\[CDATA\[(.*?)\]\]><\/date>/)
        const timeMatch = content.match(/<time><!\[CDATA\[(.*?)\]\]><\/time>/)
        const impactMatch = content.match(/<impact><!\[CDATA\[(.*?)\]\]><\/impact>/)
        const forecastMatch = content.match(/<forecast>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/forecast>/) || content.match(/<forecast\s*\/>/)
        const previousMatch = content.match(/<previous>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/previous>/) || content.match(/<previous\s*\/>/)

        const title = titleMatch ? titleMatch[1] : ''
        const country = countryMatch ? countryMatch[1] : ''
        const dateStr = dateMatch ? dateMatch[1] : ''
        const timeStr = timeMatch ? timeMatch[1] : ''
        const impact = impactMatch ? impactMatch[1] : ''
        const forecast = (forecastMatch && forecastMatch[1]) ? forecastMatch[1] : ''
        const previous = (previousMatch && previousMatch[1]) ? previousMatch[1] : ''

        let parsedDate = null
        if (dateStr && timeStr) {
          const parts = dateStr.split('-')
          if (parts.length === 3) {
            const formattedDate = `${parts[2]}-${parts[0]}-${parts[1]}` // YYYY-MM-DD
            const cleanTime = timeStr.toLowerCase().trim()
            
            if (cleanTime === 'all day' || cleanTime.includes('day') || cleanTime === '') {
              // All-day bank holidays set to 00:00:00 EST
              parsedDate = new Date(`${formattedDate}T00:00:00-04:00`)
            } else {
              const timeParts = cleanTime.match(/(\d+):(\d+)\s*(am|pm)/)
              if (timeParts) {
                let hour = parseInt(timeParts[1])
                const min = timeParts[2]
                const ampm = timeParts[3]
                if (ampm === 'pm' && hour < 12) hour += 12
                if (ampm === 'am' && hour === 12) hour = 0
                
                const hourStr = hour.toString().padStart(2, '0')
                parsedDate = new Date(`${formattedDate}T${hourStr}:${min}:00-04:00`)
              } else {
                parsedDate = new Date(`${formattedDate}T00:00:00-04:00`)
              }
            }
          }
        }

        if (parsedDate && !isNaN(parsedDate.getTime())) {
          rawEvents.push({
            title,
            country, // XML feed stores currency code in <country> node
            date: parsedDate.toISOString(),
            impact,
            forecast,
            previous
          })
        }
      }
    } catch (xmlErr) {
      console.error('All news feeds failed:', xmlErr)
      return NextResponse.json({ error: 'Failed to fetch news feed from all sources' }, { status: 500 })
    }
  }

  // Filter and format events for display
  const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD']
  const filtered = rawEvents
    .filter((e: any) => {
      const currency = e.country?.toUpperCase()
      const isMajor = majorCurrencies.includes(currency)
      const isHighOrMedium = ['High', 'Medium'].includes(e.impact)
      
      // Keep events that are recent or upcoming (within the last 24 hours to future)
      const eventDate = new Date(e.date)
      const isRecentOrUpcoming = eventDate.getTime() > Date.now() - 24 * 60 * 60 * 1000
      
      return isMajor && isHighOrMedium && isRecentOrUpcoming
    })
    .map((e: any) => {
      const impact = e.impact?.toUpperCase() === 'HIGH' ? 'HIGH' : 'MEDIUM'
      return {
        name: `${e.country} - ${e.title}`,
        date: e.date,
        impact,
        forecast: e.forecast || '—',
        previous: e.previous || '—'
      }
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 15) // Expand limit slightly to show more upcoming news

  return NextResponse.json(filtered)
}

