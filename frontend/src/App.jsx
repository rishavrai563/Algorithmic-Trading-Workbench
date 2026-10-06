import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import Layout from './components/Layout'
import Login from './pages/Login'

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

function AppPage({ children }) {
  return <Layout>{children}</Layout>
}

export default function App() {
  const [strategy, setStrategy] = useState(defaultStrategy)
  const [strategyCode, setStrategyCode] = useState(defaultStrategyCode)
  const [activeStrategyId, setActiveStrategyId] = useState(null)

  const [backtestResults, setBacktestResults] = useState(null)
  const [backtestError, setBacktestError] = useState(null)
  const [runHistory, setRunHistory] = useState([])

  const [strategies, setStrategies] = useState([])
  const [backtestHistory, setBacktestHistory] = useState([])

  const refreshData = useCallback(async () => {
    try {
      const [strats, history] = await Promise.all([
        fetchStrategies(),
        fetchAllHistory(),
      ])

      setStrategies(strats)
      setBacktestHistory(history)
    } catch (err) {
      console.warn(
        '[App] Backend not available, using defaults:',
        err.message
      )
    }
  }, [])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  return (
    <AppContext.Provider
      value={{
        strategy,
        setStrategy,
        strategyCode,
        setStrategyCode,
        activeStrategyId,
        setActiveStrategyId,

        backtestResults,
        setBacktestResults,
        backtestError,
        setBacktestError,

        runHistory,
        setRunHistory,

        strategies,
        setStrategies,
        backtestHistory,
        setBacktestHistory,

        refreshData,
      }}
    >
      <Routes>

        {/* Initial page */}
        <Route path="/" element={<Login />} />

        {/* Main application */}
        <Route
          path="/dashboard"
          element={
            <AppPage>
              <Dashboard />
            </AppPage>
          }
        />

        <Route
          path="/strategy"
          element={
            <AppPage>
              <StrategyBuilder />
            </AppPage>
          }
        />

        <Route
          path="/parameters"
          element={
            <AppPage>
              <Parameters />
            </AppPage>
          }
        />

        <Route
          path="/backtest-running"
          element={
            <AppPage>
              <LoadingBacktest />
            </AppPage>
          }
        />

        <Route
          path="/results"
          element={
            <AppPage>
              <BacktestResults />
            </AppPage>
          }
        />

        <Route
          path="/explore"
          element={
            <AppPage>
              <Explore />
            </AppPage>
          }
        />

        <Route
          path="/compare"
          element={
            <AppPage>
              <Compare />
            </AppPage>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AppContext.Provider>
  )
}