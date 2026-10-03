import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { calculateMetrics, generateEquityCurve } from '../data/sampleData'
import Sparkline from '../components/Sparkline'
import DocTooltip from '../components/DocTooltip'

export default function Compare() {
  const navigate = useNavigate()
  const { runHistory, backtestResults, strategy } = useApp()
  const [idxA, setIdxA] = useState(0)
  const [idxB, setIdxB] = useState(1)

  const hasRuns = runHistory && runHistory.length >= 2

  // Build the data for each side
  const runA = hasRuns ? runHistory[idxA] : null
  const runB = hasRuns ? runHistory[idxB] : null

  const metricsA = useMemo(() => {
    if (runA) return runA.metrics
    return calculateMetrics(strategy)
  }, [runA, strategy])

  const metricsB = useMemo(() => {
    if (runB) return runB.metrics
    return calculateMetrics({ ...strategy, buyThreshold: 25, sellThreshold: 65 })
  }, [runB, strategy])

  const configA = runA ? runA.strategyConfig : strategy
  const configB = runB ? runB.strategyConfig : { ...strategy, buyThreshold: 25, sellThreshold: 65 }

  // Build equity curves
  const curveA = useMemo(() => {
    if (runA && runA.equityCurve && runA.equityCurve.length > 0) {
      const pts = runA.equityCurve
      const step = Math.max(1, Math.floor(pts.length / 20))
      return pts.filter((_, i) => i % step === 0).slice(0, 20).map(pt => ({
        label: new Date((pt.timestamp || 0) * 1000).toLocaleDateString(),
        value: pt.equity || 0
      }))
    }
    return generateEquityCurve(configA)
  }, [runA, configA])

  const curveB = useMemo(() => {
    if (runB && runB.equityCurve && runB.equityCurve.length > 0) {
      const pts = runB.equityCurve
      const step = Math.max(1, Math.floor(pts.length / 20))
      return pts.filter((_, i) => i % step === 0).slice(0, 20).map(pt => ({
        label: new Date((pt.timestamp || 0) * 1000).toLocaleDateString(),
        value: pt.equity || 0
      }))
    }
    return curveA.map((point, i) => ({ ...point, value: Number((point.value * (0.98 + i * 0.0015)).toFixed(2)) }))
  }, [runB, configB, curveA])

  // Find parameters that differ between the two configs
  const paramKeys = [...new Set([...Object.keys(configA), ...Object.keys(configB)])]
    .filter(k => !['name', 'asset', 'timeframe', 'startDate', 'endDate'].includes(k))

  const fmtReturn = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v) || 0
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
  }
  const fmtDrawdown = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v) || 0
    return `${n.toFixed(2)}%`
  }
  const fmtTrades = (v) => v ?? 0
  const fmtWinRate = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v) || 0
    return `${n.toFixed(2)}%`
  }

  const labelA = runA ? runA.name : 'Current Strategy'
  const labelB = runB ? runB.name : 'Variation B'

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Compare</div>
          <h1>Compare Strategies</h1>
          <p>Side-by-side comparison for understanding trade-offs.</p>
        </div>
        <button className="button secondary" onClick={() => navigate('/explore')}>← Explore Parameters</button>
      </div>

      {/* Dropdowns */}
      <div className="compare-select">
        <select value={idxA} onChange={(e) => setIdxA(Number(e.target.value))}>
          {hasRuns ? (
            runHistory.map((run, i) => (
              <option key={run.id} value={i}>
                {run.name} · {run.strategyConfig?.name || 'Strategy'} · {(run.metrics.totalReturn || 0).toFixed(1)}%
              </option>
            ))
          ) : (
            <option value="0">Strategy A · Current RSI</option>
          )}
        </select>
        <span className="vs-badge">VS</span>
        <select value={idxB} onChange={(e) => setIdxB(Number(e.target.value))}>
          {hasRuns ? (
            runHistory.map((run, i) => (
              <option key={run.id} value={i}>
                {run.name} · {run.strategyConfig?.name || 'Strategy'} · {(run.metrics.totalReturn || 0).toFixed(1)}%
              </option>
            ))
          ) : (
            <option value="1">Strategy B · MA Crossover</option>
          )}
        </select>
      </div>

      {!hasRuns && (
        <div className="panel" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>Run at least 2 backtests to compare real results here.</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>The data below is sample placeholder data until you complete your first two runs.</p>
        </div>
      )}

      {/* Parameter Diff Table */}
      <section className="panel">
        <div className="section-title">
          <h2>Parameter Comparison</h2>
          <span className="muted">Highlighting differences between configurations</span>
        </div>
        <div className="table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th style={{ color: '#2563eb' }}>{labelA}</th>
                <th style={{ color: '#8b5cf6' }}>{labelB}</th>
                <th>Changed?</th>
              </tr>
            </thead>
            <tbody>
              {paramKeys.map(key => {
                const valA = configA[key] ?? '—'
                const valB = configB[key] ?? '—'
                const changed = String(valA) !== String(valB)
                return (
                  <tr key={key} style={changed ? { background: '#fefce8' } : {}}>
                    <td style={{ fontWeight: 500 }}>{key}</td>
                    <td>{valA}</td>
                    <td>{valB}</td>
                    <td style={{ textAlign: 'center' }}>
                      {changed ? <span style={{ color: '#d97706', fontWeight: 700 }}>⚡ Yes</span> : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Metrics Comparison */}
      <section className="panel">
        <div className="section-title">
          <h2>Performance Metrics</h2>
          <span className="muted">Backtest results side-by-side</span>
        </div>
        <div className="table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th style={{ color: '#2563eb' }}>{labelA}</th>
                <th style={{ color: '#8b5cf6' }}>{labelB}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><DocTooltip termKey="return">Return</DocTooltip></td>
                <td className={(metricsA.totalReturn ?? metricsA.returnPct ?? 0) >= 0 ? 'positive' : 'negative'}>{fmtReturn(metricsA.totalReturn ?? metricsA.returnPct)}</td>
                <td className={(metricsB.totalReturn ?? metricsB.returnPct ?? 0) >= 0 ? 'positive' : 'negative'}>{fmtReturn(metricsB.totalReturn ?? metricsB.returnPct)}</td>
              </tr>
              <tr>
                <td><DocTooltip termKey="drawdown">Max Drawdown</DocTooltip></td>
                <td className="negative">{fmtDrawdown(metricsA.maxDrawdown ?? metricsA.drawdown)}</td>
                <td className="negative">{fmtDrawdown(metricsB.maxDrawdown ?? metricsB.drawdown)}</td>
              </tr>
              <tr>
                <td><DocTooltip termKey="trades">Trades</DocTooltip></td>
                <td>{fmtTrades(metricsA.totalTrades ?? metricsA.trades)}</td>
                <td>{fmtTrades(metricsB.totalTrades ?? metricsB.trades)}</td>
              </tr>
              <tr>
                <td><DocTooltip termKey="winRate">Win Rate</DocTooltip></td>
                <td>{fmtWinRate(metricsA.winRate)}</td>
                <td>{fmtWinRate(metricsB.winRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Equity Comparison */}
      <section className="panel">
        <div className="section-title">
          <h2>Equity Comparison</h2>
          <span className="muted">{hasRuns ? 'Real equity curves from backtest runs' : 'Sample curves'}</span>
        </div>
        <div className="dual-chart">
          <Sparkline data={curveA} />
          <svg viewBox="0 0 760 190" className="overlay-chart">
            <polyline
              points={curveB.map((d, i) => {
                const minVal = Math.min(...curveB.map(p => p.value))
                const maxVal = Math.max(...curveB.map(p => p.value))
                const range = maxVal - minVal || 1
                return `${i * (760 / (curveB.length - 1))},${190 - ((d.value - minVal) / range) * 160}`
              }).join(' ')}
              fill="none"
              className="chart-benchmark"
            />
          </svg>
        </div>
        <div className="legend">
          <span><i className="legend-line main" /> {labelA}</span>
          <span><i className="legend-line bench" /> {labelB}</span>
        </div>
      </section>

      <div className="bottom-actions">
        <button className="button secondary" onClick={() => navigate('/')}>Return to Dashboard</button>
        <button className="button primary" onClick={() => navigate('/strategy')}>Edit Strategy</button>
      </div>

      <style>{`
        .vs-badge {
          font-weight: 800;
          font-size: 16px;
          color: #64748b;
          padding: 0 8px;
        }
      `}</style>
    </div>
  )
}
