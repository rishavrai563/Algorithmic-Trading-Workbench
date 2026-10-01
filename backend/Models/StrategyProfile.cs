namespace AlgoTrading.Models;

/// <summary>
/// A saved strategy profile — the core entity in the platform.
/// Initialized with 3 defaults on startup; updated via PUT /api/strategies/{id}.
/// </summary>
public class StrategyProfile
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string Name { get; set; } = "";
    public string Asset { get; set; } = "NIFTY 50";
    public string Timeframe { get; set; } = "Daily";
    public string StartDate { get; set; } = "2024-06-01";
    public string EndDate { get; set; } = "2025-01-01";
    public string Status { get; set; } = "Draft"; // Draft | Backtested
    public string PythonCode { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Dynamic strategy parameters with their schema for slider generation.</summary>
    public List<ParameterSchema> ParametersSchema { get; set; } = new();

    /// <summary>Current parameter values.</summary>
    public Dictionary<string, double> ParameterValues { get; set; } = new();

    /// <summary>Last backtest result summary (if any).</summary>
    public string? LastMetricSummary { get; set; }
}

/// <summary>
/// Defines a single tunable parameter with its slider range.
/// </summary>
public class ParameterSchema
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public double Min { get; set; }
    public double Max { get; set; }
    public double Step { get; set; } = 1;
    /// <summary>Documentation tooltip key (maps to frontend docsData.js).</summary>
    public string? DocKey { get; set; }
}

/// <summary>
/// A single completed backtest record, saved for history/compare.
/// </summary>
public class BacktestRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string StrategyId { get; set; } = "";
    public string StrategyName { get; set; } = "";
    public string Asset { get; set; } = "";
    public string Period { get; set; } = "";
    public DateTime RanAt { get; set; } = DateTime.UtcNow;

    // Metrics snapshot
    public double TotalReturn { get; set; }
    public double MaxDrawdown { get; set; }
    public int TotalTrades { get; set; }
    public double WinRate { get; set; }
    public double StartEquity { get; set; } = 100000;
    public double EndEquity { get; set; }

    /// <summary>Parameter values used for this specific run.</summary>
    public Dictionary<string, double> ParameterValues { get; set; } = new();

    /// <summary>Full backtest result for drill-down.</summary>
    public BacktestResponse? FullResult { get; set; }
}
