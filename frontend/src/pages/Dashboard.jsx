import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { createStrategy } from '../api/strategies'
import DocTooltip from '../components/DocTooltip'
import { defaultStrategyCode } from '../data/sampleData'

export default function Dashboard() {
  const navigate = useNavigate()
  const { strategies, backtestHistory, setStrategy, setStrategyCode, setActiveStrategyId, refreshData } = useApp()

  const openStrategy = (s) => {
    // Build the config object the frontend needs
    setActiveStrategyId(s.id)
    setStrategy({
      name: s.name,
      asset: s.asset,
      timeframe: s.timeframe,
      startDate: s.startDate,
      endDate: s.endDate,
      ...s.parameterValues,
    })
    setStrategyCode(s.pythonCode)
    navigate('/strategy')
  }

  const handleNewStrategy = async () => {
    try {
      const blank = await createStrategy({
        name: 'New Strategy',
        asset: 'NIFTY 50',
        timeframe: 'Daily',
        startDate: '2024-06-01',
        endDate: '2025-01-01',
        status: 'Draft',
        pythonCode: defaultStrategyCode,
        parametersSchema: [
          { key: 'rsiPeriod', label: 'RSI Period', min: 5, max: 50, step: 1, docKey: 'rsiPeriod' },
          { key: 'buyThreshold', label: 'Oversold Threshold', min: 10, max: 45, step: 1, docKey: 'buyThreshold' },
          { key: 'sellThreshold', label: 'Overbought Threshold', min: 55, max: 90, step: 1, docKey: 'sellThreshold' },
        ],
        parameterValues: { rsiPeriod: 14, buyThreshold: 30, sellThreshold: 70 },
      })
      await refreshData()
      openStrategy(blank)
    } catch (err) {
      console.error('Failed to create strategy:', err)
      // Fallback: just navigate
      navigate('/strategy')
    }
  }

  return (
    <div className="page-stack">
      <section className="hero panel">
        <div>
          <div className="eyebrow">Strategy Workbench</div>
          <h1>Build, backtest, explore, and compare strategies.</h1>
          <p>Human-centered interface for understanding how strategy rules affect outcomes.</p>
        </div>
        <div className="hero-actions">
          <button className="button secondary" onClick={() => navigate('/strategy')}>Open Builder</button>
          <button className="button primary" onClick={handleNewStrategy}>+ New Strategy</button>
        </div>
      </section>

      <section className="flow panel">
        <div className="section-title"><h2>Strategy flow</h2><span className="muted">Create → Test → Explore → Compare → Understand</span></div>
        <div className="flow-grid">
          {[
            ['1', 'CREATE', 'Define rules & signals'],
            ['2', 'TEST', 'Run historical simulation'],
            ['3', 'EXPLORE', 'Inspect charts & trades'],
            ['4', 'COMPARE', 'Compare configurations'],
            ['5', 'UNDERSTAND', 'Explain risk & return'],
          ].map(([n, title, desc]) => (
            <button className="flow-card" key={n} onClick={() => n === '1' ? navigate('/strategy') : n === '2' ? navigate('/parameters') : n === '4' ? navigate('/compare') : navigate('/results')}>
              <div className="flow-number">{n}</div>
              <strong>{title}</strong>
              <span>{desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-title"><h2>Strategies</h2><button className="text-button" onClick={handleNewStrategy}>+ New Strategy</button></div>
        <div className="strategy-grid">
          {strategies.length > 0 ? strategies.map((s) => (
            <button key={s.id} className="strategy-card" onClick={() => openStrategy(s)}>
              <span className={`status-dot ${s.status === 'Draft' ? 'draft' : ''}`} />
              <span className="status-text">{s.status}</span>
              <h3>{s.name}</h3>
              <div className="strategy-meta"><span>Asset</span><strong>{s.asset}</strong></div>
              <div className="strategy-meta"><span>Summary</span><strong>{s.lastMetricSummary || 'Not tested yet'}</strong></div>
              <span className="open-link">Open Strategy ↗</span>
            </button>
          )) : (
            <p className="muted" style={{ padding: '20px' }}>Loading strategies...</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-title"><h2>Recent <DocTooltip termKey="backtest">Backtests</DocTooltip></h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Strategy</th><th>Asset</th><th>Period</th><th><DocTooltip termKey="return">Return</DocTooltip></th><th>Date</th></tr></thead>
            <tbody>
              {backtestHistory.length > 0 ? backtestHistory.slice(0, 10).map((r) => (
                <tr key={r.id}>
                  <td>{r.strategyName}</td>
                  <td>{r.asset}</td>
                  <td>{r.period}</td>
                  <td className={r.totalReturn >= 0 ? 'positive' : 'negative'}>{r.totalReturn >= 0 ? '+' : ''}{r.totalReturn?.toFixed(2)}%</td>
                  <td>{new Date(r.ranAt).toLocaleDateString()}</td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No backtests run yet. Open a strategy and run your first backtest!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
