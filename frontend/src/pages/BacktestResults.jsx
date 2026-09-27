import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import MetricCard from '../components/MetricCard'
import Sparkline from '../components/Sparkline'
import { historicalTrades, generateEquityCurve, calculateMetrics } from '../data/sampleData'

export default function BacktestResults() {
  const navigate = useNavigate()
  const { strategy } = useApp()
  const metrics = calculateMetrics(strategy)
  const curve = generateEquityCurve(strategy)

  return (
    <div className="page-stack">
      <div className="page-heading"><div><div className="eyebrow">Step 3 of 3</div><h1>Backtest Results</h1><p>{strategy.name} · {strategy.asset} · {strategy.startDate} to {strategy.endDate}</p></div><button className="button secondary" onClick={() => navigate('/explore')}>Explore Parameters</button></div>
      <div className="demo-note">Demo note: these metrics and charts are frontend sample data for the Lab 6 implementation. They are not live or investment results.</div>
      <div className="metric-grid">
        <MetricCard label="Return" value={`+${metrics.returnPct}%`} tone="positive" />
        <MetricCard label="Max Drawdown" value={`${metrics.drawdown}%`} tone="negative" />
        <MetricCard label="Total Trades" value={metrics.trades} />
        <MetricCard label="Win Rate" value={`${metrics.winRate}%`} />
      </div>
      <section className="panel">
        <div className="section-title"><div><h2>Equity Curve</h2><span className="muted">Strategy vs benchmark (sample)</span></div><div className="legend-text"><span>● Strategy</span><span>● Benchmark</span></div></div>
        <Sparkline data={curve} benchmark />
      </section>
      <div className="two-col">
        <section className="panel"><div className="section-title"><h2>Drawdown</h2><span className="muted">Peak-to-trough risk</span></div><div className="drawdown-box"><div className="drawdown-fill" style={{ height: `${Math.abs(metrics.drawdown) * 2.6}%` }} /><span>{metrics.drawdown}% max</span></div></section>
        <section className="panel"><div className="section-title"><h2>Recent Trades</h2><button className="text-button" onClick={() => navigate('/results#trades')}>View All</button></div><div className="mini-list">{historicalTrades.slice(0, 5).map((t) => <div className="mini-row" key={t.id}><span>{t.date}</span><strong className={t.action === 'BUY' ? 'buy-text' : 'sell-text'}>{t.action}</strong><span>{t.pnl > 0 ? '+' : ''}{t.pnl}%</span></div>)}</div></section>
      </div>
      <div id="trades" className="panel"><div className="section-title"><h2>Trades</h2></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Date</th><th>Action</th><th>Price</th><th>Quantity</th><th>P/L</th></tr></thead><tbody>{historicalTrades.map((t) => <tr key={t.id}><td>{t.id}</td><td>{t.date}</td><td><span className={t.action === 'BUY' ? 'buy-text' : 'sell-text'}>{t.action}</span></td><td>₹{t.price.toLocaleString()}</td><td>{t.quantity}</td><td>{t.pnl > 0 ? '+' : ''}{t.pnl}%</td></tr>)}</tbody></table></div></div>
      <div className="bottom-actions"><button className="button secondary" onClick={() => navigate('/parameters')}>← Change Parameters</button><button className="button primary" onClick={() => navigate('/compare')}>Compare Strategies →</button></div>
    </div>
  )
}
