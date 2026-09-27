export const defaultStrategy = {
  name: 'RSI Mean Reversion',
  asset: 'NIFTY 50',
  timeframe: 'Daily',
  startDate: '2020-01-01',
  endDate: '2025-01-01',
  rsiPeriod: 14,
  buyThreshold: 30,
  sellThreshold: 70,
  stopLoss: 5,
  takeProfit: 10,
}

export const recentStrategies = [
  { name: 'RSI Mean Reversion', asset: 'NIFTY 50', status: 'Backtested', metric: '61.9% win rate' },
  { name: 'Moving Average Crossover', asset: 'AAPL', status: 'Backtested', metric: '28 trades' },
  { name: 'Breakout Strategy', asset: 'BTC-USD', status: 'Draft', metric: 'Not tested' },
]

export const historicalTrades = [
  { id: 1, date: '2020-03-12', action: 'BUY', price: 11200, quantity: 100, pnl: 4.8 },
  { id: 2, date: '2020-05-18', action: 'SELL', price: 11950, quantity: 100, pnl: 8.5 },
  { id: 3, date: '2020-06-10', action: 'BUY', price: 10420, quantity: 100, pnl: -2.1 },
  { id: 4, date: '2020-08-22', action: 'SELL', price: 11080, quantity: 100, pnl: 6.3 },
  { id: 5, date: '2020-09-15', action: 'BUY', price: 11120, quantity: 100, pnl: 3.2 },
  { id: 6, date: '2020-11-30', action: 'SELL', price: 12930, quantity: 100, pnl: 11.2 },
  { id: 7, date: '2021-01-10', action: 'BUY', price: 14350, quantity: 100, pnl: -1.3 },
  { id: 8, date: '2021-03-05', action: 'SELL', price: 14980, quantity: 100, pnl: 5.7 },
]

export function generateEquityCurve(strategy = defaultStrategy) {
  const sensitivity = (strategy.buyThreshold - 30) * 0.35 - (strategy.sellThreshold - 70) * 0.08
  const base = [100, 101, 100.5, 103, 106, 104, 108, 111, 109, 115, 118, 116, 121, 125, 127, 130, 128, 134, 139, 145]
  return base.map((value, index) => ({
    label: ['2020', '', '2020', '', '2021', '', '2021', '', '2022', '', '2022', '', '2023', '', '2023', '', '2024', '', '2024', '2025'][index],
    value: Number((value + sensitivity * (index / 4)).toFixed(2)),
  }))
}

export function calculateMetrics(strategy = defaultStrategy) {
  const thresholdGap = Math.max(0, Math.abs(strategy.sellThreshold - strategy.buyThreshold) - 20)
  const returnPct = 38.4 + (strategy.buyThreshold - 30) * 0.55 - Math.max(0, 70 - strategy.sellThreshold) * 0.15
  const drawdown = -14.2 - thresholdGap * 0.22 - Math.max(0, strategy.buyThreshold - 30) * 0.08
  const trades = Math.max(16, Math.round(42 - (strategy.buyThreshold - 30) * 0.6 + (70 - strategy.sellThreshold) * 0.35))
  const winRate = Math.min(75, Math.max(45, 61.9 + (strategy.buyThreshold - 30) * 0.12 - (70 - strategy.sellThreshold) * 0.05))
  const finalEquity = 100000 * (1 + returnPct / 100)
  return {
    returnPct: Number(returnPct.toFixed(1)),
    drawdown: Number(drawdown.toFixed(1)),
    trades,
    winRate: Number(winRate.toFixed(1)),
    finalEquity: Math.round(finalEquity),
  }
}
