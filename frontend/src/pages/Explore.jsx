import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { calculateMetrics, generateEquityCurve } from '../data/sampleData'
import Sparkline from '../components/Sparkline'

export default function Explore() {
  const navigate = useNavigate()
  const { strategy, setStrategy } = useApp()
  const [draft, setDraft] = useState(strategy)
  const metrics = useMemo(() => calculateMetrics(draft), [draft])
  const curve = useMemo(() => generateEquityCurve(draft), [draft])

  const change = (key, value) => setDraft((d) => ({ ...d, [key]: Number(value) }))

  return (
    <div className="page-stack">
      <div className="page-heading"><div><div className="eyebrow">Backtests / Explore</div><h1>Explore Parameters</h1><p>Change parameters and observe how sample results change.</p></div><button className="button secondary" onClick={() => navigate('/results')}>← Back to Results</button></div>
      <div className="workflow-strip"><span>1 Change Parameters</span><span>2 Run Variation</span><span>3 Compare Results</span></div>
      <div className="explore-layout">
        <section className="panel controls-panel">
          <div className="section-title"><h2>Controls</h2></div>
          {[
            ['rsiPeriod', 'RSI Period', 5, 50],
            ['buyThreshold', 'Oversold Threshold', 10, 45],
            ['sellThreshold', 'Overbought Threshold', 55, 90],
            ['stopLoss', 'Stop Loss (%)', 1, 20],
            ['takeProfit', 'Take Profit (%)', 5, 50],
          ].map(([key, label, min, max]) => <label className="control-row" key={key}><div className="control-header"><span>{label}</span><strong>{draft[key]}{key === 'stopLoss' || key === 'takeProfit' ? '%' : ''}</strong></div><input type="range" min={min} max={max} value={draft[key]} onChange={(e) => change(key, e.target.value)} /></label>)}
          <div className="control-actions"><button className="button secondary" onClick={() => setDraft(strategy)}>Reset</button><button className="button primary" onClick={() => setStrategy(draft)}>Run Variation</button></div>
        </section>
        <section className="panel">
          <div className="section-title"><h2>Results Visualization</h2><span className="muted">Updates as you move controls</span></div>
          <div className="metric-grid compact"><div><span>Return</span><strong className="positive">+{metrics.returnPct}%</strong></div><div><span>Drawdown</span><strong className="negative">{metrics.drawdown}%</strong></div><div><span>Trades</span><strong>{metrics.trades}</strong></div></div>
          <Sparkline data={curve} />
        </section>
      </div>
      <div className="panel compare-preview"><div className="section-title"><h2>Saved Configurations</h2></div><div className="config-grid">{[['Config A', strategy], ['Config B', draft], ['Config C', { ...strategy, buyThreshold: 25 }]].map(([name, config]) => { const m = calculateMetrics(config); return <button key={name} className="config-card" onClick={() => setDraft(config)}><span>{name}</span><strong>+{m.returnPct}%</strong><small>{m.drawdown}% drawdown · {m.trades} trades</small></button> })}</div></div>
      <div className="bottom-actions"><button className="button secondary" onClick={() => navigate('/results')}>Back to Results</button><button className="button primary" onClick={() => navigate('/compare')}>Compare Configurations →</button></div>
    </div>
  )
}
