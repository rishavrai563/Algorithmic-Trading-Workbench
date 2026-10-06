import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', icon: '⌂' },
  { to: '/strategy', label: 'Strategy Builder', icon: '◇' },
  { to: '/parameters', label: 'Parameters', icon: '◒' },
  { to: '/results', label: 'Backtest Results', icon: '▥' },
  { to: '/explore', label: 'Explore', icon: '↔' },
  { to: '/compare', label: 'Compare', icon: '⇄' },
]

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>AlgoTrade</strong>
            <span>Workbench</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className="nav-item">
              <span className="nav-icon">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

       
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">Algorithmic Trading Visualization Workbench</div>
          <div className="user-chip"><span className="avatar">R</span> Rishav Kumar</div>
        </header>
        <div className="page-area">{children}</div>
      </main>
    </div>
  )
}
