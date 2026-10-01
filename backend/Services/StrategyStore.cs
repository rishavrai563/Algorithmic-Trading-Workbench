using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// In-memory persistence store for strategies and backtest history.
/// Initialized with 3 default strategies on startup. Singleton lifetime.
/// </summary>
public class StrategyStore
{
    private readonly List<StrategyProfile> _strategies = new();
    private readonly List<BacktestRecord> _backtestHistory = new();
    private readonly object _lock = new();

    public StrategyStore()
    {
        SeedDefaults();
    }

    // ── Strategies ─────────────────────────────────────────

    public List<StrategyProfile> GetAllStrategies()
    {
        lock (_lock) return _strategies.ToList();
    }

    public StrategyProfile? GetStrategy(string id)
    {
        lock (_lock) return _strategies.FirstOrDefault(s => s.Id == id);
    }

    public StrategyProfile CreateStrategy(StrategyProfile profile)
    {
        lock (_lock)
        {
            profile.Id = Guid.NewGuid().ToString("N")[..8];
            profile.CreatedAt = DateTime.UtcNow;
            profile.UpdatedAt = DateTime.UtcNow;
            _strategies.Add(profile);
            return profile;
        }
    }

    public StrategyProfile? UpdateStrategy(string id, StrategyProfile update)
    {
        lock (_lock)
        {
            var existing = _strategies.FirstOrDefault(s => s.Id == id);
            if (existing == null) return null;

            existing.Name = update.Name;
            existing.Asset = update.Asset;
            existing.Timeframe = update.Timeframe;
            existing.StartDate = update.StartDate;
            existing.EndDate = update.EndDate;
            existing.PythonCode = update.PythonCode;
            existing.ParametersSchema = update.ParametersSchema;
            existing.ParameterValues = update.ParameterValues;
            existing.UpdatedAt = DateTime.UtcNow;
            // Status preserved unless explicitly set
            if (!string.IsNullOrEmpty(update.Status)) existing.Status = update.Status;

            return existing;
        }
    }

    public bool DeleteStrategy(string id)
    {
        lock (_lock)
        {
            var s = _strategies.FirstOrDefault(s => s.Id == id);
            if (s == null) return false;
            _strategies.Remove(s);
            return true;
        }
    }

    // ── Backtest History ───────────────────────────────────

    public List<BacktestRecord> GetBacktestHistory()
    {
        lock (_lock) return _backtestHistory.OrderByDescending(r => r.RanAt).ToList();
    }

    public List<BacktestRecord> GetHistoryForStrategy(string strategyId)
    {
        lock (_lock) return _backtestHistory
            .Where(r => r.StrategyId == strategyId)
            .OrderByDescending(r => r.RanAt)
            .ToList();
    }

    public BacktestRecord AddBacktestRecord(BacktestRecord record)
    {
        lock (_lock)
        {
            record.Id = Guid.NewGuid().ToString("N")[..8];
            record.RanAt = DateTime.UtcNow;
            _backtestHistory.Add(record);

            // Also mark the strategy as "Backtested"
            var strategy = _strategies.FirstOrDefault(s => s.Id == record.StrategyId);
            if (strategy != null)
            {
                strategy.Status = "Backtested";
                var ret = record.TotalReturn;
                strategy.LastMetricSummary = $"{ret:+0.0;-0.0}% return, {record.TotalTrades} trades";
            }

            return record;
        }
    }

    // ── Seed Data ──────────────────────────────────────────

    private void SeedDefaults()
    {
        _strategies.Add(new StrategyProfile
        {
            Id = "rsi-001",
            Name = "RSI Mean Reversion",
            Asset = "NIFTY 50",
            Timeframe = "Daily",
            StartDate = "2024-06-01",
            EndDate = "2025-01-01",
            Status = "Draft",
            PythonCode = RsiCode,
            ParametersSchema = new()
            {
                new() { Key = "rsiPeriod",      Label = "RSI Period",           Min = 5,  Max = 50, Step = 1, DocKey = "rsiPeriod" },
                new() { Key = "buyThreshold",   Label = "Oversold Threshold",   Min = 10, Max = 45, Step = 1, DocKey = "buyThreshold" },
                new() { Key = "sellThreshold",  Label = "Overbought Threshold", Min = 55, Max = 90, Step = 1, DocKey = "sellThreshold" },
                new() { Key = "stopLoss",       Label = "Stop Loss (%)",        Min = 1,  Max = 20, Step = 1, DocKey = "stopLoss" },
                new() { Key = "takeProfit",     Label = "Take Profit (%)",      Min = 5,  Max = 50, Step = 1, DocKey = "takeProfit" },
            },
            ParameterValues = new()
            {
                ["rsiPeriod"] = 14, ["buyThreshold"] = 30, ["sellThreshold"] = 70,
                ["stopLoss"] = 5, ["takeProfit"] = 10,
            },
        });

        _strategies.Add(new StrategyProfile
        {
            Id = "mac-002",
            Name = "Moving Average Crossover",
            Asset = "RELIANCE",
            Timeframe = "Daily",
            StartDate = "2024-06-01",
            EndDate = "2025-01-01",
            Status = "Draft",
            PythonCode = MacCode,
            ParametersSchema = new()
            {
                new() { Key = "fastMa",  Label = "Fast MA Period", Min = 5,  Max = 50,  Step = 1, DocKey = "fastMa" },
                new() { Key = "slowMa",  Label = "Slow MA Period", Min = 20, Max = 200, Step = 1, DocKey = "slowMa" },
            },
            ParameterValues = new()
            {
                ["fastMa"] = 10, ["slowMa"] = 50,
            },
        });

        _strategies.Add(new StrategyProfile
        {
            Id = "brk-003",
            Name = "Breakout Strategy",
            Asset = "TCS",
            Timeframe = "Daily",
            StartDate = "2024-06-01",
            EndDate = "2025-01-01",
            Status = "Draft",
            PythonCode = BrkCode,
            ParametersSchema = new()
            {
                new() { Key = "lookback", Label = "Lookback Period", Min = 5, Max = 60, Step = 1, DocKey = "lookback" },
            },
            ParameterValues = new()
            {
                ["lookback"] = 20,
            },
        });
    }

    // ── Code Templates ─────────────────────────────────────
    // (Same code that was in the frontend sampleData.js)

    private const string RsiCode = @"# region imports
from AlgorithmImports import *
from datetime import datetime
# endregion

DATA_FILE = ""__DATA_FILE__""
ASSET_SYMBOL = ""__ASSET_SYMBOL__""

class CustomMarketData(PythonData):
    def get_source(self, config, date, is_live_mode):
        return SubscriptionDataSource(f""/Lean/Data/custom/{DATA_FILE}"", SubscriptionTransportMedium.LOCAL_FILE)
    def reader(self, config, line, date, is_live_mode):
        if not line.strip() or line.startswith(""Date""): return None
        try:
            parts = line.split("","")
            data = CustomMarketData()
            data.Symbol = config.Symbol
            data.Time = datetime.strptime(parts[0].strip(), ""%Y-%m-%d"")
            data.Value = float(parts[4])
            data[""Open""] = float(parts[1])
            data[""High""] = float(parts[2])
            data[""Low""] = float(parts[3])
            data[""Close""] = float(parts[4])
            data[""Volume""] = float(parts[5])
            return data
        except (ValueError, IndexError):
            return None

class RSIMeanReversion(QCAlgorithm):
    def initialize(self):
        start_str = self.get_parameter(""start-date"", ""2024-06-01"")
        end_str = self.get_parameter(""end-date"", ""2025-01-01"")
        start_parts = start_str.split(""-"")
        end_parts = end_str.split(""-"")
        self.set_start_date(int(start_parts[0]), int(start_parts[1]), int(start_parts[2]))
        self.set_end_date(int(end_parts[0]), int(end_parts[1]), int(end_parts[2]))
        self.set_cash(100000)

        self.asset = self.add_data(CustomMarketData, ASSET_SYMBOL, Resolution.DAILY)
        self.asset_symbol = self.asset.Symbol

        rsi_period = int(self.get_parameter(""rsi-period"", ""14""))
        self.rsi = RelativeStrengthIndex(rsi_period, MovingAverageType.WILDERS)
        self.register_indicator(self.asset_symbol, self.rsi, None)

        self.oversold = float(self.get_parameter(""oversold"", ""30""))
        self.overbought = float(self.get_parameter(""overbought"", ""70""))

    def on_data(self, data):
        if not data.contains_key(self.asset_symbol): return
        if not self.rsi.is_ready: return

        price = data[self.asset_symbol].Value
        rsi_value = self.rsi.current.value

        if rsi_value < self.oversold and not self.portfolio.invested:
            self.set_holdings(self.asset_symbol, 1.0)
            self.debug(f""BUY at {price:.2f}, RSI={rsi_value:.2f}"")
        elif rsi_value > self.overbought and self.portfolio.invested:
            self.liquidate(self.asset_symbol)
            self.debug(f""SELL at {price:.2f}, RSI={rsi_value:.2f}"")
";

    private const string MacCode = @"# region imports
from AlgorithmImports import *
from datetime import datetime
# endregion

DATA_FILE = ""__DATA_FILE__""
ASSET_SYMBOL = ""__ASSET_SYMBOL__""

class CustomMarketData(PythonData):
    def get_source(self, config, date, is_live_mode):
        return SubscriptionDataSource(f""/Lean/Data/custom/{DATA_FILE}"", SubscriptionTransportMedium.LOCAL_FILE)
    def reader(self, config, line, date, is_live_mode):
        if not line.strip() or line.startswith(""Date""): return None
        try:
            parts = line.split("","")
            data = CustomMarketData()
            data.Symbol = config.Symbol
            data.Time = datetime.strptime(parts[0].strip(), ""%Y-%m-%d"")
            data.Value = float(parts[4])
            data[""Open""] = float(parts[1])
            data[""High""] = float(parts[2])
            data[""Low""] = float(parts[3])
            data[""Close""] = float(parts[4])
            data[""Volume""] = float(parts[5])
            return data
        except:
            return None

class MovingAverageCrossover(QCAlgorithm):
    def initialize(self):
        start_str = self.get_parameter(""start-date"", ""2024-01-01"")
        end_str = self.get_parameter(""end-date"", ""2025-01-01"")
        start_parts = start_str.split(""-"")
        end_parts = end_str.split(""-"")
        self.set_start_date(int(start_parts[0]), int(start_parts[1]), int(start_parts[2]))
        self.set_end_date(int(end_parts[0]), int(end_parts[1]), int(end_parts[2]))
        self.set_cash(100000)

        self.asset = self.add_data(CustomMarketData, ASSET_SYMBOL, Resolution.DAILY)
        self.asset_symbol = self.asset.Symbol

        fast_period = int(self.get_parameter(""fast-ma"", ""10""))
        slow_period = int(self.get_parameter(""slow-ma"", ""50""))
        self.fast_ma = self.sma(self.asset_symbol, fast_period, Resolution.DAILY)
        self.slow_ma = self.sma(self.asset_symbol, slow_period, Resolution.DAILY)

    def on_data(self, data):
        if not self.slow_ma.is_ready: return
        price = data[self.asset_symbol].Value
        if not self.portfolio.invested and self.fast_ma.current.value > self.slow_ma.current.value:
            self.set_holdings(self.asset_symbol, 1.0)
            self.debug(f""BUY at {price:.2f}"")
        elif self.portfolio.invested and self.fast_ma.current.value < self.slow_ma.current.value:
            self.liquidate(self.asset_symbol)
            self.debug(f""SELL at {price:.2f}"")
";

    private const string BrkCode = @"# region imports
from AlgorithmImports import *
from datetime import datetime
# endregion

DATA_FILE = ""__DATA_FILE__""
ASSET_SYMBOL = ""__ASSET_SYMBOL__""

class CustomMarketData(PythonData):
    def get_source(self, config, date, is_live_mode):
        return SubscriptionDataSource(f""/Lean/Data/custom/{DATA_FILE}"", SubscriptionTransportMedium.LOCAL_FILE)
    def reader(self, config, line, date, is_live_mode):
        if not line.strip() or line.startswith(""Date""): return None
        try:
            parts = line.split("","")
            data = CustomMarketData()
            data.Symbol = config.Symbol
            data.Time = datetime.strptime(parts[0].strip(), ""%Y-%m-%d"")
            data.Value = float(parts[4])
            data[""Open""] = float(parts[1])
            data[""High""] = float(parts[2])
            data[""Low""] = float(parts[3])
            data[""Close""] = float(parts[4])
            data[""Volume""] = float(parts[5])
            return data
        except:
            return None

class BreakoutStrategy(QCAlgorithm):
    def initialize(self):
        start_str = self.get_parameter(""start-date"", ""2024-01-01"")
        end_str = self.get_parameter(""end-date"", ""2025-01-01"")
        start_parts = start_str.split(""-"")
        end_parts = end_str.split(""-"")
        self.set_start_date(int(start_parts[0]), int(start_parts[1]), int(start_parts[2]))
        self.set_end_date(int(end_parts[0]), int(end_parts[1]), int(end_parts[2]))
        self.set_cash(100000)

        self.asset = self.add_data(CustomMarketData, ASSET_SYMBOL, Resolution.DAILY)
        self.asset_symbol = self.asset.Symbol

        self.lookback = int(self.get_parameter(""lookback"", ""20""))
        self.max = self.max(self.asset_symbol, self.lookback, Resolution.DAILY)
        self.min = self.min(self.asset_symbol, self.lookback, Resolution.DAILY)

    def on_data(self, data):
        if not self.max.is_ready: return
        price = data[self.asset_symbol].Value
        if not self.portfolio.invested and price >= self.max.current.value:
            self.set_holdings(self.asset_symbol, 1.0)
            self.debug(f""BUY Breakout at {price:.2f}"")
        elif self.portfolio.invested and price <= self.min.current.value:
            self.liquidate(self.asset_symbol)
            self.debug(f""SELL Breakdown at {price:.2f}"")
";
}
