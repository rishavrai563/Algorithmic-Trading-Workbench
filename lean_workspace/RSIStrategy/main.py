# region imports
from AlgorithmImports import *
from datetime import datetime
# endregion


class Nifty50Data(PythonData):
    """
    Custom data class to load NIFTY 50 OHLCV data from a local CSV file.
    CSV format: Date,Open,High,Low,Close,Volume
    """

    def get_source(self, config, date, is_live_mode):
        return SubscriptionDataSource(
            "/Lean/Data/custom/nifty50.csv",
            SubscriptionTransportMedium.LOCAL_FILE
        )

    def reader(self, config, line, date, is_live_mode):
        # Skip header line
        if not line.strip() or line.startswith("Date"):
            return None

        try:
            parts = line.split(",")
            data = Nifty50Data()
            data.Symbol = config.Symbol
            data.Time = datetime.strptime(parts[0].strip(), "%Y-%m-%d")
            data.Value = float(parts[4])  # Close price
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
    RSI Mean Reversion Strategy for NIFTY 50.

    Logic:
        - BUY (go long) when RSI drops below the oversold threshold
        - SELL (liquidate) when RSI rises above the overbought threshold

    All parameters are configurable via the config.json parameters section,
    which is written dynamically by the Streamlit orchestrator.
    """

    def initialize(self):
        # Parse date parameters
        start_str = self.get_parameter("start-date", "2020-01-01")
        end_str = self.get_parameter("end-date", "2025-01-01")

        start_parts = start_str.split("-")
        end_parts = end_str.split("-")

        self.set_start_date(int(start_parts[0]), int(start_parts[1]), int(start_parts[2]))
        self.set_end_date(int(end_parts[0]), int(end_parts[1]), int(end_parts[2]))

        # Starting capital in INR
        self.set_cash(100000)

        # Add custom NIFTY 50 data
        self.nifty = self.add_data(Nifty50Data, "NIFTY50", Resolution.DAILY)
        self.nifty_symbol = self.nifty.Symbol

        # RSI indicator with configurable period
        rsi_period = int(self.get_parameter("rsi-period", "14"))
        self.rsi = RelativeStrengthIndex(rsi_period, MovingAverageType.WILDERS)

        # Register the indicator with our custom data
        self.register_indicator(self.nifty_symbol, self.rsi, None)

        # Configurable thresholds
        self.oversold = float(self.get_parameter("oversold", "30"))
        self.overbought = float(self.get_parameter("overbought", "70"))

        # Track for logging
        self.trade_count = 0

        self.debug(f"RSI Mean Reversion initialized: period={rsi_period}, "
                   f"oversold={self.oversold}, overbought={self.overbought}")

    def on_data(self, data):
        # Ensure we have data and RSI is ready
        if not data.contains_key(self.nifty_symbol):
            return
        if not self.rsi.is_ready:
            return

        price = data[self.nifty_symbol].Value
        rsi_value = self.rsi.current.value

        # BUY signal: RSI below oversold threshold
        if rsi_value < self.oversold and not self.portfolio.invested:
            self.set_holdings(self.nifty_symbol, 1.0)
            self.trade_count += 1
            self.debug(f"BUY at {price:.2f}, RSI={rsi_value:.2f}")

        # SELL signal: RSI above overbought threshold
        elif rsi_value > self.overbought and self.portfolio.invested:
            self.liquidate(self.nifty_symbol)
            self.trade_count += 1
            self.debug(f"SELL at {price:.2f}, RSI={rsi_value:.2f}")
