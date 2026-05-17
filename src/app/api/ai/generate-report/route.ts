import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  computeStats,
  computeSessionStats,
  computeDayStats,
  computeTopSymbols,
} from '@/lib/calculations'
import {
  generateAIReport,
  checkRuleViolations,
  buildEmotionStats,
  type TradingRule,
} from '@/lib/ai'
import type { Trade } from '@/lib/calculations'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { accountId } = await req.json()

    // ── 1. Fetch trades ─────────────────────────────────────────────────────
    let query = supabase.from('trades').select('*').eq('user_id', user.id)
    if (accountId) query = query.eq('account_id', accountId)

    const { data: trades, error: tradesError } = await query
    if (tradesError) throw new Error(tradesError.message)
    const allTrades = (trades ?? []) as Trade[]

    // ── 2. Fetch active trading rules ───────────────────────────────────────
    const { data: rulesData } = await supabase
      .from('trading_rules')
      .select('rule_type, label, value, value_str')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const activeRules = (rulesData ?? []) as TradingRule[]

    // ── 3. Check rule violations + revenge trades ───────────────────────────
    let accountBalance: number | undefined = undefined
    if (accountId) {
      const { data: acc } = await supabase.from('mt5_accounts').select('current_balance, initial_balance').eq('id', accountId).single()
      if (acc) accountBalance = acc.current_balance ?? acc.initial_balance
    }

    const { violations: ruleViolations, revengeTradeCount } =
      checkRuleViolations(allTrades, activeRules, accountBalance)

    // ── 4. Build emotion stats from journal ─────────────────────────────────
    const emotionStats = buildEmotionStats(allTrades)

    // ── 5. Compute all trading stats ────────────────────────────────────────
    const stats = computeStats(allTrades)
    const sessionStats = computeSessionStats(allTrades)
    const dayStats = computeDayStats(allTrades)
    const topSymbols = computeTopSymbols(allTrades)

    // ── 6. Call AI coach ────────────────────────────────────────────────────
    const { report, provider } = await generateAIReport({
      stats,
      sessionStats,
      dayStats,
      topSymbols,
      emotionStats: Object.keys(emotionStats).length > 0 ? emotionStats : undefined,
      activeRules: activeRules.length > 0 ? activeRules : undefined,
      ruleViolations: ruleViolations.length > 0 ? ruleViolations : undefined,
      revengeTradeCount,
      period: 'alltime',
    })

    // ── 7. Save report to DB ────────────────────────────────────────────────
    await supabase.from('ai_reports').insert({
      user_id: user.id,
      account_id: accountId ?? null,
      report_period: 'alltime',
      grade: report.grade,
      grade_reason: report.grade_reason,
      strengths: report.strengths,
      weaknesses: report.weaknesses,
      blind_spots: report.blind_spots,
      revenge_trading_detected: report.revenge_trading_detected,
      best_session: report.best_session,
      worst_session: report.worst_session,
      best_day: report.best_day,
      worst_day: report.worst_day,
      risk_score: report.risk_score,
      consistency_score: report.consistency_score,
      discipline_score: report.discipline_score,
      action_plan: report.action_plan,
      summary: report.summary,
      trades_analyzed: stats.totalTrades,
      rules_analysis: {
        compliance_score: report.rules_compliance_score,
        observations: report.rules_analysis,
        emotion_insights: report.emotion_insights,
        violations_count: ruleViolations.reduce((s, v) => s + v.count, 0),
        revenge_trades: revengeTradeCount,
      },
      rules_violations_count: ruleViolations.reduce((s, v) => s + v.count, 0),
      rules_compliance_score: report.rules_compliance_score,
    })

    // ── 8. Write detected violations to rule_violations table ──────────────
    if (ruleViolations.length > 0) {
      const { data: rulesRows } = await supabase
        .from('trading_rules')
        .select('id, rule_type')
        .eq('user_id', user.id)
        .eq('is_active', true)

      const ruleIdMap = Object.fromEntries(
        (rulesRows ?? []).map(r => [r.rule_type, r.id])
      )

      const violationRows = ruleViolations.flatMap(v =>
        v.examples.map(desc => ({
          user_id: user.id,
          rule_id: ruleIdMap[v.rule_type] ?? null,
          rule_type: v.rule_type,
          description: desc,
          severity: v.count > 3 ? 'critical' : 'warning',
        }))
      )

      if (violationRows.length > 0) {
        await supabase.from('rule_violations').insert(violationRows)
      }
    }

    return NextResponse.json({
      report,
      provider,
      meta: {
        emotionPatternsFound: Object.keys(emotionStats).length,
        activeRules: activeRules.length,
        ruleViolations: ruleViolations.reduce((s, v) => s + v.count, 0),
        revengeTradeCount,
      },
    })
  } catch (err: any) {
    console.error('AI report error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
