import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

const flow = [
  ['1', 'CREATE', 'Define rules & signals'],
  ['2', 'TEST', 'Historical simulation'],
  ['3', 'EXPLORE', 'Inspect charts & trades'],
  ['4', 'COMPARE', 'Benchmark metrics'],
  ['5', 'UNDERSTAND', 'Explain risk & return'],
]

export default function Login() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    navigate('/dashboard')
  }

  return (
    <main className="login-page">
      <div className="login-theme-control">
        <ThemeToggle compact />
      </div>

      <header className="login-brand">
        <div className="login-brand-mark">◇</div>
        <strong>AlgoTrading</strong>
      </header>

      <section className="login-content">
        <div className="login-intro">
          <div className="login-eyebrow">
            Algorithmic Strategy Architecture
          </div>

          <h1>Build. Test. Explore.</h1>

          <p>
            Create, backtest, and understand trading strategies
            through an interactive visual workbench.
          </p>
        </div>

        <div className="login-flow">
          {flow.map(([number, title, description]) => (
            <div
              key={number}
              className={`login-flow-step ${number === '1' ? 'active' : ''}`}
            >
              <div className="login-flow-top">
                <strong>{number} {title}</strong>
                <span>•</span>
              </div>
              <span>{description}</span>
            </div>
          ))}
        </div>

        <div className="login-card">
          <div className="login-card-heading">
            <h2>Welcome back</h2>
            <p>
              Sign in to access your saved strategy workflows
              or explore as guest.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="login-field">
              <span>EMAIL ADDRESS</span>
              <input
                type="email"
                name="email"
                placeholder="researcher@institution.edu"
                autoComplete="email"
                required
              />
            </label>

            <label className="login-field">
              <span className="login-field-label">
                <span>PASSWORD</span>

                <button
                  type="button"
                  className="login-link-button"
                  onClick={() =>
                    window.alert(
                      'Password recovery is not connected in this demo.'
                    )
                  }
                >
                  Forgot password?
                </button>
              </span>

              <div className="login-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="login-show-password"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label className="login-remember">
              <input type="checkbox" />
              <span>Remember me for 30 days</span>
            </label>

            <button className="login-primary" type="submit">
              Sign In →
            </button>

            <button
              className="login-secondary"
              type="button"
              onClick={() => navigate('/dashboard')}
            >
              ◇ Continue as Guest
            </button>
          </form>

          <div className="login-divider" />

          <div className="login-signup">
            New to the workbench?

            <button
              type="button"
              className="login-link-button"
              onClick={() =>
                window.alert(
                  'Account creation is not connected in this demo.'
                )
              }
            >
              Create an account
            </button>
          </div>
        </div>

        <div className="login-note">
          <div className="login-note-icon">ⓘ</div>

          <div>
            <strong>
              Explore strategy behaviour, parameter changes,
              performance, and risk in one visual workspace.
            </strong>

            <p>
              Designed for quantitative research, algorithmic analysis,
              and learning. No real-money brokerage integration.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}