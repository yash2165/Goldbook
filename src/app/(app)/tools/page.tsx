import { Wrench, Calculator, Calendar, BookMarked } from 'lucide-react'

export default function ToolsPage() {
  const tools = [
    { icon: Calculator, title: 'Position Size Calculator', desc: 'Calculate ideal lot size based on risk % and stop loss distance', badge: 'Available', color: 'text-primary bg-primary/10' },
    { icon: Calendar, title: 'Economic Calendar', desc: 'High-impact news events affecting XAUUSD with countdown timers', badge: 'Available', color: 'text-[#F59E0B] bg-[#F59E0B]/10' },
    { icon: BookMarked, title: 'Trading Plan Builder', desc: 'Build and save your personalized trading rules and checklist', badge: 'Coming Soon', color: 'text-[#64748B] bg-white/5' },
  ]

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Wrench className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Tools</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tools.map(t => (
          <div key={t.title} className="bg-[#12121a] border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors cursor-pointer group">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${t.color}`}>
              <t.icon className="w-6 h-6" />
            </div>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold">{t.title}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wider ${t.badge === 'Available' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-white/5 text-[#64748B]'}`}>
                {t.badge}
              </span>
            </div>
            <p className="text-sm text-[#64748B] leading-relaxed">{t.desc}</p>
          </div>
        ))}
      </div>

      {/* Position Size Calculator */}
      <PositionSizeCalc />
    </div>
  )
}

function PositionSizeCalc() {
  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
      <h2 className="font-bold mb-1 flex items-center gap-2">
        <Calculator className="w-5 h-5 text-primary" /> Position Size Calculator
      </h2>
      <p className="text-xs text-[#64748B] mb-6">XAUUSD — $1 per pip per 0.01 lot</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Account Balance ($)', placeholder: '10000', id: 'balance' },
          { label: 'Risk per Trade (%)', placeholder: '1', id: 'risk' },
          { label: 'Stop Loss (pips)', placeholder: '50', id: 'sl_pips' },
          { label: 'Entry Price', placeholder: '2320.00', id: 'entry' },
        ].map(f => (
          <div key={f.id} className="space-y-1.5">
            <label className="text-xs text-[#64748B] uppercase tracking-wider font-medium">{f.label}</label>
            <input
              type="number"
              placeholder={f.placeholder}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center justify-between">
        <div>
          <p className="text-xs text-[#64748B] uppercase tracking-wider">Recommended Lot Size</p>
          <p className="text-3xl font-black text-primary mt-1">0.20</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#64748B]">Max Risk: $100.00</p>
          <p className="text-xs text-[#64748B] mt-0.5">Pip Value: $2.00</p>
        </div>
      </div>
    </div>
  )
}
