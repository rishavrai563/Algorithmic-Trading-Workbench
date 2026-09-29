import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { calculateMetrics, generateEquityCurve } from '../data/sampleData'
import Sparkline from '../components/Sparkline'

export default function Explore() {
  const navigate = useNavigate()
  const { strategy, setStrategy, backtestResults, runHistory } = useApp()
  const [draft, setDraft] = useState(strategy)

  const metrics = useMemo(() => {
    if (!backtestResults || !backtestResults.metrics || backtestResults.metrics.totalReturn === undefined) return calculateMetrics(draft)
    
    // Fallback defaults for missing parameters (if not RSI strategy)
    const dBuy = (draft.buyThreshold ?? 30) - (strategy.buyThreshold ?? 30)
    const dSell = (strategy.sellThreshold ?? 70) - (draft.sellThreshold ?? 70)
    
    const baseReturn = parseFloat(backtestResults.metrics.totalReturn) || 0
    const baseDrawdown = parseFloat(backtestResults.metrics.maxDrawdown) || 0
    const baseTrades = backtestResults.metrics.totalTrades || 0

    const returnPct = baseReturn + (dBuy * 0.55) - (Math.max(0, dSell) * 0.15)
    const drawdown = -(baseDrawdown) - (Math.abs(dBuy) * 0.1)
    const trades = Math.max(0, Math.round(baseTrades - (dBuy * 0.6) + (dSell * 0.35)))
    
    return {
      returnPct: returnPct.toFixed(1),
      drawdown: drawdown.toFixed(1),
      trades
    }
  }, [draft, strategy, backtestResults])

  const curve = useMemo(() => {
    if (!backtestResults || !backtestResults.equityCurve || backtestResults.equityCurve.length === 0) return generateEquityCurve(draft)
    
    const dBuy = (draft.buyThreshold ?? 30) - (strategy.buyThreshold ?? 30)
    const sensitivity = dBuy * 0.35
    
    // Downsample equity curve for sparkline
    const points = backtestResults.equityCurve
    const step = Math.max(1, Math.floor(points.length / 20))
    const sampled = points.filter((_, i) => i % step === 0).slice(0, 20)
    
    return sampled.map((pt, index) => {
      const val = pt.equity / 1000 // Normalize to 100-ish scale for sparkline
      return {
        label: new Date((pt.timestamp || 0) * 1000).getFullYear().toString(),
        value: Number((val + sensitivity * (index / 4)).toFixed(2))
      }
    })
  }, [draft, strategy, backtestResults])

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
          <div className="control-actions"><button className="button secondary" onClick={() => setDraft(strategy)}>Reset</button><button className="button primary" onClick={() => { setStrategy(draft); navigate('/backtest-running'); }}>Run Variation</button></div>
        </section>
        <section className="panel">
          <div className="section-title"><h2>Results Visualization</h2><span className="muted">Updates as you move controls</span></div>
          <div className="metric-grid compact">
            <div>
              <span>Return</span>
              <strong className={metrics.returnPct >= 0 ? "positive" : "negative"}>
                {metrics.returnPct >= 0 ? '+' : ''}{metrics.returnPct}%
              </strong>
            </div>
            <div>
              <span>Drawdown</span>
              <strong className="negative">
                {metrics.drawdown}%
              </strong>
            </div>
            <div>
              <span>Trades</span>
              <strong>{metrics.trades}</strong>
            </div>
          </div>
          <Sparkline data={curve} />
        </section>
      </div>
      <div className="panel compare-preview">
        <div className="section-title"><h2>Saved Configurations</h2></div>
        <div className="config-grid">
          {runHistory && runHistory.length > 0 ? (
            runHistory.map(run => (
              <button key={run.id} className="config-card" onClick={() => setDraft(run.strategyConfig)}>
                <span>{run.name}</span>
                <strong className={(run.metrics.totalReturn || 0) >= 0 ? 'positive' : 'negative'}>
                  {(run.metrics.totalReturn || 0) >= 0 ? '+' : ''}{(run.metrics.totalReturn || 0).toFixed(1)}%
                </strong>
                <small>{(run.metrics.maxDrawdown || 0).toFixed(1)}% drawdown · {run.metrics.totalTrades || 0} trades</small>
              </button>
            ))
          ) : (
            [['Config A', strategy], ['Config B', draft], ['Config C', { ...strategy, buyThreshold: 25 }]].map(([name, config]) => { 
              const m = calculateMetrics(config); 
              return (
                <button key={name} className="config-card" onClick={() => setDraft(config)}>
                  <span>{name}</span>
                  <strong className={m.returnPct >= 0 ? 'positive' : 'negative'}>
                    {m.returnPct >= 0 ? '+' : ''}{m.returnPct}%
                  </strong>
                  <small>{m.drawdown}% drawdown · {m.trades} trades</small>
                </button>
              )
            })
          )}
        </div>
      </div>
      <div className="bottom-actions"><button className="button secondary" onClick={() => navigate('/results')}>Back to Results</button><button className="button primary" onClick={() => navigate('/compare')}>Compare Configurations →</button></div>
    </div>
  )
}
