import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { fetchStrategy } from '../api/strategies'
import DocTooltip from '../components/DocTooltip'

export default function Parameters() {
  const navigate = useNavigate()
  const { strategy, setStrategy, activeStrategyId } = useApp()
  const [draft, setDraft] = useState(strategy)
  const [schema, setSchema] = useState([]) // Dynamic parameter schema
  const update = (key, value) => setDraft((d) => ({ ...d, [key]: Number(value) }))

  // Load schema from backend if we have an active strategy
  useEffect(() => {
    if (!activeStrategyId) {
      // Fallback schema for legacy flow
      setSchema([
        { key: 'rsiPeriod', label: 'RSI Period', min: 5, max: 50, step: 1, docKey: 'rsiPeriod' },
        { key: 'buyThreshold', label: 'Oversold Threshold', min: 10, max: 45, step: 1, docKey: 'buyThreshold' },
        { key: 'sellThreshold', label: 'Overbought Threshold', min: 55, max: 90, step: 1, docKey: 'sellThreshold' },
        { key: 'stopLoss', label: 'Stop Loss (%)', min: 1, max: 20, step: 1, docKey: 'stopLoss' },
        { key: 'takeProfit', label: 'Take Profit (%)', min: 5, max: 50, step: 1, docKey: 'takeProfit' },
      ])
      return
    }

    fetchStrategy(activeStrategyId)
      .then(s => {
        if (s.parametersSchema && s.parametersSchema.length > 0) {
          setSchema(s.parametersSchema)
        }
      })
      .catch(err => console.warn('Failed to load strategy schema:', err))
  }, [activeStrategyId])

  // Build compiled rules display from the schema
  const buildRulesDisplay = () => {
    if (schema.length === 0) return null
    const rsiP = draft.rsiPeriod
    const buy = draft.buyThreshold
    const sell = draft.sellThreshold
    const fast = draft.fastMa
    const slow = draft.slowMa
    const lookback = draft.lookback

    if (fast !== undefined && slow !== undefined) {
      return (
        <>
          <div className="compiled-rule buy-rule">IF <DocTooltip termKey="fastMa">Fast MA({fast})</DocTooltip> crosses above <DocTooltip termKey="slowMa">Slow MA({slow})</DocTooltip> → BUY</div>
          <div className="compiled-rule sell-rule">IF <DocTooltip termKey="fastMa">Fast MA({fast})</DocTooltip> crosses below <DocTooltip termKey="slowMa">Slow MA({slow})</DocTooltip> → SELL</div>
        </>
      )
    }
    if (lookback !== undefined) {
      return (
        <>
          <div className="compiled-rule buy-rule">IF Price ≥ <DocTooltip termKey="lookback">Highest({lookback})</DocTooltip> → BUY</div>
          <div className="compiled-rule sell-rule">IF Price ≤ <DocTooltip termKey="lookback">Lowest({lookback})</DocTooltip> → SELL</div>
        </>
      )
    }
    if (rsiP !== undefined) {
      return (
        <>
          <div className="compiled-rule buy-rule">IF <DocTooltip termKey="rsi">RSI</DocTooltip>({rsiP}) &lt; <DocTooltip termKey="buyThreshold">{buy}</DocTooltip> → BUY</div>
          <div className="compiled-rule sell-rule">IF <DocTooltip termKey="rsi">RSI</DocTooltip>({rsiP}) &gt; <DocTooltip termKey="sellThreshold">{sell}</DocTooltip> → SELL</div>
        </>
      )
    }
    return null
  }

  return (
    <div className="page-stack">
      <div className="page-heading"><div><div className="eyebrow">Step 2 of 3</div><h1>Strategy Parameters</h1><p>Configure simulation settings before the backtest.</p></div><button className="button secondary" onClick={() => navigate('/strategy')}>← Back to Builder</button></div>
      <div className="two-col">
        <section className="panel">
          <div className="section-title"><h2>Strategy & Data</h2></div>
          <div className="info-grid"><div><span>Strategy</span><strong>{strategy.name}</strong></div><div><span>Asset</span><strong>{strategy.asset}</strong></div><div><span>Period</span><strong>{strategy.startDate} → {strategy.endDate}</strong></div><div><span><DocTooltip termKey="resolution">Timeframe</DocTooltip></span><strong>{strategy.timeframe}</strong></div></div>
        </section>
        <section className="panel">
          <div className="section-title"><h2>Compiled Rules</h2></div>
          {buildRulesDisplay()}
        </section>
      </div>

      <section className="panel">
        <div className="section-title"><h2>Parameter Controls</h2><span className="muted">Dynamic sliders based on your strategy type</span></div>
        <div className="sliders-grid">
          {schema.map(param => (
            <label key={param.key}>
              <DocTooltip termKey={param.docKey || param.key}>{param.label}</DocTooltip>
              <input
                type="range"
                min={param.min}
                max={param.max}
                step={param.step || 1}
                value={draft[param.key] ?? param.min}
                onChange={(e) => update(param.key, e.target.value)}
              />
              <div className="range-value">{draft[param.key] ?? param.min}{param.label.includes('%') ? '%' : ''}</div>
            </label>
          ))}
        </div>
      </section>

      <div className="bottom-actions"><button className="button secondary" onClick={() => navigate('/strategy')}>Cancel</button><button className="button primary" onClick={() => { setStrategy(draft); navigate('/backtest-running') }}>Run <DocTooltip termKey="backtest">Backtest</DocTooltip> →</button></div>
    </div>
  )
}
