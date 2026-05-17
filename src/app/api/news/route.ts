import { NextResponse } from 'next/server'

export const revalidate = 3600 // Cache for 1 hour

export async function GET() {
  try {
    // ForexFactory JSON feed
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error('Failed to fetch news')
    
    const data = await res.json()
    
    // Filter for High Impact ("High" or "Red") news today and tomorrow
    const today = new Date()
    today.setHours(0,0,0,0)
    const dayAfterTomorrow = new Date(today)
    dayAfterTomorrow.setDate(today.getDate() + 2)

    const highImpact = data.filter((event: any) => {
      const eventDate = new Date(event.date)
      return (
        event.impact === 'High' && 
        eventDate >= today && 
        eventDate < dayAfterTomorrow
      )
    })

    return NextResponse.json(highImpact)
  } catch (error: any) {
    console.error('News API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
