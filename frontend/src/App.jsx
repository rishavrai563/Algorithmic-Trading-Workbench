import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import StrategyBuilder from './pages/StrategyBuilder'
import Parameters from './pages/Parameters'
import BacktestResults from './pages/BacktestResults'
import Explore from './pages/Explore'
import Compare from './pages/Compare'
import LoadingBacktest from './components/LoadingBacktest'
import { defaultStrategy, defaultStrategyCode } from './data/sampleData'
import { fetchStrategies, fetchAllHistory } from './api/strategies'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export default function App() {
  // Active strategy being worked on
  const [strategy, setStrategy] = useState(defaultStrategy)
  const [strategyCode, setStrategyCode] = useState(defaultStrategyCode)
  const [activeStrategyId, setActiveStrategyId] = useState(null)

  // Backtest state
  const [backtestResults, setBacktestResults] = useState(null)
  const [backtestError, setBacktestError] = useState(null)
  const [runHistory, setRunHistory] = useState([])

  // Backend-sourced data
  const [strategies, setStrategies] = useState([])
  const [backtestHistory, setBacktestHistory] = useState([])

  // Load strategies and history from the backend on mount
  const refreshData = useCallback(async () => {
    try {
      const [strats, history] = await Promise.all([
        fetchStrategies(),
        fetchAllHistory(),
      ])
      setStrategies(strats)
      setBacktestHistory(history)
    } catch (err) {
      console.warn('[App] Backend not available, using defaults:', err.message)
    }
  }, [])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  return (
    <AppContext.Provider value={{
      strategy, setStrategy,
      strategyCode, setStrategyCode,
      activeStrategyId, setActiveStrategyId,
      backtestResults, setBacktestResults,
      backtestError, setBacktestError,
      runHistory, setRunHistory,
      strategies, setStrategies,
      backtestHistory, setBacktestHistory,
      refreshData,
    }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/strategy" element={<StrategyBuilder />} />
          <Route path="/parameters" element={<Parameters />} />
          <Route path="/backtest-running" element={<LoadingBacktest />} />
          <Route path="/results" element={<BacktestResults />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/compare" element={<Compare />} />
        </Routes>
      </Layout>
    </AppContext.Provider>
  )
}
