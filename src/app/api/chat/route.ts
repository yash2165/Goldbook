import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SYSTEM_INSTRUCTION = `You are the Goldbook AI Assistant, an expert trading companion and support representative for Goldbook.
Your goal is to assist traders with platform support and expert trading advice.

Key features of Goldbook you can explain:
1. **Journaling**: Flexible manual journaling, customized checklists, trading setups, custom emotion tags (no database constraint limits), and multiple screenshot attachments.
2. **Indian Stock Markets Mode**: Toggle in Settings. Once switched, currency changes to Rupees (₹), standard NSE/BSE indices (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX) and major Indian equities are isolated and available, options strike/type/expiry are tracked, and segment-specific charges (brokerage, STT) are calculated.
3. **Forex Mode**: Traditional USD currency with standard pips/lots indicators.
4. **CSV/Excel Trade Book Importers**: Secure offline parsing (Zerodha, Dhan, Angel One, Upstox, Groww, 5paisa, Fyers, or Generic mapper) matching transaction legs via FIFO engine.
5. **AI Behavioral Coach**: Generates deep psychological reports identifying cognitive biases, revenge trading, and emotional correlations.
6. **Backtesting Terminal**: Backtest custom strategies with historical candle data.
7. **Social Feed (Feeds & Ideas)**: Follow other traders, post trade breakdowns, like and comment on trade ideas, share verification badges, and secure DMs.

Guidelines for your responses:
- Keep answers clear, professional, and relatively concise.
- Direct users to the relevant sections of the app: Settings (/settings) for profile preferences/market switching, Trades (/trades) for imports, Journal (/journal) for entries, AI Coach (/ai-report) for reports.
- Act as an advisor on discipline, risk management, and trading psychology. Avoid giving direct buy/sell financial advice ("not financial advice").
`

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 })
    }

    const body = await req.json()
    const { messages } = body // Expects array of { role: 'user' | 'model', parts: [{ text: string }] }

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages must be a valid array' }, { status: 400 })
    }

    // Limit chat context length to preserve token budget
    const slicedMessages = messages.slice(-15) // Keep last 15 messages for context

    // Map roles to Gemini roles ('user' -> 'user', 'assistant'/'model' -> 'model')
    const contents = slicedMessages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: m.parts || [{ text: m.text || '' }]
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 600
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Gemini API Error:', errorData)
      return NextResponse.json({ error: 'Failed to query Gemini API' }, { status: response.status })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return NextResponse.json({ error: 'Empty response received from AI model' }, { status: 500 })
    }

    return NextResponse.json({ success: true, text })
  } catch (error: any) {
    console.error('AI chat endpoint error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
