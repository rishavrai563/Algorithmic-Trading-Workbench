import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'

export default function Parameters() {
  const navigate = useNavigate()
  const { strategy, setStrategy } = useApp()
  const [draft, setDraft] = useState(strategy)
  const update = (key, value) => setDraft((d) => ({ ...d, [key]: Number(value) }))

  return (
    <div className="page-stack">
      <div className="page-heading"><div><div className="eyebrow">Step 2 of 3</div><h1>Strategy Parameters</h1><p>Configure simulation settings before the backtest.</p></div><button className="button secondary" onClick={() => navigate('/strategy')}>← Back to Builder</button></div>
      <div className="two-col">
        <section className="panel">
          <div className="section-title"><h2>Strategy & Data</h2></div>
          <div className="info-grid"><div><span>Strategy</span><strong>{strategy.name}</strong></div><div><span>Asset</span><strong>{strategy.asset}</strong></div><div><span>Period</span><strong>{strategy.startDate} → {strategy.endDate}</strong></div><div><span>Timeframe</span><strong>{strategy.timeframe}</strong></div></div>
        </section>
        <section className="panel">
          <div className="section-title"><h2>Compiled Rules</h2></div>
          <div className="compiled-rule buy-rule">IF RSI({draft.rsiPeriod}) &lt; {draft.buyThreshold} → BUY</div>
          <div className="compiled-rule sell-rule">IF RSI({draft.rsiPeriod}) &gt; {draft.sellThreshold} → SELL</div>
        </section>
      </div>

      <section className="panel">
        <div className="section-title"><h2>Parameter Controls</h2><span className="muted">Change values and run again</span></div>
        <div className="sliders-grid">
          <label>RSI Period <input type="range" min="5" max="50" value={draft.rsiPeriod} onChange={(e) => update('rsiPeriod', e.target.value)} /><div className="range-value">{draft.rsiPeriod}</div></label>
          <label>Oversold Threshold <input type="range" min="10" max="45" value={draft.buyThreshold} onChange={(e) => update('buyThreshold', e.target.value)} /><div className="range-value">{draft.buyThreshold}</div></label>
          <label>Overbought Threshold <input type="range" min="55" max="90" value={draft.sellThreshold} onChange={(e) => update('sellThreshold', e.target.value)} /><div className="range-value">{draft.sellThreshold}</div></label>
          <label>Stop Loss (%) <input type="range" min="1" max="20" value={draft.stopLoss} onChange={(e) => update('stopLoss', e.target.value)} /><div className="range-value">{draft.stopLoss}%</div></label>
          <label>Take Profit (%) <input type="range" min="5" max="50" value={draft.takeProfit} onChange={(e) => update('takeProfit', e.target.value)} /><div className="range-value">{draft.takeProfit}%</div></label>
        </div>
      </section>

      <div className="bottom-actions"><button className="button secondary" onClick={() => navigate('/strategy')}>Cancel</button><button className="button primary" onClick={() => { setStrategy(draft); navigate('/backtest-running') }}>Run Backtest →</button></div>
    </div>
  )
}
