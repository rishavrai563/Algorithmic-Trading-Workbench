import { createContext, useContext, useState } from 'react'
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

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export default function App() {
  const [strategy, setStrategy] = useState(defaultStrategy)
  const [strategyCode, setStrategyCode] = useState(defaultStrategyCode)
  const [backtestResults, setBacktestResults] = useState(null)
  const [backtestError, setBacktestError] = useState(null)

  return (
    <AppContext.Provider value={{
      strategy, setStrategy,
      strategyCode, setStrategyCode,
      backtestResults, setBacktestResults,
      backtestError, setBacktestError,
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
