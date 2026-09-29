import { useNavigate } from 'react-router-dom'
import { recentStrategies } from '../data/sampleData'
import { useApp } from '../App'

export default function Dashboard() {
  const navigate = useNavigate()
  const { setStrategy, setStrategyCode } = useApp()

  const openStrategy = (strategy) => {
    setStrategy(strategy.config)
    setStrategyCode(strategy.code)
    navigate('/strategy')
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
          <button className="button primary" onClick={() => navigate('/strategy')}>+ New Strategy</button>
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
        <div className="section-title"><h2>Recent Strategies</h2><button className="text-button">View All →</button></div>
        <div className="strategy-grid">
          {recentStrategies.map((strategy) => (
            <button key={strategy.name} className="strategy-card" onClick={() => openStrategy(strategy)}>
              <span className={`status-dot ${strategy.status === 'Draft' ? 'draft' : ''}`} />
              <span className="status-text">{strategy.status}</span>
              <h3>{strategy.name}</h3>
              <div className="strategy-meta"><span>Asset</span><strong>{strategy.asset}</strong></div>
              <div className="strategy-meta"><span>Summary</span><strong>{strategy.metric}</strong></div>
              <span className="open-link">Open Strategy ↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-title"><h2>Recent Backtests</h2><div className="inline-actions"><button className="button secondary small">Filter Runs</button><button className="button secondary small">Export CSV</button></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Strategy</th><th>Asset</th><th>Period</th><th>Return</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {recentStrategies.map((strategy, i) => <tr key={i}><td>{strategy.name}</td><td>{strategy.asset}</td><td>2020–2025</td><td>{i === 0 ? '+38.4%' : i === 1 ? '+29.2%' : '—'}</td><td><span className="status-badge">{strategy.status}</span></td><td><button className="text-button" onClick={() => openStrategy(strategy)}>Open →</button></td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
