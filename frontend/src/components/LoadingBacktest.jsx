import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoadingBacktest() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(18)

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => Math.min(100, p + 14))
    }, 220)
    const done = setTimeout(() => navigate('/results'), 1800)
    return () => {
      clearInterval(timer)
      clearTimeout(done)
    }
  }, [navigate])

  const steps = [
    ['Loading historical price data', progress > 25],
    ['Calculating indicator values', progress > 45],
    ['Processing strategy signals', progress > 65],
    ['Compiling performance results', progress > 85],
  ]

  return (
    <section className="center-page">
      <div className="loading-card panel">
        <div className="eyebrow">Backtests / Running</div>
        <h1>Running Backtest</h1>
        <p>Simulating the strategy on sample historical data.</p>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        <div className="progress-label">{progress}% complete</div>
        <div className="step-list">
          {steps.map(([label, done]) => (
            <div className={`step-row ${done ? 'done' : ''}`} key={label}>
              <span className="step-dot">{done ? '✓' : '•'}</span>{label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
