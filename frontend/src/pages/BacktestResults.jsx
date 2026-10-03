import { useState, Component } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import MetricCard from '../components/MetricCard'
import Sparkline from '../components/Sparkline'
import CandlestickChart from '../components/CandlestickChart'
import DocTooltip from '../components/DocTooltip'

// Error boundary to catch render crashes and display them instead of a blank page
class ResultsErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('BacktestResults render crash:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="page-stack">
          <div className="panel" style={{ padding: '40px' }}>
            <h2 style={{ color: '#b91c1c' }}>Rendering Error</h2>
            <p>The results page crashed while rendering. This usually means the backend returned data in an unexpected format.</p>
            <pre style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '12px', border: '1px solid #fca5a5', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.toString()}
            </pre>
            <button className="button primary" onClick={() => window.location.href = '/strategy'} style={{ marginTop: '16px' }}>
              ← Back to Strategy
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function BacktestResultsInner() {
  const navigate = useNavigate()
  const { strategy, backtestResults, backtestError } = useApp()
  const [selectedTrade, setSelectedTrade] = useState(null)

  // Debug: log what we received
  console.log('[BacktestResults] backtestError:', backtestError)
  console.log('[BacktestResults] backtestResults:', backtestResults)

  if (backtestError) {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <div><div className="eyebrow">Step 3 of 3</div><h1>Backtest Failed</h1></div>
          <button className="button secondary" onClick={() => navigate('/strategy')}>← Edit Strategy</button>
        </div>
        <div className="panel">
          <div className="section-title"><h2>Error Details</h2></div>
          <p style={{ color: '#b91c1c', fontWeight: 'bold' }}>LEAN Engine encountered an error:</p>
          <pre style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '12px', border: '1px solid #fca5a5', whiteSpace: 'pre-wrap' }}>
            {backtestError}
          </pre>
          {backtestResults?.leanLogs && (
            <>
              <h3 style={{ marginTop: '20px' }}>Full LEAN Logs</h3>
              <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '11px', height: '300px', overflowY: 'auto' }}>
                {backtestResults.leanLogs}
              </pre>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!backtestResults) {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <div><div className="eyebrow">Step 3 of 3</div><h1>No Results Yet</h1></div>
          <button className="button primary" onClick={() => navigate('/strategy')}>Run Backtest →</button>
        </div>
      </div>
    )
  }

  // Safe destructuring with defaults
  const metrics = backtestResults.metrics || {}
  const equityCurve = backtestResults.equityCurve || []
  const trades = backtestResults.trades || []
  const ohlcData = backtestResults.ohlcData || []

  const totalReturn = metrics.totalReturn ?? 0
  const maxDrawdown = metrics.maxDrawdown ?? 0
  const totalTrades = metrics.totalTrades ?? 0
  const winRate = metrics.winRate ?? 0
  const startEquity = metrics.startEquity ?? 100000
  const endEquity = metrics.endEquity ?? 0

  // Format equity curve for Sparkline
  const formattedCurve = equityCurve.map(pt => ({
    label: new Date((pt.timestamp || 0) * 1000).toLocaleDateString(),
    value: pt.equity || 0
  }))

  // Calculate drawdown curve
  let peak = -Infinity
  const drawdownCurve = equityCurve.map(pt => {
    const eq = pt.equity || 0
    if (eq > peak) peak = eq
    const dd = peak === 0 ? 0 : ((eq - peak) / peak) * 100
    return {
      label: new Date((pt.timestamp || 0) * 1000).toLocaleDateString(),
      value: dd
    }
  })

  const tradeList = trades

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Step 3 of 3</div>
          <h1>Backtest Results</h1>
          <p>{strategy?.name || 'Strategy'} · {strategy?.asset || 'Asset'} · {strategy?.startDate || '?'} to {strategy?.endDate || '?'}</p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.entries(strategy || {})
              .filter(([k]) => !['name', 'asset', 'timeframe', 'startDate', 'endDate'].includes(k))
              .map(([k, v]) => (
                <span key={k} style={{ fontSize: '11px', background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                  {k}: {v}
                </span>
            ))}
          </div>
        </div>
        <button className="button secondary" onClick={() => navigate('/explore')}>Explore Parameters</button>
      </div>

      <div className="metric-grid">
        <MetricCard label={<DocTooltip termKey="return">Return</DocTooltip>} value={`${totalReturn > 0 ? '+' : ''}${totalReturn.toFixed(2)}%`} tone={totalReturn >= 0 ? "positive" : "negative"} />
        <MetricCard label={<DocTooltip termKey="drawdown">Max Drawdown</DocTooltip>} value={`${maxDrawdown.toFixed(2)}%`} tone="negative" />
        <MetricCard label={<DocTooltip termKey="trades">Total Trades</DocTooltip>} value={totalTrades} />
        <MetricCard label={<DocTooltip termKey="winRate">Win Rate</DocTooltip>} value={`${winRate.toFixed(2)}%`} />
        <MetricCard label="Final Equity" value={`₹${endEquity.toLocaleString()}`} />
      </div>

      <section className="panel" style={{ position: 'relative' }}>
        <div className="section-title">
          <div>
            <h2>Price & Trades</h2>
            <span className="muted">Click on a BUY or SELL marker on the chart to see trade details.</span>
          </div>
        </div>
        
        {selectedTrade && (
          <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', zIndex: 10, minWidth: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ color: selectedTrade.direction === 'Buy' ? '#16a34a' : '#dc2626' }}>{selectedTrade.direction} Order #{selectedTrade.orderId}</strong>
              <button onClick={() => setSelectedTrade(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
              <div style={{ color: '#64748b' }}>Date</div>
              <div style={{ fontWeight: 500 }}>{new Date(selectedTrade.time).toLocaleString()}</div>
              <div style={{ color: '#64748b' }}>Price</div>
              <div style={{ fontWeight: 500 }}>₹{(selectedTrade.price || 0).toLocaleString()}</div>
              <div style={{ color: '#64748b' }}>Quantity</div>
              <div style={{ fontWeight: 500 }}>{selectedTrade.quantity}</div>
            </div>
          </div>
        )}

        {ohlcData.length > 0 ? (
           <CandlestickChart data={ohlcData} trades={tradeList} onTradeClick={setSelectedTrade} height={400} />
        ) : (
           <p className="muted" style={{ padding: '40px', textAlign: 'center' }}>No price data available.</p>
        )}
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2><DocTooltip termKey="equityCurve">Equity Curve</DocTooltip></h2>
            <span className="muted">Portfolio Value (Start: ₹{startEquity.toLocaleString()})</span>
          </div>
        </div>
        {formattedCurve.length > 0 ? (
           <Sparkline data={formattedCurve} benchmark={false} />
        ) : (
           <p className="muted" style={{ padding: '40px', textAlign: 'center' }}>No equity data available.</p>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2><DocTooltip termKey="drawdownProfile">Drawdown Profile</DocTooltip></h2>
              <span className="muted">Peak-to-trough risk ({maxDrawdown.toFixed(2)}% max)</span>
            </div>
          </div>
          {drawdownCurve.length > 0 ? (
             <div style={{ marginTop: '20px' }}>
               <Sparkline data={drawdownCurve} benchmark={false} height={140} />
             </div>
          ) : (
             <p className="muted" style={{ padding: '40px', textAlign: 'center' }}>No drawdown data available.</p>
          )}
        </section>

        <section className="panel">
          <div className="section-title"><h2>Recent Trades</h2><button className="text-button" onClick={() => { document.getElementById('trades')?.scrollIntoView(); }}>View All</button></div>
          <div className="mini-list">
            {tradeList.length === 0 && <p className="muted">No trades executed.</p>}
            {tradeList.slice(-5).reverse().map((t, idx) => (
              <div className="mini-row" key={t.orderId || idx} style={{ cursor: 'pointer' }} onClick={() => { setSelectedTrade(t); window.scrollTo({ top: 150, behavior: 'smooth' }) }}>
                <span>{new Date(t.time).toLocaleDateString()}</span>
                <strong className={t.direction === 'Buy' ? 'buy-text' : 'sell-text'}>{t.direction}</strong>
                <span>₹{(t.price || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div id="trades" className="panel">
        <div className="section-title"><h2>All Trades</h2></div>
        <div className="table-wrap">
          {tradeList.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Price</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {tradeList.map((t, idx) => (
                  <tr key={t.orderId || idx} onClick={() => { setSelectedTrade(t); window.scrollTo({ top: 150, behavior: 'smooth' }) }} style={{ cursor: 'pointer' }} className="hover-row">
                    <td>{t.orderId}</td>
                    <td>{new Date(t.time).toLocaleString()}</td>
                    <td><span className={t.direction === 'Buy' ? 'buy-text' : 'sell-text'}>{t.direction}</span></td>
                    <td>₹{(t.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>{t.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No trade history to display.</p>
          )}
        </div>
      </div>

      <div className="bottom-actions">
        <button className="button secondary" onClick={() => navigate('/parameters')}>← Change Parameters</button>
        <button className="button primary" onClick={() => navigate('/compare')}>Compare Strategies →</button>
      </div>

      <style>{`
        .hover-row:hover {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  )
}

export default function BacktestResults() {
  return (
    <ResultsErrorBoundary>
      <BacktestResultsInner />
    </ResultsErrorBoundary>
  )
}
