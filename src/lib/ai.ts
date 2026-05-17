/**
 * lib/ai.ts
 * GoldBook AI Coach — Gemini 1.5 Flash primary, Groq Llama 3.3 fallback
 *
 * The coach analyzes:
 *  - Full trading statistics (P&L, win rate, drawdown, streaks, etc.)
 *  - Session & day-of-week breakdown
 *  - Per-symbol performance
 *  - Emotion patterns from journal entries (before/after trades)
 *  - Active user-defined rules and whether they were followed
 *  - Revenge trading patterns (trades within 15min of a loss)
 */

import type { PerformanceStats, SessionStat, DayStat } from './calculations'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TradingRule {
  rule_type: string
  label: string
  value: number | null
  value_str: string | null
}

export interface RuleViolation {
  rule_type: string
  label: string
  count: number           // how many trades violated this rule
  examples: string[]      // human-readable violation descriptions
}

interface AIReportInput {
  stats: PerformanceStats
  sessionStats: Record<string, SessionStat>
  dayStats: DayStat[]
  topSymbols: { symbol: string; pnl: number; trades: number; winRate: number }[]
  emotionStats?: Record<string, { wins: number; total: number; avgPnl: number }>
  activeRules?: TradingRule[]
  ruleViolations?: RuleViolation[]
  revengeTradeCount?: number
  period: 'weekly' | 'monthly' | 'alltime'
  accountBalance?: number
}

export interface AIReportOutput {
  grade: string
  grade_reason: string
  strengths: string[]
  weaknesses: string[]
  blind_spots: string[]
  revenge_trading_detected: boolean
  best_session: string
  worst_session: string
  best_day: string
  worst_day: string
  risk_score: number
  consistency_score: number
  discipline_score: number
  rules_compliance_score: number   // 0-10, only set if rules exist
  rules_analysis: string[]         // per-rule compliance observations
  emotion_insights: string[]       // specific observations from emotion data
  action_plan: string[]
  summary: string
  trades_analyzed: number
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(input: AIReportInput): string {
  const {
    stats, sessionStats, dayStats, topSymbols,
    emotionStats, activeRules, ruleViolations,
    revengeTradeCount = 0, period,
  } = input

  const bestSession = Object.entries(sessionStats).sort((a, b) => b[1].pnl - a[1].pnl)[0]?.[0] ?? 'N/A'
  const worstSession = Object.entries(sessionStats).sort((a, b) => a[1].pnl - b[1].pnl)[0]?.[0] ?? 'N/A'
  const bestDay = [...dayStats].sort((a, b) => b.pnl - a.pnl)[0]?.day ?? 'N/A'
  const worstDay = [...dayStats].sort((a, b) => a.pnl - b.pnl)[0]?.day ?? 'N/A'

  const hasRules = activeRules && activeRules.length > 0
  const hasEmotions = emotionStats && Object.keys(emotionStats).length > 0

  return `You are GoldBook's elite trading coach and psychologist, specialized in XAUUSD (Gold) intraday and swing trading.

Analyze this trader's ${period} data and generate a DETAILED, PERSONALIZED coaching report. Reference exact numbers — never give generic advice.

═══════════════════════════════════════════
PERFORMANCE STATISTICS
═══════════════════════════════════════════
Total Trades: ${stats.totalTrades}
Win Rate: ${stats.winRate.toFixed(1)}%
Profit Factor: ${stats.profitFactor === Infinity ? 'Perfect (no losses)' : stats.profitFactor.toFixed(2)}
Total P&L: $${stats.totalPnl.toFixed(2)}
Realized P&L: $${stats.realizedPnl.toFixed(2)}
Unrealized (open): $${stats.unrealizedPnl.toFixed(2)}
Average Win: $${stats.avgWin.toFixed(2)}
Average Loss: $${stats.avgLoss.toFixed(2)}
Best Trade: $${stats.bestTrade.toFixed(2)}
Worst Trade: $${stats.worstTrade.toFixed(2)}
Expectancy/trade: $${stats.expectancy.toFixed(2)}
Average R:R: ${stats.avgRR.toFixed(2)}
Max Drawdown: ${stats.maxDrawdownPct.toFixed(1)}%
Win Streak: ${stats.winStreak}
Loss Streak: ${stats.lossStreak}
Long trades: ${stats.longTrades} | Win rate: ${stats.longWinRate.toFixed(1)}% | P&L: $${stats.longPnl.toFixed(2)}
Short trades: ${stats.shortTrades} | Win rate: ${stats.shortWinRate.toFixed(1)}% | P&L: $${stats.shortPnl.toFixed(2)}

═══════════════════════════════════════════
SESSION BREAKDOWN
═══════════════════════════════════════════
${Object.entries(sessionStats).map(([s, v]) =>
  `${s}: ${v.trades} trades | ${v.winRate.toFixed(0)}% WR | $${v.pnl.toFixed(2)} P&L | avg $${v.avgTrade.toFixed(2)}/trade`
).join('\n')}

═══════════════════════════════════════════
DAY-OF-WEEK PERFORMANCE
═══════════════════════════════════════════
${dayStats.map(d => `${d.day}: ${d.trades} trades | ${d.winRate.toFixed(0)}% WR | $${d.pnl.toFixed(2)} P&L`).join('\n')}

═══════════════════════════════════════════
TOP SYMBOLS
═══════════════════════════════════════════
${topSymbols.slice(0, 5).map(s => `${s.symbol}: ${s.trades} trades | $${s.pnl.toFixed(2)} P&L | ${s.winRate.toFixed(0)}% WR`).join('\n')}

${hasEmotions ? `
═══════════════════════════════════════════
EMOTION & PSYCHOLOGY DATA (from trade journal)
═══════════════════════════════════════════
This trader manually records their emotional state before and after each trade.
Analyze these patterns carefully — they reveal psychological weaknesses.

${Object.entries(emotionStats!).map(([emotion, v]) =>
  `"${emotion}": ${v.wins}/${v.total} wins (${((v.wins / v.total) * 100).toFixed(0)}% WR) | avg P&L: $${v.avgPnl.toFixed(2)}/trade`
).join('\n')}

Key psychological question: Which emotions precede losses? Which precede wins?
Look for patterns like: FOMO trades → losses, Confident → wins, etc.` : ''}

${hasRules ? `
═══════════════════════════════════════════
TRADER'S ACTIVE RULES (self-imposed discipline rules)
═══════════════════════════════════════════
This trader has defined the following rules for themselves. Check if the trade data shows violations.

ACTIVE RULES:
${activeRules!.map(r => {
  const val = r.value !== null ? ` (threshold: ${r.value}${r.value_str ? ' / ' + r.value_str : ''})` : (r.value_str ? ` (${r.value_str})` : '')
  return `• [${r.rule_type}] ${r.label}${val}`
}).join('\n')}

${ruleViolations && ruleViolations.length > 0 ? `DETECTED VIOLATIONS:
${ruleViolations.map(v => `• ${v.label}: violated ${v.count} time(s)\n  ${v.examples.join('\n  ')}`).join('\n')}` : 'No specific violations could be auto-detected from the data.'}

Revenge trades detected: ${revengeTradeCount} (trades opened within 15 minutes of a loss)` : ''}

═══════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════
Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "grade": "A+/A/A-/B+/B/B-/C+/C/C-/D/F",
  "grade_reason": "One specific sentence referencing exact metrics that justify this grade",
  "strengths": ["strength1 with specific numbers", "strength2 with specific numbers", "strength3"],
  "weaknesses": ["weakness1 with specific numbers", "weakness2 with specific numbers", "weakness3"],
  "blind_spots": ["something the trader doesn't realize about their own patterns", "another blind spot"],
  "revenge_trading_detected": ${revengeTradeCount > 0},
  "best_session": "${bestSession}",
  "worst_session": "${worstSession}",
  "best_day": "${bestDay}",
  "worst_day": "${worstDay}",
  "risk_score": 0-10,
  "consistency_score": 0-10,
  "discipline_score": 0-10,
  "rules_compliance_score": ${hasRules ? '0-10 (10 = no violations, 0 = all rules broken)' : '0'},
  "rules_analysis": ${hasRules ? '["Per-rule observation 1", "Per-rule observation 2"]' : '[]'},
  "emotion_insights": ${hasEmotions ? '["Emotion pattern 1", "Emotion pattern 2", "Emotion pattern 3"]' : '[]'},
  "action_plan": ["Specific action 1", "Specific action 2", "Specific action 3", "Specific action 4", "Specific action 5"],
  "summary": "3-4 paragraph personal message written DIRECTLY to the trader using 'you'. First paragraph: overall performance summary. Second paragraph: psychology and emotion patterns (if available). Third paragraph: rule compliance and discipline (if rules exist). Fourth paragraph: what to focus on this week.",
  "trades_analyzed": ${stats.totalTrades}
}

Be BRUTALLY HONEST but constructive. Reference exact numbers. This report should feel like it was written by a world-class trading coach who studied every single trade.`
}

// ── API callers ────────────────────────────────────────────────────────────────

async function callGemini(input: AIReportInput): Promise<AIReportOutput> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(input) }] }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.7 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.json()
    const error = new Error(err.error?.message || 'Gemini API error') as any
    error.status = response.status
    throw error
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')
  return JSON.parse(text) as AIReportOutput
}

async function callGroq(input: AIReportInput): Promise<AIReportOutput> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are GoldBook\'s elite trading coach. Always respond with valid JSON only. No markdown, no code blocks.',
        },
        { role: 'user', content: buildPrompt(input) },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'Groq API error')
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty Groq response')
  return JSON.parse(text) as AIReportOutput
}

// ── Rule violation checker (runs server-side before calling AI) ───────────────

export function checkRuleViolations(
  trades: any[],
  rules: TradingRule[]
): { violations: RuleViolation[]; revengeTradeCount: number } {
  const violations: RuleViolation[] = []

  // Group closed trades by calendar day
  const byDay: Record<string, any[]> = {}
  for (const t of trades) {
    if (!t.close_time) continue
    const day = t.close_time.split('T')[0]
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(t)
  }

  for (const rule of rules) {
    const v: RuleViolation = { rule_type: rule.rule_type, label: rule.label, count: 0, examples: [] }

    if (rule.rule_type === 'daily_loss_limit' && rule.value !== null) {
      for (const [day, dayTrades] of Object.entries(byDay)) {
        const dayLoss = dayTrades.reduce((s, t) => s + (t.net_profit ?? 0), 0)
        if (dayLoss < -rule.value) {
          v.count++
          v.examples.push(`${day}: day P&L was $${dayLoss.toFixed(2)} (limit: -$${rule.value})`)
        }
      }
    }

    if (rule.rule_type === 'max_trades_per_day' && rule.value !== null) {
      for (const [day, dayTrades] of Object.entries(byDay)) {
        if (dayTrades.length > rule.value) {
          v.count++
          v.examples.push(`${day}: ${dayTrades.length} trades taken (limit: ${rule.value})`)
        }
      }
    }

    if (rule.rule_type === 'max_lot_size' && rule.value !== null) {
      for (const t of trades) {
        if ((t.lot_size ?? 0) > rule.value) {
          v.count++
          v.examples.push(`${t.symbol} trade: ${t.lot_size} lots (limit: ${rule.value})`)
        }
      }
    }

    if (rule.rule_type === 'min_rr_ratio' && rule.value !== null) {
      for (const t of trades) {
        if (t.rr_ratio !== null && t.rr_ratio < rule.value) {
          v.count++
          v.examples.push(`${t.symbol} trade: R:R was ${t.rr_ratio?.toFixed(2)} (min: ${rule.value})`)
        }
      }
    }

    if (v.count > 0) violations.push({ ...v, examples: v.examples.slice(0, 3) })
  }

  // Revenge trades: any trade opened within 15 min of a losing close
  let revengeTradeCount = 0
  const sortedByOpen = [...trades].filter(t => t.open_time).sort(
    (a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime()
  )
  const losses = trades.filter(t => t.close_time && (t.net_profit ?? 0) < 0)

  for (const loss of losses) {
    const lossClose = new Date(loss.close_time).getTime()
    const nextTrade = sortedByOpen.find(t => {
      const open = new Date(t.open_time).getTime()
      return open > lossClose && open < lossClose + 15 * 60 * 1000
    })
    if (nextTrade) revengeTradeCount++
  }

  return { violations, revengeTradeCount }
}

// ── Emotion stats aggregator ─────────────────────────────────────────────────

export function buildEmotionStats(
  trades: any[]
): Record<string, { wins: number; total: number; avgPnl: number }> {
  const stats: Record<string, { wins: number; total: number; totalPnl: number }> = {}

  for (const t of trades) {
    if (!t.emotion_before) continue
    const emotion = t.emotion_before.toLowerCase().trim()
    if (!stats[emotion]) stats[emotion] = { wins: 0, total: 0, totalPnl: 0 }
    stats[emotion].total++
    stats[emotion].totalPnl += t.net_profit ?? 0
    if ((t.net_profit ?? 0) > 0) stats[emotion].wins++
  }

  return Object.fromEntries(
    Object.entries(stats)
      .filter(([, v]) => v.total >= 2)  // only meaningful patterns
      .map(([emotion, v]) => [emotion, { wins: v.wins, total: v.total, avgPnl: v.totalPnl / v.total }])
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateAIReport(
  input: AIReportInput
): Promise<{ report: AIReportOutput; provider: 'gemini' | 'groq' }> {
  try {
    const report = await callGemini(input)
    return { report, provider: 'gemini' }
  } catch (err: any) {
    console.warn(`Gemini failed (${err.status ?? err.message}), falling back to Groq...`)
    const report = await callGroq(input)
    return { report, provider: 'groq' }
  }
}
