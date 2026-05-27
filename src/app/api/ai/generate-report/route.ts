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
  compilePsychologicalTelemetry,
  compileLinguisticTelemetry,
  journalQualityGate,
  compileCustomJournalIntelligence,
  type TradingRule,
} from '@/lib/ai'
import type { Trade } from '@/lib/calculations'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { accountId } = await req.json()

    // Verify that the account belongs to the authenticated user to prevent parameter injection
    if (accountId) {
      const { data: acc } = await supabase
        .from('mt5_accounts')
        .select('user_id')
        .eq('id', accountId)
        .single()

      if (!acc || acc.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden: Account does not belong to user.' }, { status: 403 })
      }
    }

    // ── 1. Fetch trades ─────────────────────────────────────────────────────
    let query = supabase.from('trades').select('*').eq('user_id', user.id)
    if (accountId) query = query.eq('account_id', accountId)

    const { data: trades, error: tradesError } = await query
    if (tradesError) throw new Error(tradesError.message)
    const allTrades = (trades ?? []) as Trade[]

    // Check if there are closed trades to analyze
    const closedTradesCount = allTrades.filter(t => t.status === 'closed' && t.net_profit !== null).length
    if (closedTradesCount === 0) {
      return NextResponse.json(
        { error: 'You need at least 1 closed trade to generate an AI behavior report. Connect your MT5 account or log a trade in your journal to begin!' },
        { status: 400 }
      )
    }

    // ── 1.5. Journal Quality Gate ───────────────────────────────────────────
    const quality = journalQualityGate(allTrades)
    if (!quality.pass) {
      return NextResponse.json({ error: quality.message }, { status: 400 })
    }

    // Fetch user's trading style and custom journal template from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('trading_style, custom_journal_template, trading_setups')
      .eq('id', user.id)
      .single()
    const tradingStyle = profile?.trading_style || 'day_trading'

    // Resolve custom journal template (with fallback to legacy trading_setups key)
    let customJournalTemplate: any = null
    if (profile?.custom_journal_template) {
      customJournalTemplate = profile.custom_journal_template
    } else if (profile?.trading_setups && typeof profile.trading_setups === 'object') {
      const ts = profile.trading_setups as any
      if (ts.__custom_journal_template) {
        customJournalTemplate = ts.__custom_journal_template
      }
    }

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
      checkRuleViolations(allTrades, activeRules, accountBalance, tradingStyle)

    // ── 4. Build emotion stats from journal ─────────────────────────────────
    const emotionStats = buildEmotionStats(allTrades)

    // ── 5. Compute all trading stats ────────────────────────────────────────
    const stats = computeStats(allTrades)
    const sessionStats = computeSessionStats(allTrades)
    const dayStats = computeDayStats(allTrades)
    const topSymbols = computeTopSymbols(allTrades)

    // ── 6. Compute deep psychological telemetry ─────────────────────────────
    const telemetry = compilePsychologicalTelemetry(allTrades)

    // ── 6.5. Compute linguistic telemetry ───────────────────────────────────
    const linguisticTelemetry = compileLinguisticTelemetry(allTrades)

    // ── 6.9. Compile custom journal intelligence ─────────────────────────────
    const customJournalIntelligence = compileCustomJournalIntelligence(allTrades, customJournalTemplate)

    // ── 7. Call AI coach ────────────────────────────────────────────────────
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
      telemetry,
      linguisticTelemetry,
      customJournalIntelligence: customJournalIntelligence.customTradesCount >= 3 ? customJournalIntelligence : undefined,
    })

    // ── 8. Save report to DB ────────────────────────────────────────────────
    const { error: insertError } = await supabase.from('ai_reports').insert({
      user_id: user.id,
      account_id: accountId ?? null,
      report_period: 'alltime',
      grade: report.grade ?? 'N/A',
      grade_reason: report.grade_reason ?? '',
      strengths: report.strengths ?? [],
      weaknesses: report.weaknesses ?? [],
      blind_spots: report.blind_spots ?? [],
      revenge_trading_detected: report.revenge_trading_detected ?? false,
      best_session: report.best_session ?? 'N/A',
      worst_session: report.worst_session ?? 'N/A',
      best_day: report.best_day ?? 'N/A',
      worst_day: report.worst_day ?? 'N/A',
      risk_score: report.risk_score ?? 0,
      consistency_score: report.consistency_score ?? 0,
      discipline_score: report.discipline_score ?? 0,
      action_plan: report.action_plan ?? [],
      summary: report.summary ?? '',
      trades_analyzed: stats.totalTrades,
      rules_analysis: {
        compliance_score: report.rules_compliance_score ?? 0,
        observations: report.rules_analysis ?? [],
        emotion_insights: report.emotion_insights ?? [],
        violations_count: ruleViolations.reduce((s, v) => s + v.count, 0),
        revenge_trades: revengeTradeCount,
        cognitive_biases: report.cognitive_biases ?? [],
        emotion_correlations: report.emotion_correlations ?? [],
        discipline_breaches_correlation: report.discipline_breaches_correlation ?? '',
        linguistic_telemetry: linguisticTelemetry,
      },
      rules_violations_count: ruleViolations.reduce((s, v) => s + v.count, 0),
      rules_compliance_score: report.rules_compliance_score ?? null,
    })

    if (insertError) {
      throw new Error(`Failed to save AI report to database: ${insertError.message}`)
    }

    // ── 9. Write detected violations to rule_violations table ──────────────
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
    return NextResponse.json({ error: err.message || 'An unexpected error occurred during behavioral diagnostics.' }, { status: 500 })
  }
}
