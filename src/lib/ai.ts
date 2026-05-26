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

import type { PerformanceStats, SessionStat, DayStat, Trade } from './calculations'

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

export interface LinguisticTelemetry {
  agency_ratio: number           // Locus of control: ratio of internal words to external words
  regret_density: number          // Frequency of regret words like "should have", "if only"
  absolutist_count: number        // Frequency of "always", "never", "completely"
  self_attack_score: number       // Count of self-deprecating words like "idiot", "loser", "stupid"
  temporal_orientation: 'past' | 'present' | 'future'
  identity_fusion_phrases: string[] // E.g., "I am a failure", "not cut out for this"
}

export interface PsychologicalTelemetry {
  lossAversionRatio: number
  avgWinDurationSeconds: number
  avgLossDurationSeconds: number
  revengeSizingMultiplier: number
  revengeTradesCount: number
  revengeTradesTotalPnl: number
  normalExpectancy: number
  normalWinRate: number
  exhaustionExpectancy: number
  exhaustionWinRate: number
  exhaustionTradesCount: number
  emotionChecklistCompliance: Record<string, { totalTrades: number; avgCompliance: number }>
}

export interface CognitiveBias {
  bias_name: "Loss Aversion" | "Revenge Trading" | "Overconfidence/FOMO" | "Mental Fatigue"
  severity: 'critical' | 'moderate' | 'healthy'
  evidence: string
  description: string
  psychological_exercise: string
}

export interface EmotionCorrelation {
  emotion: string
  total_trades: number
  win_rate: number
  avg_pnl: number
  avg_hold_time_seconds: number
  avg_lot_size: number
  checklist_compliance_rate: number
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
  telemetry?: PsychologicalTelemetry
  linguisticTelemetry?: LinguisticTelemetry
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
  cognitive_biases?: CognitiveBias[]
  emotion_correlations?: EmotionCorrelation[]
  discipline_breaches_correlation?: string
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(input: AIReportInput): string {
  const {
    stats, sessionStats, dayStats, topSymbols,
    emotionStats, activeRules, ruleViolations,
    revengeTradeCount = 0, period, telemetry,
    linguisticTelemetry
  } = input

  const bestSession = Object.entries(sessionStats).sort((a, b) => b[1].pnl - a[1].pnl)[0]?.[0] ?? 'N/A'
  const worstSession = Object.entries(sessionStats).sort((a, b) => a[1].pnl - b[1].pnl)[0]?.[0] ?? 'N/A'
  const bestDay = [...dayStats].sort((a, b) => b.pnl - a.pnl)[0]?.day ?? 'N/A'
  const worstDay = [...dayStats].sort((a, b) => a.pnl - b.pnl)[0]?.day ?? 'N/A'

  const hasRules = activeRules && activeRules.length > 0
  const hasEmotions = emotionStats && Object.keys(emotionStats).length > 0
  const hasTelemetry = !!telemetry

  const telemetrySection = hasTelemetry ? `
═══════════════════════════════════════════
PSYCHOLOGICAL TELEMETRY EVIDENCE (Computed Engine)
═══════════════════════════════════════════
• Loss Aversion Ratio: ${telemetry.lossAversionRatio.toFixed(2)}x (Losing trades held on average for ${telemetry.avgLossDurationSeconds.toFixed(1)}s, while winning trades held for ${telemetry.avgWinDurationSeconds.toFixed(1)}s)
• Revenge Trading Sizing Multiplier: ${telemetry.revengeSizingMultiplier.toFixed(2)}x (Average lot size change on trades taken within emotional revenge decay windows)
• Revenge Trades Count: ${telemetry.revengeTradesCount} trade(s) | Total Revenge P&L: $${telemetry.revengeTradesTotalPnl.toFixed(2)}
• Overtrading / Fatigue Expectancy Decay:
  - Normal (first 4 daily trades) Expectancy: $${telemetry.normalExpectancy.toFixed(2)} | Win Rate: ${telemetry.normalWinRate.toFixed(1)}%
  - Exhaustion (5th+ daily trade) Expectancy: $${telemetry.exhaustionExpectancy.toFixed(2)} | Win Rate: ${telemetry.exhaustionWinRate.toFixed(1)}%
  - Exhaustion Trades Count: ${telemetry.exhaustionTradesCount}
• Checklist Compliance by Pre-Trade Emotion:
${Object.entries(telemetry.emotionChecklistCompliance).map(([emo, val]) => `  - "${emo}": ${val.avgCompliance.toFixed(1)}% avg compliance over ${val.totalTrades} trade(s)`).join('\n')}
` : ''

  const hasLinguistic = !!linguisticTelemetry
  const linguisticSection = hasLinguistic ? `
═══════════════════════════════════════════
NARRATIVE & LINGUISTIC TELEMETRY EVIDENCE (Scanned from Journal)
═══════════════════════════════════════════
• Locus of Control (Agency Ratio): ${linguisticTelemetry.agency_ratio.toFixed(2)}x (Ratio of internal accountability phrasing vs. external market blame. Values < 1.0 indicate victim-state external blame.)
• Regret Loop Density: ${linguisticTelemetry.regret_density.toFixed(2)} loops/entry (Frequency of "should have", "if only", "could have" phrasing)
• Absolutist Black-and-White Language: ${linguisticTelemetry.absolutist_count} phrase(s) ("always", "never", "ruined", "perfect", "completely")
• Self-Criticism / Self-Attack loops: ${linguisticTelemetry.self_attack_score} instance(s) ("idiot", "loser", "stupid", "failure", "mess")
• Temporal Orientation: Predominantly oriented towards the ${linguisticTelemetry.temporal_orientation}
• Identity Fusion loops identified: ${linguisticTelemetry.identity_fusion_phrases.length > 0 ? linguisticTelemetry.identity_fusion_phrases.map(p => `"${p}"`).join(', ') : 'None detected'}
` : ''

  return `You are Nirikshan, GoldBook's elite trading coach and psychologist, specialized in intraday and swing trading.

Analyze this trader's ${period} metrics and narrative journal text to generate a DEEP, PERSONALIZED cognitive behavioral coaching report. Reference exact numbers — never give generic advice.

THERAPEUTIC & COACHING PRINCIPLES — follow strictly:
- TONE: Use COMPASSIONATE PRECISION. Never be harshly accusatory, critical, or trigger shame spirals. Act as a supportive, world-class performance psychologist. Frame weaknesses as curiosity-driven, reflective inquiries (e.g. "I see your win rate is 54% on your first 4 trades — that's a strong edge. By trade 5, it drops to 12%. What changes in your decision-making or emotional state between trade 4 and trade 5?").
- STRATEGY VALIDATION: Never suggest changing a strategy setup that has at least 15 closed trades and a positive expectancy (Expectancy > 0), even if its win rate is low. A 40% win rate strategy with 1:3 Risk/Reward is highly viable. Validate their edge first, then help them protect it.
- NARRATIVE ALIGNMENT: Integrate the raw journal self-talk and linguistic telemetry (Agency Ratio, Regret Loops, Self-Attack patterns) into your analysis. Connect their mathematical performance directly to their subconscious identity narrative. Prove to them that you have read their exact words.
- ACTION PLAN: Design highly concrete, clinical cognitive exercises (e.g., CBT, breathing patterns, boundary rules) to resolve their specific biases. Focus on fixing identified patterns without adding unnecessary complexity.

- If a trader specializes, validate the specialization first, then identify risks WITHIN it
- Frame weaknesses as questions, not instructions: "Have you considered why you avoid shorting?" not "You should short more"
- The action plan should fix identified problems, not add new experiments
- A trader with a high profit factor does NOT need to change their strategy — they need to understand WHY it works and protect it

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
${telemetrySection}
${linguisticSection}

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
  "trades_analyzed": ${stats.totalTrades},
  "cognitive_biases": [
    {
      "bias_name": "Loss Aversion",
      "severity": "critical" | "moderate" | "healthy",
      "evidence": "E.g., losing trades held on average 3.2x longer than wins, or average loss holding time is 1800s vs 560s for wins",
      "description": "Short explanation of this bias in the context of their trades",
      "psychological_exercise": "A concrete, clinical cognitive exercise to mitigate this bias during active trading"
    },
    {
      "bias_name": "Revenge Trading",
      "severity": "critical" | "moderate" | "healthy",
      "evidence": "E.g., sizing multiplier is 1.8x on trades taken within 15 minutes of a loss, resulting in -$450 total loss",
      "description": "Short explanation",
      "psychological_exercise": "Concrete clinical exercise to run when facing revenge triggers"
    },
    {
      "bias_name": "Overconfidence/FOMO",
      "severity": "critical" | "moderate" | "healthy",
      "evidence": "E.g., average checklist compliance drops to 30% when feeling excited or greedy",
      "description": "Short explanation",
      "psychological_exercise": "Exercise to reset emotional hyper-arousal"
    },
    {
      "bias_name": "Mental Fatigue",
      "severity": "critical" | "moderate" | "healthy",
      "evidence": "E.g., win rate decays from 55% on normal trades to 25% on exhaustion trades (5th+ daily trade)",
      "description": "Short explanation",
      "psychological_exercise": "Specific strict daily limit exercise to enforce rules and avoid decision fatigue"
    }
  ],
  "emotion_correlations": [
    {
      "emotion": "confident",
      "total_trades": 12,
      "win_rate": 58.3,
      "avg_pnl": 120.5,
      "avg_hold_time_seconds": 450,
      "avg_lot_size": 1.2,
      "checklist_compliance_rate": 85.0
    }
  ],
  "discipline_breaches_correlation": "Citing evidence of how emotions directly degraded rule compliance or caused breaches, correlating rules to pre-trade emotional states."
}

Be BRUTALLY HONEST but constructive. Reference exact numbers. This report should feel like it was written by a world-class trading coach who studied every single trade.`
}

// ── API callers (2-Stage Pipeline with Free Tier Quota Fallbacks) ──────────────

interface ProviderQuota {
  groq_r1: number      // 1,000 requests per day (RPD)
  groq_llama: number   // 1,000 RPD
  gemini_flash: number // 1,500 RPD
}

const dailyQuota: ProviderQuota = {
  groq_r1: 0,
  groq_llama: 0,
  gemini_flash: 0
}

// Reset at midnight UTC
if (typeof global !== 'undefined') {
  const intervalId = setInterval(() => {
    dailyQuota.groq_r1 = 0
    dailyQuota.groq_llama = 0
    dailyQuota.gemini_flash = 0
  }, 24 * 60 * 60 * 1000)
  if (intervalId.unref) intervalId.unref()
}

async function callStage1WithFallback(prompt: string): Promise<{ text: string; provider: 'groq_r1' | 'groq_llama' | 'gemini_flash' }> {
  // If user has configured a direct full DeepSeek R1 key, try that first
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-reasoner',
          messages: [{ role: 'user', content: prompt }]
        })
      })
      if (response.ok) {
        const data = await response.json()
        const text = data.choices?.[0]?.message?.content
        if (text) {
          return { text, provider: 'groq_r1' }
        }
      }
    } catch (e) {
      console.warn('Direct DeepSeek R1 API failed, falling back to free-tier router:', e)
    }
  }

  // 1. Try Groq DeepSeek-R1-Distill-Llama-70B first (highly reliable free reasoning)
  if (dailyQuota.groq_r1 < 950 && process.env.GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-r1-distill-llama-70b',
          messages: [
            {
              role: 'system',
              content: 'You are Nirikshan, GoldBook\'s elite trading psychologist. Provide a deep, free-form narrative analysis of the user\'s trading psychological profile. Output your thinking process clearly.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.6,
          max_tokens: 4096
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        const text = data.choices?.[0]?.message?.content
        if (text) {
          dailyQuota.groq_r1++
          return { text, provider: 'groq_r1' }
        }
      } else if (response.status === 429) {
        dailyQuota.groq_r1 = 1000
      }
    } catch (e) {
      console.warn('Groq R1 distill failed:', e)
    }
  }

  // 2. Fallback: Groq Llama 3.3 70B (separate quota)
  if (dailyQuota.groq_llama < 950 && process.env.GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are Nirikshan, GoldBook\'s elite trading psychologist. Provide a deep, free-form narrative analysis of the user\'s trading psychological profile.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4096
        })
      })

      if (response.ok) {
        const data = await response.json()
        const text = data.choices?.[0]?.message?.content
        if (text) {
          dailyQuota.groq_llama++
          return { text, provider: 'groq_llama' }
        }
      } else if (response.status === 429) {
        dailyQuota.groq_llama = 1000
      }
    } catch (e) {
      console.warn('Groq Llama fallback failed:', e)
    }
  }

  // 3. Fallback: Gemini Flash (free tier 1,500 RPD)
  if (dailyQuota.gemini_flash < 1450 && process.env.GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7 }
          })
        }
      )

      if (response.ok) {
        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          dailyQuota.gemini_flash++
          return { text, provider: 'gemini_flash' }
        }
      } else if (response.status === 429) {
        dailyQuota.gemini_flash = 1500
      }
    } catch (e) {
      console.warn('Gemini Stage 1 fallback failed:', e)
    }
  }

  throw new Error('All free-tier AI API routing quotas have been exhausted. Please wait or try again later.')
}

async function callStage2Formatting(r1AnalysisText: string, promptInput: AIReportInput): Promise<AIReportOutput> {
  const sanitizedAnalysis = sanitizeForJson(r1AnalysisText)
  
  const formattingPrompt = `You are a strict data-restructuring agent.
Take this expert clinical trading psychology analysis and restructure it EXACTLY into the requested JSON schema.

---
EXPERT ANALYSIS TO PARSE:
${sanitizedAnalysis}
---

Return ONLY valid JSON matching this exact structure:
{
  "grade": "A+/A/A-/B+/B/B-/C+/C/C-/D/F",
  "grade_reason": "One specific sentence referencing exact metrics from the analysis that justify this grade",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "blind_spots": ["blind spot 1", "blind spot 2"],
  "revenge_trading_detected": ${promptInput.revengeTradeCount && promptInput.revengeTradeCount > 0 ? 'true' : 'false'},
  "best_session": "${Object.keys(promptInput.sessionStats).length > 0 ? Object.keys(promptInput.sessionStats)[0] : 'N/A'}",
  "worst_session": "${Object.keys(promptInput.sessionStats).length > 0 ? Object.keys(promptInput.sessionStats)[0] : 'N/A'}",
  "best_day": "${promptInput.dayStats.length > 0 ? promptInput.dayStats[0].day : 'N/A'}",
  "worst_day": "${promptInput.dayStats.length > 0 ? promptInput.dayStats[0].day : 'N/A'}",
  "risk_score": 0-10,
  "consistency_score": 0-10,
  "discipline_score": 0-10,
  "rules_compliance_score": 0-10,
  "rules_analysis": ["Per-rule observation 1", "Per-rule observation 2"],
  "emotion_insights": ["Emotion pattern 1", "Emotion pattern 2"],
  "action_plan": ["Specific action 1", "Specific action 2", "Specific action 3", "Specific action 4", "Specific action 5"],
  "summary": "3-4 paragraph personal message written DIRECTLY to the trader using 'you'. Copy the summary or rewrite it beautifully using the expert analysis.",
  "trades_analyzed": ${promptInput.stats.totalTrades},
  "cognitive_biases": [
    {
      "bias_name": "Loss Aversion",
      "severity": "critical" | "moderate" | "healthy",
      "evidence": "Citing exact holding times or loss ratios",
      "description": "Short explanation",
      "psychological_exercise": "Clinical exercise"
    },
    {
      "bias_name": "Revenge Trading",
      "severity": "critical" | "moderate" | "healthy",
      "evidence": "Citing revenge trades counts or lot size sizing multiplier",
      "description": "Short explanation",
      "psychological_exercise": "Clinical exercise"
    },
    {
      "bias_name": "Overconfidence/FOMO",
      "severity": "critical" | "moderate" | "healthy",
      "evidence": "Citing checklist compliance drops during excitement",
      "description": "Short explanation",
      "psychological_exercise": "Clinical exercise"
    },
    {
      "bias_name": "Mental Fatigue",
      "severity": "critical" | "moderate" | "healthy",
      "evidence": "Citing win rate decay on 5th+ daily trade",
      "description": "Short explanation",
      "psychological_exercise": "Clinical exercise"
    }
  ],
  "emotion_correlations": [
    {
      "emotion": "confident",
      "total_trades": 12,
      "win_rate": 58.3,
      "avg_pnl": 120.5,
      "avg_hold_time_seconds": 450,
      "avg_lot_size": 1.2,
      "checklist_compliance_rate": 85.0
    }
  ],
  "discipline_breaches_correlation": "Correlation of rules to emotional states citing exact evidence."
}

Do NOT wrap in markdown code blocks. Respond with pure raw JSON only. Ensure all quotes are escaped properly.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: formattingPrompt }] }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.2 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'Gemini formatting failed')
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini formatting response')

  try {
    return JSON.parse(text) as AIReportOutput
  } catch (parseErr) {
    console.error('Failed to parse Gemini formatted JSON, retrying once with clean-up...', parseErr)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AIReportOutput
    }
    throw parseErr
  }
}

// ── Rule violation checker (runs server-side before calling AI) ───────────────

export function checkRuleViolations(
  trades: any[],
  rules: TradingRule[],
  accountBalance?: number,
  tradingStyle?: string
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
      // rule.value is a percentage (e.g., 5 means 5% of balance)
      const dollarLimit = accountBalance ? accountBalance * (rule.value / 100) : rule.value // Fallback to raw value if no balance
      for (const [day, dayTrades] of Object.entries(byDay)) {
        const dayLoss = dayTrades.reduce((s, t) => s + (t.net_profit ?? 0), 0)
        if (dayLoss < -dollarLimit) {
          v.count++
          v.examples.push(`${day}: day P&L was $${dayLoss.toFixed(2)} (limit: -$${dollarLimit.toFixed(2)}${accountBalance ? ` based on ${rule.value}% of balance` : ''})`)
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

  // Set decay constant tau based on user's trading style
  const style = (tradingStyle || 'day_trading').toLowerCase().trim()
  const tau = style.includes('scalp') ? 15 
            : style.includes('swing') ? 120 
            : 45 // day_trading / default fallback

  // Revenge trades: any trade opened within emotional decay window of a losing close
  let revengeTradeCount = 0
  const sortedByOpen = [...trades].filter(t => t.open_time).sort(
    (a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime()
  )
  const losses = trades.filter(t => t.close_time && (t.net_profit ?? 0) < 0)

  for (const loss of losses) {
    const lossClose = new Date(loss.close_time).getTime()
    
    const nextTrade = sortedByOpen.find(t => {
      const open = new Date(t.open_time).getTime()
      if (open <= lossClose) return false
      
      const deltaMinutes = (open - lossClose) / (60 * 1000)
      if (deltaMinutes > 120) return false // Caps window at 2 hours
      
      // Calculate multiplier factor S: 1.5 if size increased, 1.0 otherwise
      const precedingLot = loss.lot_size || 1.0
      const currentLot = t.lot_size || 1.0
      const S = currentLot > precedingLot ? 1.5 : 1.0
      
      // Calculate emotional trigger factor E: 1.3 if negative/greed emotion
      const cleanEmo = String(t.emotion_before || '').toLowerCase().trim()
      const isNegativeEmotion = ['anxious', 'frustrated', 'fomo', 'greedy', 'fearful', 'angry'].includes(cleanEmo)
      const E = isNegativeEmotion ? 1.3 : 1.0
      
      // Revenge Probability Score with exponential decay
      const pRevenge = Math.exp(-deltaMinutes / tau) * S * E
      return pRevenge >= 0.35
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

// ── Psychological Telemetry Engine ──────────────────────────────────────────

export function compilePsychologicalTelemetry(trades: Trade[]): PsychologicalTelemetry {
  const closed = trades.filter(t => t.status === 'closed' && t.net_profit !== null)

  // 1. Loss Aversion Ratio
  let winSumDuration = 0, winCount = 0
  let lossSumDuration = 0, lossCount = 0

  for (const t of closed) {
    const openTime = t.open_time ? new Date(t.open_time).getTime() : null
    const closeTime = t.close_time ? new Date(t.close_time).getTime() : null
    const duration = (openTime && closeTime) ? (closeTime - openTime) / 1000 : (t.duration_seconds ?? 0)

    if (duration > 0) {
      if ((t.net_profit ?? 0) > 0) {
        winSumDuration += duration
        winCount++
      } else {
        lossSumDuration += duration
        lossCount++
      }
    }
  }

  const avgWinDurationSeconds = winCount > 0 ? winSumDuration / winCount : 0
  const avgLossDurationSeconds = lossCount > 0 ? lossSumDuration / lossCount : 0
  const lossAversionRatio = avgWinDurationSeconds > 0 ? avgLossDurationSeconds / avgWinDurationSeconds : 1.0

  // 2. Revenge Sizing Multiplier
  let revengeTradesCount = 0
  let revengeTradesTotalPnl = 0
  let revengeSizingMultiplierSum = 0

  const sortedByOpen = [...trades].filter(t => t.open_time).sort(
    (a, b) => new Date(a.open_time!).getTime() - new Date(b.open_time!).getTime()
  )

  for (let i = 1; i < sortedByOpen.length; i++) {
    const current = sortedByOpen[i]
    if (!current.open_time) continue
    const currentOpenTime = new Date(current.open_time).getTime()
    
    // Find if there is a trade that closed as a loss within 15 mins before this opened
    const precedingLoss = sortedByOpen.slice(0, i).reverse().find(prev => {
      if (!prev.close_time || (prev.net_profit ?? 0) >= 0) return false
      const prevCloseTime = new Date(prev.close_time).getTime()
      return currentOpenTime > prevCloseTime && currentOpenTime < prevCloseTime + 15 * 60 * 1000
    })

    if (precedingLoss) {
      revengeTradesCount++
      revengeTradesTotalPnl += current.net_profit ?? 0
      const currentLot = current.lot_size ?? 1.0
      const precedingLot = precedingLoss.lot_size ?? 1.0
      revengeSizingMultiplierSum += precedingLot > 0 ? currentLot / precedingLot : 1.0
    }
  }

  const revengeSizingMultiplier = revengeTradesCount > 0 ? revengeSizingMultiplierSum / revengeTradesCount : 1.0

  // 3. Overtrading / Expectancy Decay (trades after 4th trade of the day)
  const byDay: Record<string, Trade[]> = {}
  for (const t of sortedByOpen) {
    if (!t.open_time) continue
    const dateStr = t.open_time.split('T')[0]
    if (!byDay[dateStr]) byDay[dateStr] = []
    byDay[dateStr].push(t)
  }

  let normalPnlSum = 0, normalClosedCount = 0, normalWins = 0
  let exhaustionPnlSum = 0, exhaustionClosedCount = 0, exhaustionWins = 0

  for (const [, dayTrades] of Object.entries(byDay)) {
    dayTrades.forEach((t, index) => {
      if (t.status !== 'closed' || t.net_profit === null) return
      if (index < 4) {
        normalPnlSum += t.net_profit
        normalClosedCount++
        if (t.net_profit > 0) normalWins++
      } else {
        exhaustionPnlSum += t.net_profit
        exhaustionClosedCount++
        if (t.net_profit > 0) exhaustionWins++
      }
    })
  }

  const normalExpectancy = normalClosedCount > 0 ? normalPnlSum / normalClosedCount : 0
  const normalWinRate = normalClosedCount > 0 ? (normalWins / normalClosedCount) * 100 : 0
  const exhaustionExpectancy = exhaustionClosedCount > 0 ? exhaustionPnlSum / exhaustionClosedCount : 0
  const exhaustionWinRate = exhaustionClosedCount > 0 ? (exhaustionWins / exhaustionClosedCount) * 100 : 0

  // 4. Checklist Compliance per Emotion
  const complianceByEmotion: Record<string, { sum: number; count: number }> = {}

  for (const t of closed) {
    if (!t.emotion_before) continue
    const emotion = t.emotion_before.toLowerCase().trim()

    let compliance: number | null = null
    if (t.pre_trade_checklist && Object.keys(t.pre_trade_checklist).length > 0) {
      const totalItems = Object.keys(t.pre_trade_checklist).length
      const completedItems = Object.values(t.pre_trade_checklist).filter(Boolean).length
      compliance = (completedItems / totalItems) * 100
    } else if (t.followed_plan !== null && t.followed_plan !== undefined) {
      compliance = t.followed_plan ? 100 : 0
    }

    if (compliance !== null) {
      if (!complianceByEmotion[emotion]) {
        complianceByEmotion[emotion] = { sum: 0, count: 0 }
      }
      complianceByEmotion[emotion].sum += compliance
      complianceByEmotion[emotion].count++
    }
  }

  const emotionChecklistCompliance: Record<string, { totalTrades: number; avgCompliance: number }> = {}
  for (const [emotion, stats] of Object.entries(complianceByEmotion)) {
    emotionChecklistCompliance[emotion] = {
      totalTrades: stats.count,
      avgCompliance: stats.sum / stats.count
    }
  }

  return {
    lossAversionRatio,
    avgWinDurationSeconds,
    avgLossDurationSeconds,
    revengeSizingMultiplier,
    revengeTradesCount,
    revengeTradesTotalPnl,
    normalExpectancy,
    normalWinRate,
    exhaustionExpectancy,
    exhaustionWinRate,
    exhaustionTradesCount: exhaustionClosedCount,
    emotionChecklistCompliance
  }
}

// ── JSON Notes Parser Helper ─────────────────────────────────────────────────

export function extractTextFromNotes(notes: string | null): string {
  if (!notes) return ''
  const trimmed = notes.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        if (parsed.isCustom && parsed.values) {
          const parts: string[] = []
          Object.values(parsed.values).forEach((val: any) => {
            if (typeof val === 'string') {
              parts.push(val)
            } else if (Array.isArray(val)) {
              val.forEach((item: any) => {
                if (typeof item === 'string') {
                  parts.push(item)
                } else if (item && typeof item === 'object') {
                  Object.entries(item).forEach(([k, cellVal]) => {
                    if (k !== 'id' && (typeof cellVal === 'string' || typeof cellVal === 'number')) {
                      parts.push(String(cellVal))
                    }
                  })
                }
              })
            }
          })
          return parts.filter(Boolean).join(' ')
        }

        const parts: string[] = []
        if (parsed.p1) parts.push(parsed.p1)
        if (parsed.p2) parts.push(parsed.p2)
        if (parsed.p3) parts.push(parsed.p3)
        if (parsed.p4) parts.push(parsed.p4)
        if (parsed.confirmations && Array.isArray(parsed.confirmations)) {
          parts.push(parsed.confirmations.join(' '))
        }
        return parts.filter(Boolean).join(' ')
      }
    } catch (e) {
      // Ignored: parse failure fallback to raw notes string
    }
  }

  return trimmed
}

// ── Linguistic Telemetry Engine ──────────────────────────────────────────────

export function compileLinguisticTelemetry(trades: Trade[]): LinguisticTelemetry {
  const closed = trades.filter(t => t.status === 'closed' && t.notes)
  
  let internalCount = 0
  let externalCount = 0
  let regretCount = 0
  let absolutistCount = 0
  let selfAttackCount = 0
  
  // Custom RegEx patterns optimized for serverless without heavy downloads
  const selfAttackRegex = /\b(?:idiot|stupid|loser|fail|mess|worthless|pathetic|fool|dumb|screw|screwup|horrible|terrible)\w*\b|what\s+was\s+i\s+thinking|why\s+do\s+i\s+always|how\s+could\s+i|what\s+am\s+i\s+doing/gi
  const regretRegex = /\b(?:should|regret|could|if\s+only|wish|mistake|why\s+did\b)\w*\b/gi
  const absolutistRegex = /\b(?:always|never|completely|perfect|ruin|disaster|totally|all|none)\w*\b/gi
  
  const internalLocusRegex = /\b(?:my\s+fault|my\s+plan|i\s+chose|i\s+decided|my\s+mistake|my\s+responsibility|i\s+violated|i\s+broke|my\s+rule|my\s+execution)\b/gi
  const externalLocusRegex = /\b(?:market|manipulat|luck|they\s+stopped|hunts\s+stop|unfair|scam|broker|rigged|bad\s+luck|news\s+manipulation)\w*\b/gi

  const identityFusionRegexes = [
    /\bi\s+am\s+a\s+failure\b/i,
    /\bnot\s+cut\s+out\s+for\b/i,
    /\bi'm\s+a\s+bad\s+trader\b/i,
    /\bi'm\s+a\s+loser\b/i,
    /\bi\s+always\s+fail\b/i
  ]

  const identityFusionPhrases: string[] = []
  let pastFocusCount = 0
  let presentFocusCount = 0
  let futureFocusCount = 0

  closed.forEach(t => {
    const text = extractTextFromNotes(t.notes)
    
    // Count matches
    const selfAttackMatches = text.match(selfAttackRegex)
    if (selfAttackMatches) selfAttackCount += selfAttackMatches.length
    
    const regretMatches = text.match(regretRegex)
    if (regretMatches) regretCount += regretMatches.length
    
    const absolutistMatches = text.match(absolutistRegex)
    if (absolutistMatches) absolutistCount += absolutistMatches.length
    
    const internalMatches = text.match(internalLocusRegex)
    if (internalMatches) internalCount += internalMatches.length
    
    const externalMatches = text.match(externalLocusRegex)
    if (externalMatches) externalCount += externalMatches.length
    
    // Proximity phrase matching
    identityFusionRegexes.forEach(regex => {
      const match = text.match(regex)
      if (match && !identityFusionPhrases.includes(match[0])) {
        identityFusionPhrases.push(match[0])
      }
    })

    // Temporal orientation estimation
    const words = text.toLowerCase().split(/\s+/)
    words.forEach(w => {
      if (['should', 'was', 'yesterday', 'past', 'then', 'could', 'had', 'did'].includes(w)) pastFocusCount++
      if (['is', 'now', 'today', 'executing', 'plan', 'am', 'feel', 'current'].includes(w)) presentFocusCount++
      if (['will', 'hope', 'tomorrow', 'next', 'plan', 'wish', 'would', 'target'].includes(w)) futureFocusCount++
    })
  })

  const agency_ratio = externalCount > 0 ? internalCount / externalCount : internalCount > 0 ? 2.0 : 1.0
  const regret_density = closed.length > 0 ? regretCount / closed.length : 0
  
  let temporal_orientation: 'past' | 'present' | 'future' = 'present'
  if (pastFocusCount > presentFocusCount && pastFocusCount > futureFocusCount) {
    temporal_orientation = 'past'
  } else if (futureFocusCount > presentFocusCount && futureFocusCount > pastFocusCount) {
    temporal_orientation = 'future'
  }

  return {
    agency_ratio,
    regret_density,
    absolutist_count: absolutistCount,
    self_attack_score: selfAttackCount,
    temporal_orientation,
    identity_fusion_phrases: identityFusionPhrases
  }
}

// ── Journal Quality Gate ─────────────────────────────────────────────────────

export function journalQualityGate(trades: Trade[]): { pass: boolean; wordCount: number; message?: string } {
  const closed = trades.filter(t => t.status === 'closed')
  if (closed.length === 0) {
    return { pass: true, wordCount: 0 }
  }

  const totalWords = closed.reduce((sum, e) => {
    const text = extractTextFromNotes(e.notes)
    if (!text) return sum
    return sum + text.split(/\s+/).length
  }, 0)

  const avgWords = totalWords / closed.length

  if (avgWords < 15) {
    return {
      pass: false,
      wordCount: totalWords,
      message: `Your journal narrative details are too brief for behavioral analysis (average is ${avgWords.toFixed(1)} words per entry, min threshold is 15.0). Nirikshan requires a richer reflection to diagnose subconscious self-talk. Try adding 2-3 detailed sentences in your closed trade notes about your emotional triggers, entry logic, and whether you hesitated before executing!`
    }
  }

  return { pass: true, wordCount: totalWords }
}

// ── Text Output Sanitizer ────────────────────────────────────────────────────

export function sanitizeForJson(input: string): string {
  let clean = input
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // Remove reasoning chains
    .replace(/```(?:json)?[\s\S]*?```/gi, '') // Remove code blocks
    .trim()
  return clean.substring(0, 10000)
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateAIReport(
  input: AIReportInput
): Promise<{ report: AIReportOutput; provider: 'gemini' | 'groq' }> {
  // 1. Stage 1: Free-text deep analysis reasoning call
  const prompt = buildPrompt(input)
  const { text: r1AnalysisText, provider: stage1Provider } = await callStage1WithFallback(prompt)

  // 2. Stage 2: Structural JSON formatting call
  const structuredReport = await callStage2Formatting(r1AnalysisText, input)

  const finalProvider = stage1Provider === 'gemini_flash' ? 'gemini' : 'groq'
  return { report: structuredReport, provider: finalProvider as 'gemini' | 'groq' }
}
