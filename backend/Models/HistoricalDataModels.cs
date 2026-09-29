namespace AlgoTrading.Models;

/// <summary>
/// Request for historical OHLCV data from a provider.
/// </summary>
public class HistoricalDataRequest
{
    /// <summary>Internal symbol identifier (e.g., "NIFTY50", "RELIANCE").</summary>
    public string Symbol { get; set; } = "";

    /// <summary>Start of the requested date range (inclusive).</summary>
    public DateTime StartDate { get; set; }

    /// <summary>End of the requested date range (inclusive).</summary>
    public DateTime EndDate { get; set; }

    /// <summary>Candle resolution: "day", "1minute", "30minute", "week", "month".</summary>
    public string Resolution { get; set; } = "day";
}

/// <summary>
/// A single OHLCV candle — the normalized internal representation.
/// All provider-specific fields are converted into this before reaching LEAN.
/// </summary>
public class HistoricalCandle
{
    public DateTime Timestamp { get; set; }
    public double Open { get; set; }
    public double High { get; set; }
    public double Low { get; set; }
    public double Close { get; set; }
    public double Volume { get; set; }
}

/// <summary>
/// Result of a historical data fetch operation.
/// </summary>
public class HistoricalDataResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }

    /// <summary>The validated, ordered OHLCV candles.</summary>
    public List<HistoricalCandle> Candles { get; set; } = new();

    /// <summary>Path to the CSV file written for LEAN consumption.</summary>
    public string? CsvFilePath { get; set; }

    /// <summary>Whether data was served from local cache (true) or fetched from provider (false).</summary>
    public bool FromCache { get; set; }
}
