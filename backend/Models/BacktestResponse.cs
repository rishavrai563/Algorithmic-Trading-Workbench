namespace AlgoTrading.Models;

/// <summary>
/// Structured backtest response returned to the frontend.
/// All fields are populated from real LEAN Engine output.
/// </summary>
public class BacktestResponse
{
    public bool Success { get; set; }
    public string Status { get; set; } = "Unknown";  // Preparing, Running, Completed, Failed
    public string? ErrorMessage { get; set; }
    public string? LeanLogs { get; set; }

    public BacktestMetrics? Metrics { get; set; }
    public List<EquityPoint>? EquityCurve { get; set; }
    public List<TradeEvent>? Trades { get; set; }
    public Dictionary<string, string>? RawStatistics { get; set; }

    /// <summary>OHLCV candle data for the candlestick chart visualization.</summary>
    public List<OhlcCandle>? OhlcData { get; set; }
}

public class BacktestMetrics
{
    public double TotalReturn { get; set; }
    public double MaxDrawdown { get; set; }
    public int TotalTrades { get; set; }
    public double WinRate { get; set; }
    public double SharpeRatio { get; set; }
    public double StartEquity { get; set; }
    public double EndEquity { get; set; }
}

public class EquityPoint
{
    public long Timestamp { get; set; }   // Unix seconds
    public double Equity { get; set; }
}

public class TradeEvent
{
    public string Time { get; set; } = "";
    public string Direction { get; set; } = "";  // "Buy" or "Sell"
    public double Price { get; set; }
    public double Quantity { get; set; }
    public int OrderId { get; set; }
}

/// <summary>
/// OHLC candle for the frontend candlestick chart.
/// </summary>
public class OhlcCandle
{
    public long Time { get; set; }   // Unix seconds
    public double Open { get; set; }
    public double High { get; set; }
    public double Low { get; set; }
    public double Close { get; set; }
}
