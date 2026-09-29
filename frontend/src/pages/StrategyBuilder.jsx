import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { getSupportedAssets } from '../api/backtest'

export default function StrategyBuilder() {
  const navigate = useNavigate()
  const { strategy, setStrategy, strategyCode, setStrategyCode } = useApp()
  const [draft, setDraft] = useState(strategy)
  const [draftCode, setDraftCode] = useState(strategyCode)
  const [mode, setMode] = useState('CODE') // 'CODE' or 'VISUAL'
  const [supportedAssets, setSupportedAssets] = useState([strategy.asset])

  useEffect(() => {
    getSupportedAssets()
      .then(data => {
        if (data.assets && data.assets.length > 0) {
          setSupportedAssets(data.assets)
        }
      })
      .catch(() => {
        // Fallback — keep what we have
      })
  }, [])

  const update = (key, value) => setDraft((d) => ({ ...d, [key]: value }))

  const handleContinue = () => {
    setStrategy(draft)
    setStrategyCode(draftCode)
    navigate('/parameters')
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Step 1 of 3</div>
          <h1>Strategy Builder</h1>
          <p>Define the rules that generate trading actions using Python code or visual blocks.</p>
        </div>
        <button className="button secondary" onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>

      <div className="builder-controls">
        <div className="mode-toggle">
          <button className={`toggle-btn ${mode === 'CODE' ? 'active' : ''}`} onClick={() => setMode('CODE')}>CODE</button>
          <button className={`toggle-btn ${mode === 'VISUAL' ? 'active' : ''}`} onClick={() => setMode('VISUAL')}>VISUAL BLOCKS</button>
        </div>
      </div>

      <div className="builder-layout">
        <section className="panel builder-panel">
          {mode === 'CODE' ? (
            <div className="code-editor-container">
              <div className="section-title">
                <h2>Python QCAlgorithm</h2>
                <span className="muted">LEAN Engine Compatible</span>
              </div>
              <textarea
                className="code-editor"
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                spellCheck="false"
              />
            </div>
          ) : (
            <>
              <div className="section-title">
                <h2>Strategy Canvas</h2>
                <span className="demo-pill">Feature Not Yet Available</span>
              </div>
              <div className="path-grid" style={{ opacity: 0.5, pointerEvents: 'none' }}>
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
            </>
          )}
        </section>

        <aside className="panel inspector">
          <div className="section-title"><h2>Strategy Metadata</h2></div>
          <label>Strategy Name<input value={draft.name} onChange={(e) => update('name', e.target.value)} /></label>
          <label>Asset
            <select value={draft.asset} onChange={(e) => update('asset', e.target.value)}>
              {supportedAssets.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>Timeframe
            <select value={draft.timeframe} onChange={(e) => update('timeframe', e.target.value)}>
              <option>Daily</option>
              <option>30 Min</option>
              <option>Weekly</option>
            </select>
          </label>
          <label>Start Date<input type="date" value={draft.startDate} onChange={(e) => update('startDate', e.target.value)} /></label>
          <label>End Date<input type="date" value={draft.endDate} onChange={(e) => update('endDate', e.target.value)} /></label>
          <div className="form-actions" style={{ marginTop: 'auto' }}>
            <button className="button secondary" onClick={() => { setDraft(strategy); setDraftCode(strategyCode); }}>Reset</button>
            <button className="button primary" onClick={handleContinue}>Continue to Parameters →</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
