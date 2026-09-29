export const defaultStrategy = {
  name: 'RSI Mean Reversion',
  asset: 'NIFTY 50',
  timeframe: 'Daily',
  startDate: '2024-06-01',
  endDate: '2025-01-01',
  rsiPeriod: 14,
  buyThreshold: 30,
  sellThreshold: 70,
  stopLoss: 5,
  takeProfit: 10,
}

// Default Python LEAN strategy — generalized for any asset.
// The C# backend replaces __DATA_FILE__ and __ASSET_SYMBOL__ before LEAN execution.
export const defaultStrategyCode = `# region imports
from AlgorithmImports import *
from datetime import datetime
# endregion

# These constants are injected by the C# backend before execution.
# Do NOT change these placeholder names.
DATA_FILE = "__DATA_FILE__"
ASSET_SYMBOL = "__ASSET_SYMBOL__"


class CustomMarketData(PythonData):
    """
    Generic custom data class that loads OHLCV data from a CSV file.
    The file path is injected as a module-level constant by the backend.
    """

    def get_source(self, config, date, is_live_mode):
        return SubscriptionDataSource(
            f"/Lean/Data/custom/{DATA_FILE}",
            SubscriptionTransportMedium.LOCAL_FILE
        )

    def reader(self, config, line, date, is_live_mode):
        if not line.strip() or line.startswith("Date"):
            return None
        try:
            parts = line.split(",")
            data = CustomMarketData()
            data.Symbol = config.Symbol
            data.Time = datetime.strptime(parts[0].strip(), "%Y-%m-%d")
            data.Value = float(parts[4])
            data["Open"] = float(parts[1])
            data["High"] = float(parts[2])
            data["Low"] = float(parts[3])
            data["Close"] = float(parts[4])
            data["Volume"] = float(parts[5])
            return data
        except (ValueError, IndexError):
            return None


class RSIMeanReversion(QCAlgorithm):
    """
    RSI Mean Reversion Strategy.
    Works with any asset configured via backend injection.
    BUY when RSI drops below oversold threshold.
    SELL when RSI rises above overbought threshold.
    """

    def initialize(self):
        start_str = self.get_parameter("start-date", "2024-06-01")
        end_str = self.get_parameter("end-date", "2025-01-01")
        start_parts = start_str.split("-")
        end_parts = end_str.split("-")
        self.set_start_date(int(start_parts[0]), int(start_parts[1]), int(start_parts[2]))
        self.set_end_date(int(end_parts[0]), int(end_parts[1]), int(end_parts[2]))
        self.set_cash(100000)

        self.asset = self.add_data(CustomMarketData, ASSET_SYMBOL, Resolution.DAILY)
        self.asset_symbol = self.asset.Symbol

        rsi_period = int(self.get_parameter("rsi-period", "14"))
        self.rsi = RelativeStrengthIndex(rsi_period, MovingAverageType.WILDERS)
        self.register_indicator(self.asset_symbol, self.rsi, None)

        self.oversold = float(self.get_parameter("oversold", "30"))
        self.overbought = float(self.get_parameter("overbought", "70"))

        self.debug(f"RSI Mean Reversion initialized on {ASSET_SYMBOL}: "
                   f"period={rsi_period}, oversold={self.oversold}, overbought={self.overbought}")

    def on_data(self, data):
        if not data.contains_key(self.asset_symbol):
            return
        if not self.rsi.is_ready:
            return

        price = data[self.asset_symbol].Value
        rsi_value = self.rsi.current.value

        if rsi_value < self.oversold and not self.portfolio.invested:
            self.set_holdings(self.asset_symbol, 1.0)
            self.debug(f"BUY at {price:.2f}, RSI={rsi_value:.2f}")

        elif rsi_value > self.overbought and self.portfolio.invested:
            self.liquidate(self.asset_symbol)
            self.debug(f"SELL at {price:.2f}, RSI={rsi_value:.2f}")
`

export const recentStrategies = [
  { name: 'RSI Mean Reversion', asset: 'NIFTY 50', status: 'Backtested', metric: '61.9% win rate' },
  { name: 'Moving Average Crossover', asset: 'RELIANCE', status: 'Backtested', metric: '28 trades' },
  { name: 'Breakout Strategy', asset: 'TCS', status: 'Draft', metric: 'Not tested' },
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
