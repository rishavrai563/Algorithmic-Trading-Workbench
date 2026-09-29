# region imports
from AlgorithmImports import *
from datetime import datetime
# endregion

# These constants are injected by the C# backend before execution.
# Do NOT change these placeholder names.
DATA_FILE = "icicibank_day.csv"
ASSET_SYMBOL = "ICICIBANK"


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
