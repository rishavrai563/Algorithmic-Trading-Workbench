import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'

export default function StrategyBuilder() {
  const navigate = useNavigate()
  const { strategy, setStrategy } = useApp()
  const [draft, setDraft] = useState(strategy)

  const update = (key, value) => setDraft((d) => ({ ...d, [key]: value }))

  return (
    <div className="page-stack">
      <div className="page-heading"><div><div className="eyebrow">Step 1 of 3</div><h1>Strategy Builder</h1><p>Visually define the rules that generate trading actions.</p></div><button className="button secondary" onClick={() => navigate('/')}>Back to Dashboard</button></div>

      <div className="builder-layout">
        <section className="panel builder-panel">
          <div className="section-title"><h2>Strategy Canvas</h2><span className="muted">2 paths · 6 nodes</span></div>
          <div className="path-grid">
            <div className="rule-path long-path">
              <div className="path-title">PATH 1 · LONG ENTRY</div>
              <div className="node indicator-node"><strong>INDICATOR · RSI</strong><span>Source: Close · Period: {draft.rsiPeriod}</span></div>
              <div className="connector">↓</div>
              <div className="node condition-node selected"><strong>CONDITION</strong><span>RSI &lt; {draft.buyThreshold}</span></div>
              <div className="connector">↓</div>
              <div className="node action-node buy"><strong>ACTION · BUY</strong><span>Order Type: Long</span></div>
            </div>
            <div className="rule-path short-path">
              <div className="path-title">PATH 2 · EXIT</div>
              <div className="node indicator-node"><strong>INDICATOR · RSI</strong><span>Source: Close · Period: {draft.rsiPeriod}</span></div>
              <div className="connector">↓</div>
              <div className="node condition-node"><strong>CONDITION</strong><span>RSI &gt; {draft.sellThreshold}</span></div>
              <div className="connector">↓</div>
              <div className="node action-node sell"><strong>ACTION · SELL</strong><span>Order Type: Exit</span></div>
            </div>
          </div>
        </section>

        <aside className="panel inspector">
          <div className="section-title"><h2>Selected Component</h2></div>
          <label>Strategy Name<input value={draft.name} onChange={(e) => update('name', e.target.value)} /></label>
          <label>Asset<select value={draft.asset} onChange={(e) => update('asset', e.target.value)}><option>NIFTY 50</option><option>AAPL</option><option>BTC-USD</option></select></label>
          <label>RSI Period<input type="number" value={draft.rsiPeriod} onChange={(e) => update('rsiPeriod', Number(e.target.value))} /></label>
          <label>Buy Threshold<input type="number" value={draft.buyThreshold} onChange={(e) => update('buyThreshold', Number(e.target.value))} /></label>
          <label>Sell Threshold<input type="number" value={draft.sellThreshold} onChange={(e) => update('sellThreshold', Number(e.target.value))} /></label>
          <label>Timeframe<select value={draft.timeframe} onChange={(e) => update('timeframe', e.target.value)}><option>Daily</option><option>1 Hour</option><option>15 Min</option></select></label>
          <div className="form-actions"><button className="button secondary" onClick={() => setDraft(strategy)}>Reset</button><button className="button primary" onClick={() => { setStrategy(draft); navigate('/parameters') }}>Continue to Parameters →</button></div>
        </aside>
      </div>
    </div>
  )
}
