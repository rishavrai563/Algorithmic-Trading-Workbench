import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { runBacktest, getJobStatus } from '../api/backtest'
import { recordBacktest } from '../api/strategies'

export default function LoadingBacktest() {
  const navigate = useNavigate()
  const { strategy, strategyCode, setBacktestResults, setBacktestError, setRunHistory, activeStrategyId, refreshData } = useApp()
  const [status, setStatus] = useState('Submitting backtest request...')
  const [progress, setProgress] = useState(0)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const execute = async () => {
      try {
        setBacktestError(null)
        
        const parameters = {}
        for (const [key, value] of Object.entries(strategy)) {
          if (!['name', 'asset', 'timeframe', 'startDate', 'endDate'].includes(key)) {
            if (key === 'buyThreshold') parameters['oversold'] = String(value)
            else if (key === 'sellThreshold') parameters['overbought'] = String(value)
            else parameters[key.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()] = String(value)
          }
        }

        const config = {
          asset: strategy.asset,
          resolution: strategy.timeframe,
          startDate: strategy.startDate,
          endDate: strategy.endDate,
          startingCash: 100000,
          parameters: parameters
        }

        const { jobId } = await runBacktest(strategyCode, config)

        const pollInterval = setInterval(async () => {
          try {
            const jobInfo = await getJobStatus(jobId)
            
            if (jobInfo.isComplete) {
              clearInterval(pollInterval)
              const result = jobInfo.result
              
              if (result.success) {
                setStatus('Results parsed successfully!')
                setProgress(100)
                setBacktestResults(result)
                
                // Add to run history
                setRunHistory(prev => {
                  const newRun = {
                    id: Date.now(),
                    name: `Run ${prev.length + 1}`,
                    config,
                    strategyConfig: { ...strategy },
                    metrics: result.metrics || {},
                    equityCurve: result.equityCurve || [],
                  };
                  return [...prev, newRun];
                })

                // Record to backend for persistence
                if (activeStrategyId) {
                  const m = result.metrics || {}
                  recordBacktest(activeStrategyId, {
                    strategyName: strategy.name,
                    asset: strategy.asset,
                    period: `${strategy.startDate} → ${strategy.endDate}`,
                    totalReturn: m.totalReturn || 0,
                    maxDrawdown: m.maxDrawdown || 0,
                    totalTrades: m.totalTrades || 0,
                    winRate: m.winRate || 0,
                    startEquity: m.startEquity || 100000,
                    endEquity: m.endEquity || 100000,
                    parameterValues: Object.fromEntries(
                      Object.entries(strategy)
                        .filter(([k]) => !['name','asset','timeframe','startDate','endDate'].includes(k))
                        .filter(([, v]) => typeof v === 'number')
                    ),
                  })
                    .then(() => refreshData())
                    .catch(err => console.warn('Failed to record backtest:', err))
                }

                navigate('/results')
              } else {
                setBacktestError(result.errorMessage || 'Execution failed')
                setBacktestResults(result)
                navigate('/results')
              }
            } else {
              setStatus(jobInfo.status)
              setProgress(jobInfo.progress)
            }
          } catch (err) {
            clearInterval(pollInterval)
            setBacktestError(err.message)
            navigate('/results')
          }
        }, 500)

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
          <div className="progress-fill" style={{ width: `${Math.max(5, progress)}%`, transition: 'width 0.5s ease-out' }} />
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
