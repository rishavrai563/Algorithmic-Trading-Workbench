import { NavLink, Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

const links = [
  { to: '/', label: 'Dashboard', icon: '⌂' },
  { to: '/strategy', label: 'Strategy Builder', icon: '◇' },
  { to: '/parameters', label: 'Parameters', icon: '◒' },
  { to: '/results', label: 'Backtest Results', icon: '▥' },
  { to: '/explore', label: 'Explore', icon: '↔' },
  { to: '/compare', label: 'Compare', icon: '⇄' },
  { to: '/profile', label: 'Profile', icon: '◉' },
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
  <div className="topbar-left">
    <ThemeToggle />
    <div className="breadcrumbs">
      Algorithmic Trading Visualization Workbench
    </div>
  </div>

  <Link to="/profile" className="user-chip" style={{ textDecoration: 'none', color: 'inherit' }}>
    <span className="avatar">R</span>
    Rishav Kumar
  </Link>
</header>
        <div className="page-area">{children}</div>
      </main>
    </div>
  )
}
