import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { runBacktest } from '../api/backtest'

export default function LoadingBacktest() {
  const navigate = useNavigate()
  const { strategy, strategyCode, setBacktestResults, setBacktestError } = useApp()
  const [status, setStatus] = useState('Checking cache and fetching historical data...')
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const execute = async () => {
      try {
        setBacktestError(null)
        setStatus(`Fetching historical data for ${strategy.asset}...`)
        
        const config = {
          asset: strategy.asset,
          resolution: strategy.timeframe,
          startDate: strategy.startDate,
          endDate: strategy.endDate,
          startingCash: 100000
        }

        const result = await runBacktest(strategyCode, config)

        if (result.success) {
          setStatus('Results parsed successfully!')
          setBacktestResults(result)
          navigate('/results')
        } else {
          setBacktestError(result.errorMessage || 'Execution failed')
          setBacktestResults(result) // Might contain logs
          navigate('/results')
        }
      } catch (err) {
        setBacktestError(err.message)
        navigate('/results')
      }
    }

    execute()
  }, [strategy, strategyCode, navigate, setBacktestResults, setBacktestError])

  return (
    <section className="center-page">
      <div className="loading-card panel">
        <div className="eyebrow">Backtests / Running</div>
        <h1>Running Backtest</h1>
        <p>Fetching historical data and executing your strategy in LEAN.</p>
        
        <div className="progress-track">
          <div className="progress-fill" style={{ width: '100%', animation: 'pulse 2s infinite' }} />
        </div>
        
        <div className="step-list">
          <div className="step-row done">
            <span className="step-dot">⌛</span>{status}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </section>
  )
}
