import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { calculateMetrics, defaultStrategy, generateEquityCurve } from '../data/sampleData'
import Sparkline from '../components/Sparkline'

export default function Compare() {
  const navigate = useNavigate()
  const { strategy } = useApp()
  const a = calculateMetrics(strategy)
  const strategyB = { ...defaultStrategy, name: 'MA Crossover', buyThreshold: 25, sellThreshold: 65 }
  const b = calculateMetrics(strategyB)

  const curveA = generateEquityCurve(strategy)
  const curveB = curveA.map((point, i) => ({ ...point, value: Number((point.value * (0.98 + i * 0.0015)).toFixed(2)) }))

  return (
    <div className="page-stack">
      <div className="page-heading"><div><div className="eyebrow">Compare</div><h1>Compare Strategies</h1><p>Side-by-side comparison for understanding trade-offs.</p></div><button className="button secondary" onClick={() => navigate('/explore')}>← Explore Parameters</button></div>
      <div className="compare-select"><select defaultValue="current"><option value="current">Strategy A · Current RSI</option></select><span>VS</span><select defaultValue="ma"><option value="ma">Strategy B · MA Crossover</option></select></div>
      <section className="panel"><div className="table-wrap"><table className="comparison-table"><thead><tr><th>Metric</th><th>Strategy A (RSI)</th><th>Strategy B (MA)</th></tr></thead><tbody><tr><td>Return</td><td className="positive">+{a.returnPct}%</td><td className="positive">+{b.returnPct}%</td></tr><tr><td>Max Drawdown</td><td className="negative">{a.drawdown}%</td><td className="negative">{b.drawdown}%</td></tr><tr><td>Trades</td><td>{a.trades}</td><td>{b.trades}</td></tr><tr><td>Win Rate</td><td>{a.winRate}%</td><td>{b.winRate}%</td></tr></tbody></table></div></section>
      <section className="panel"><div className="section-title"><h2>Equity Comparison</h2><span className="muted">Sample curves</span></div><div className="dual-chart"><Sparkline data={curveA} /><svg viewBox="0 0 760 190" className="overlay-chart"><polyline points={curveB.map((d, i) => `${i * (760 / (curveB.length - 1))},${190 - ((d.value - 96) / 52) * 160}`).join(' ')} fill="none" className="chart-benchmark" /></svg></div><div className="legend"><span><i className="legend-line main" /> Strategy A</span><span><i className="legend-line bench" /> Strategy B</span></div></section>
      <div className="bottom-actions"><button className="button secondary" onClick={() => navigate('/')}>Return to Dashboard</button><button className="button primary" onClick={() => navigate('/strategy')}>Edit Strategy</button></div>
    </div>
  )
}
